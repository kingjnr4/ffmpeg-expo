import Foundation

typealias FFmpegLogCallback = @convention(c) (UnsafeMutableRawPointer?, Int32, UnsafePointer<CChar>?) -> Void

class FFmpegBridge {
    
    private static var logCallback: ((UnsafeMutableRawPointer?, Int32, UnsafePointer<CChar>?) -> Void)?
    private static var logCallbackContext: UnsafeMutableRawPointer?
    
    static func getVersion() -> String {
        return String(cString: av_version_info())
    }
    
    static func setLogCallback(
        _ context: UnsafeMutableRawPointer?,
        callback: @escaping (UnsafeMutableRawPointer?, Int32, UnsafePointer<CChar>?) -> Void
    ) {
        logCallbackContext = context
        logCallback = callback
        
        av_log_set_callback { ptr, level, fmt, valist in
            guard let callback = FFmpegBridge.logCallback else { return }
            
            var message = [CChar](repeating: 0, count: 1024)
            vsnprintf(&message, 1024, fmt, valist)
            
            callback(FFmpegBridge.logCallbackContext, level, message)
        }
    }
    
    static func clearLogCallback() {
        logCallback = nil
        logCallbackContext = nil
        av_log_set_callback(nil)
    }
    
    static func execute(
        args: [String],
        logLevel: Int32,
        shouldCancel: @escaping () -> Bool
    ) -> Int32 {
        av_log_set_level(logLevel)
        
        // For actual implementation, this would:
        // 1. Parse command line arguments
        // 2. Use avformat/avcodec APIs to perform the operation
        // 3. Or call a patched ffmpeg_main() function
        
        // Simplified implementation using avformat for remuxing
        return executeTranscode(args: args, shouldCancel: shouldCancel)
    }
    
    private static func executeTranscode(
        args: [String],
        shouldCancel: @escaping () -> Bool
    ) -> Int32 {
        var inputFile: String?
        var outputFile: String?
        var overwrite = false
        
        var i = 0
        while i < args.count {
            if args[i] == "-i" && i + 1 < args.count {
                i += 1
                inputFile = args[i]
            } else if args[i] == "-y" {
                overwrite = true
            } else if !args[i].hasPrefix("-") && i == args.count - 1 {
                outputFile = args[i]
            }
            i += 1
        }
        
        guard let input = inputFile, let output = outputFile else {
            av_log(nil, AV_LOG_ERROR, "Missing input or output file\n")
            return 1
        }
        
        var inputCtx: UnsafeMutablePointer<AVFormatContext>?
        var ret = avformat_open_input(&inputCtx, input, nil, nil)
        if ret < 0 {
            av_log(nil, AV_LOG_ERROR, "Could not open input file\n")
            return ret
        }
        
        defer {
            avformat_close_input(&inputCtx)
        }
        
        ret = avformat_find_stream_info(inputCtx, nil)
        if ret < 0 {
            av_log(nil, AV_LOG_ERROR, "Could not find stream info\n")
            return ret
        }
        
        var outputCtx: UnsafeMutablePointer<AVFormatContext>?
        ret = avformat_alloc_output_context2(&outputCtx, nil, nil, output)
        if ret < 0 || outputCtx == nil {
            av_log(nil, AV_LOG_ERROR, "Could not create output context\n")
            return ret
        }
        
        defer {
            if let ctx = outputCtx {
                if (ctx.pointee.oformat.pointee.flags & AVFMT_NOFILE) == 0 {
                    avio_closep(&ctx.pointee.pb)
                }
                avformat_free_context(ctx)
            }
        }
        
        guard let inCtx = inputCtx else { return -1 }
        
        for i in 0..<Int(inCtx.pointee.nb_streams) {
            let inStream = inCtx.pointee.streams[i]!
            let outStream = avformat_new_stream(outputCtx, nil)
            
            guard let outStream = outStream else {
                av_log(nil, AV_LOG_ERROR, "Could not create output stream\n")
                return AVERROR(ENOMEM)
            }
            
            ret = avcodec_parameters_copy(outStream.pointee.codecpar, inStream.pointee.codecpar)
            if ret < 0 {
                av_log(nil, AV_LOG_ERROR, "Could not copy codec parameters\n")
                return ret
            }
            
            outStream.pointee.codecpar.pointee.codec_tag = 0
        }
        
        if let ctx = outputCtx, (ctx.pointee.oformat.pointee.flags & AVFMT_NOFILE) == 0 {
            ret = avio_open(&ctx.pointee.pb, output, AVIO_FLAG_WRITE)
            if ret < 0 {
                av_log(nil, AV_LOG_ERROR, "Could not open output file\n")
                return ret
            }
        }
        
        ret = avformat_write_header(outputCtx, nil)
        if ret < 0 {
            av_log(nil, AV_LOG_ERROR, "Could not write header\n")
            return ret
        }
        
        let packet = av_packet_alloc()
        defer { av_packet_free(UnsafeMutablePointer(&packet)) }
        
        while av_read_frame(inputCtx, packet) >= 0 {
            if shouldCancel() {
                return 255
            }
            
            guard let pkt = packet, let outCtx = outputCtx else { break }
            
            let inStream = inCtx.pointee.streams[Int(pkt.pointee.stream_index)]!
            let outStream = outCtx.pointee.streams[Int(pkt.pointee.stream_index)]!
            
            pkt.pointee.pts = av_rescale_q_rnd(
                pkt.pointee.pts,
                inStream.pointee.time_base,
                outStream.pointee.time_base,
                AVRounding(rawValue: AV_ROUND_NEAR_INF.rawValue | AV_ROUND_PASS_MINMAX.rawValue)
            )
            pkt.pointee.dts = av_rescale_q_rnd(
                pkt.pointee.dts,
                inStream.pointee.time_base,
                outStream.pointee.time_base,
                AVRounding(rawValue: AV_ROUND_NEAR_INF.rawValue | AV_ROUND_PASS_MINMAX.rawValue)
            )
            pkt.pointee.duration = av_rescale_q(
                pkt.pointee.duration,
                inStream.pointee.time_base,
                outStream.pointee.time_base
            )
            pkt.pointee.pos = -1
            
            ret = av_interleaved_write_frame(outputCtx, packet)
            if ret < 0 {
                av_log(nil, AV_LOG_ERROR, "Error writing packet\n")
                break
            }
            
            av_packet_unref(packet)
        }
        
        av_write_trailer(outputCtx)
        
        return 0
    }
}
