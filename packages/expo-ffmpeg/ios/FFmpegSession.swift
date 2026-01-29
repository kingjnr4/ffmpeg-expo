import Foundation

struct FFmpegProgress {
    let time: Int64
    let bitrate: Double
    let speed: Double
    let frame: Int
    let fps: Double
    let size: Int64
}

struct FFmpegResult {
    let returnCode: Int32
    let output: String
}

enum FFmpegError: Error {
    case cancelled
    case executionFailed(String)
    case invalidArguments
}

class FFmpegSession {
    let id: String
    private let args: [String]
    private let logLevel: Int32
    private let onProgress: (FFmpegProgress) -> Void
    private let onLog: (Int32, String) -> Void
    
    private var cancelled = false
    private var outputBuffer = ""
    private let lock = NSLock()
    
    init(
        id: String,
        args: [String],
        logLevel: Int32,
        onProgress: @escaping (FFmpegProgress) -> Void,
        onLog: @escaping (Int32, String) -> Void
    ) {
        self.id = id
        self.args = args
        self.logLevel = logLevel
        self.onProgress = onProgress
        self.onLog = onLog
    }
    
    func execute() throws -> FFmpegResult {
        if cancelled {
            throw FFmpegError.cancelled
        }
        
        // Set up FFmpeg log callback
        let sessionPtr = Unmanaged.passUnretained(self).toOpaque()
        FFmpegBridge.setLogCallback(sessionPtr) { ptr, level, message in
            guard let ptr = ptr, let message = message else { return }
            let session = Unmanaged<FFmpegSession>.fromOpaque(ptr).takeUnretainedValue()
            let messageStr = String(cString: message)
            
            session.lock.lock()
            session.outputBuffer.append(messageStr)
            session.lock.unlock()
            
            session.onLog(level, messageStr)
            
            // Parse progress from log output
            if let progress = session.parseProgress(from: messageStr) {
                session.onProgress(progress)
            }
        }
        
        defer {
            FFmpegBridge.clearLogCallback()
        }
        
        // Execute FFmpeg command
        let returnCode = FFmpegBridge.execute(args: args, logLevel: logLevel) { [weak self] in
            return self?.cancelled ?? true
        }
        
        lock.lock()
        let output = outputBuffer
        lock.unlock()
        
        if cancelled {
            throw FFmpegError.cancelled
        }
        
        return FFmpegResult(returnCode: returnCode, output: output)
    }
    
    func cancel() {
        lock.lock()
        cancelled = true
        lock.unlock()
    }
    
    private func parseProgress(from line: String) -> FFmpegProgress? {
        // Parse progress lines like:
        // frame=  123 fps= 24 q=28.0 size=    1234kB time=00:00:05.12 bitrate= 197.4kbits/s speed=1.23x
        
        guard line.contains("frame=") || line.contains("size=") else {
            return nil
        }
        
        var time: Int64 = 0
        var bitrate: Double = 0
        var speed: Double = 0
        var frame: Int = 0
        var fps: Double = 0
        var size: Int64 = 0
        
        // Parse time
        if let timeMatch = line.range(of: #"time=(\d+):(\d+):([\d.]+)"#, options: .regularExpression) {
            let timeStr = String(line[timeMatch])
            let components = timeStr.replacingOccurrences(of: "time=", with: "").split(separator: ":")
            if components.count >= 3,
               let hours = Int(components[0]),
               let minutes = Int(components[1]),
               let seconds = Double(components[2]) {
                time = Int64((Double(hours * 3600 + minutes * 60) + seconds) * 1000)
            }
        }
        
        // Parse bitrate
        if let bitrateMatch = line.range(of: #"bitrate=\s*([\d.]+)kbits/s"#, options: .regularExpression) {
            let bitrateStr = String(line[bitrateMatch])
            if let value = Double(bitrateStr.replacingOccurrences(of: "bitrate=", with: "")
                                          .replacingOccurrences(of: "kbits/s", with: "")
                                          .trimmingCharacters(in: .whitespaces)) {
                bitrate = value
            }
        }
        
        // Parse speed
        if let speedMatch = line.range(of: #"speed=\s*([\d.]+)x"#, options: .regularExpression) {
            let speedStr = String(line[speedMatch])
            if let value = Double(speedStr.replacingOccurrences(of: "speed=", with: "")
                                         .replacingOccurrences(of: "x", with: "")
                                         .trimmingCharacters(in: .whitespaces)) {
                speed = value
            }
        }
        
        // Parse frame
        if let frameMatch = line.range(of: #"frame=\s*(\d+)"#, options: .regularExpression) {
            let frameStr = String(line[frameMatch])
            if let value = Int(frameStr.replacingOccurrences(of: "frame=", with: "")
                                      .trimmingCharacters(in: .whitespaces)) {
                frame = value
            }
        }
        
        // Parse fps
        if let fpsMatch = line.range(of: #"fps=\s*([\d.]+)"#, options: .regularExpression) {
            let fpsStr = String(line[fpsMatch])
            if let value = Double(fpsStr.replacingOccurrences(of: "fps=", with: "")
                                       .trimmingCharacters(in: .whitespaces)) {
                fps = value
            }
        }
        
        // Parse size
        if let sizeMatch = line.range(of: #"size=\s*(\d+)kB"#, options: .regularExpression) {
            let sizeStr = String(line[sizeMatch])
            if let value = Int64(sizeStr.replacingOccurrences(of: "size=", with: "")
                                       .replacingOccurrences(of: "kB", with: "")
                                       .trimmingCharacters(in: .whitespaces)) {
                size = value * 1024
            }
        }
        
        if time > 0 || frame > 0 || size > 0 {
            return FFmpegProgress(time: time, bitrate: bitrate, speed: speed, frame: frame, fps: fps, size: size)
        }
        
        return nil
    }
}
