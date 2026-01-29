package expo.modules.ffmpeg

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

data class FFmpegProgress(
    val time: Long,
    val bitrate: Double,
    val speed: Double,
    val frame: Int,
    val fps: Double,
    val size: Long
)

data class FFmpegResult(
    val returnCode: Int,
    val output: String
)

class FFmpegSession(
    val id: String,
    private val args: List<String>,
    private val logLevel: Int,
    private val onProgress: (FFmpegProgress) -> Unit,
    private val onLog: (Int, String) -> Unit
) {
    private val cancelled = AtomicBoolean(false)
    private val outputBuffer = StringBuilder()
    private var nativeSessionId: Long = 0

    suspend fun execute(): FFmpegResult = withContext(Dispatchers.IO) {
        if (cancelled.get()) {
            throw FFmpegCancelledException()
        }

        // Set up native callback
        val callback = object : FFmpegCallback {
            override fun onProgress(time: Long, bitrate: Double, speed: Double, frame: Int, fps: Double, size: Long) {
                if (!cancelled.get()) {
                    onProgress(FFmpegProgress(time, bitrate, speed, frame, fps, size))
                }
            }

            override fun onLog(level: Int, message: String) {
                if (!cancelled.get()) {
                    outputBuffer.append(message)
                    onLog(level, message)
                }
            }
        }

        // Execute FFmpeg
        nativeSessionId = FFmpegBridge.createSession(id)
        
        try {
            val returnCode = FFmpegBridge.execute(
                nativeSessionId,
                args.toTypedArray(),
                logLevel,
                callback
            )

            FFmpegResult(
                returnCode = returnCode,
                output = outputBuffer.toString()
            )
        } finally {
            FFmpegBridge.destroySession(nativeSessionId)
            nativeSessionId = 0
        }
    }

    fun cancel() {
        cancelled.set(true)
        if (nativeSessionId != 0L) {
            FFmpegBridge.cancel(nativeSessionId)
        }
    }
}

interface FFmpegCallback {
    fun onProgress(time: Long, bitrate: Double, speed: Double, frame: Int, fps: Double, size: Long)
    fun onLog(level: Int, message: String)
}
