package expo.modules.ffmpeg

object FFmpegBridge {
    external fun getVersion(): String

    external fun createSession(sessionId: String): Long

    external fun execute(
        sessionHandle: Long,
        args: Array<String>,
        logLevel: Int,
        callback: FFmpegCallback
    ): Int

    external fun cancel(sessionHandle: Long)

    external fun destroySession(sessionHandle: Long)
}
