package expo.modules.ffmpeg

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class ExpoFFmpegModule : Module() {
    companion object {
        init {
            System.loadLibrary("ffmpeg-jni")
        }
    }

    private val sessions = ConcurrentHashMap<String, FFmpegSession>()
    private val moduleScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun definition() = ModuleDefinition {
        Name("ExpoFFmpeg")

        Events("onProgress", "onLog")

        AsyncFunction("run") { sessionId: String, args: List<String>, options: Map<String, Any?>, promise: Promise ->
            moduleScope.launch {
                try {
                    val logLevel = (options["logLevel"] as? Number)?.toInt() ?: 24 // AV_LOG_WARNING
                    val env = options["environmentVariables"] as? Map<String, String>

                    val session = FFmpegSession(
                        id = sessionId,
                        args = args,
                        logLevel = logLevel,
                        onProgress = { progress ->
                            sendEvent("onProgress", mapOf(
                                "sessionId" to sessionId,
                                "time" to progress.time,
                                "bitrate" to progress.bitrate,
                                "speed" to progress.speed,
                                "frame" to progress.frame,
                                "fps" to progress.fps,
                                "size" to progress.size
                            ))
                        },
                        onLog = { level, message ->
                            sendEvent("onLog", mapOf(
                                "sessionId" to sessionId,
                                "level" to levelToString(level),
                                "message" to message
                            ))
                        }
                    )

                    sessions[sessionId] = session

                    val startTime = System.currentTimeMillis()
                    val result = session.execute()
                    val duration = System.currentTimeMillis() - startTime

                    sessions.remove(sessionId)

                    promise.resolve(mapOf(
                        "returnCode" to result.returnCode,
                        "output" to result.output,
                        "duration" to duration
                    ))
                } catch (e: FFmpegCancelledException) {
                    sessions.remove(sessionId)
                    promise.resolve(mapOf(
                        "returnCode" to 255,
                        "output" to "Session cancelled",
                        "duration" to 0L
                    ))
                } catch (e: Exception) {
                    sessions.remove(sessionId)
                    promise.reject("FFMPEG_ERROR", e.message ?: "Unknown error", e)
                }
            }
        }

        AsyncFunction("cancel") { sessionId: String, promise: Promise ->
            val session = sessions[sessionId]
            if (session != null) {
                session.cancel()
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        }

        Function("getVersion") {
            FFmpegBridge.getVersion()
        }

        OnDestroy {
            moduleScope.cancel()
            sessions.values.forEach { it.cancel() }
            sessions.clear()
        }
    }

    private fun levelToString(level: Int): String = when (level) {
        -8 -> "quiet"
        0 -> "panic"
        8 -> "fatal"
        16 -> "error"
        24 -> "warning"
        32 -> "info"
        40 -> "verbose"
        48 -> "debug"
        56 -> "trace"
        else -> "info"
    }
}

class FFmpegCancelledException : Exception("FFmpeg session was cancelled")
