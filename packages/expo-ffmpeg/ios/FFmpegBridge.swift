import Foundation

typealias FFmpegLogCallback = @convention(c) (UnsafeMutableRawPointer?, Int32, UnsafePointer<CChar>?) -> Void

private final class CancellationContext {
    let shouldCancel: () -> Bool

    init(_ shouldCancel: @escaping () -> Bool) {
        self.shouldCancel = shouldCancel
    }
}

private let cancellationCallback: @convention(c) (UnsafeMutableRawPointer?) -> Int32 = { context in
    guard let context else { return 1 }
    let cancellation = Unmanaged<CancellationContext>.fromOpaque(context).takeUnretainedValue()
    return cancellation.shouldCancel() ? 1 : 0
}

class FFmpegBridge {
    private static var logCallback: ((UnsafeMutableRawPointer?, Int32, UnsafePointer<CChar>?) -> Void)?
    private static var logCallbackContext: UnsafeMutableRawPointer?

    static func getVersion() -> String {
        String(cString: av_version_info())
    }

    static func setLogCallback(
        _ context: UnsafeMutableRawPointer?,
        callback: @escaping (UnsafeMutableRawPointer?, Int32, UnsafePointer<CChar>?) -> Void
    ) {
        logCallbackContext = context
        logCallback = callback

        av_log_set_callback { _, level, format, arguments in
            guard let callback = FFmpegBridge.logCallback, let format else { return }
            var message = [CChar](repeating: 0, count: 4096)
            vsnprintf(&message, message.count, format, arguments)
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
        let cancellation = Unmanaged.passRetained(CancellationContext(shouldCancel))
        defer { cancellation.release() }

        let arguments = ["ffmpeg"] + args
        let duplicatedArguments = arguments.map { strdup($0) }
        defer { duplicatedArguments.forEach { free($0) } }
        var argv = duplicatedArguments

        return expo_ffmpeg_execute(
            Int32(argv.count),
            &argv,
            cancellationCallback,
            cancellation.toOpaque()
        )
    }
}
