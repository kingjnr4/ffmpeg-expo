import ExpoModulesCore
import Foundation

public class ExpoFFmpegModule: Module {
    private var sessions: [String: FFmpegSession] = [:]
    private let sessionQueue = DispatchQueue(label: "expo.ffmpeg.sessions", attributes: .concurrent)
    
    public func definition() -> ModuleDefinition {
        Name("ExpoFFmpeg")
        
        Events("onProgress", "onLog")
        
        AsyncFunction("run") { (sessionId: String, args: [String], options: [String: Any], promise: Promise) in
            let logLevel = (options["logLevel"] as? Int) ?? 24 // AV_LOG_WARNING
            
            let session = FFmpegSession(
                id: sessionId,
                args: args,
                logLevel: Int32(logLevel),
                onProgress: { [weak self] progress in
                    self?.sendEvent("onProgress", [
                        "sessionId": sessionId,
                        "time": progress.time,
                        "bitrate": progress.bitrate,
                        "speed": progress.speed,
                        "frame": progress.frame,
                        "fps": progress.fps,
                        "size": progress.size
                    ])
                },
                onLog: { [weak self] level, message in
                    self?.sendEvent("onLog", [
                        "sessionId": sessionId,
                        "level": self?.levelToString(level) ?? "info",
                        "message": message
                    ])
                }
            )
            
            self.sessionQueue.async(flags: .barrier) {
                self.sessions[sessionId] = session
            }
            
            DispatchQueue.global(qos: .userInitiated).async {
                let startTime = Date()
                
                do {
                    let result = try session.execute()
                    let duration = Date().timeIntervalSince(startTime) * 1000
                    
                    self.sessionQueue.async(flags: .barrier) {
                        self.sessions.removeValue(forKey: sessionId)
                    }
                    
                    promise.resolve([
                        "returnCode": result.returnCode,
                        "output": result.output,
                        "duration": Int(duration)
                    ])
                } catch FFmpegError.cancelled {
                    self.sessionQueue.async(flags: .barrier) {
                        self.sessions.removeValue(forKey: sessionId)
                    }
                    promise.resolve([
                        "returnCode": 255,
                        "output": "Session cancelled",
                        "duration": 0
                    ])
                } catch {
                    self.sessionQueue.async(flags: .barrier) {
                        self.sessions.removeValue(forKey: sessionId)
                    }
                    promise.reject("FFMPEG_ERROR", error.localizedDescription)
                }
            }
        }
        
        AsyncFunction("cancel") { (sessionId: String, promise: Promise) in
            var session: FFmpegSession?
            self.sessionQueue.sync {
                session = self.sessions[sessionId]
            }
            
            if let session = session {
                session.cancel()
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        }
        
        Function("getVersion") {
            return FFmpegBridge.getVersion()
        }
        
        OnDestroy {
            self.sessionQueue.async(flags: .barrier) {
                self.sessions.values.forEach { $0.cancel() }
                self.sessions.removeAll()
            }
        }
    }
    
    private func levelToString(_ level: Int32) -> String {
        switch level {
        case -8: return "quiet"
        case 0: return "panic"
        case 8: return "fatal"
        case 16: return "error"
        case 24: return "warning"
        case 32: return "info"
        case 40: return "verbose"
        case 48: return "debug"
        case 56: return "trace"
        default: return "info"
        }
    }
}
