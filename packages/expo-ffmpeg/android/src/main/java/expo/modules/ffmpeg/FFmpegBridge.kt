package expo.modules.ffmpeg

/**
 * JNI bridge to native FFmpeg library
 */
object FFmpegBridge {
    /**
     * Get FFmpeg version string
     */
    external fun getVersion(): String

    /**
     * Create a new FFmpeg session
     * @param sessionId Unique identifier for the session
     * @return Native session handle
     */
    external fun createSession(sessionId: String): Long

    /**
     * Execute FFmpeg command
     * @param sessionHandle Native session handle from createSession
     * @param args FFmpeg command arguments
     * @param logLevel FFmpeg log level
     * @param callback Callback for progress and log events
     * @return FFmpeg exit code (0 = success)
     */
    external fun execute(
        sessionHandle: Long,
        args: Array<String>,
        logLevel: Int,
        callback: FFmpegCallback
    ): Int

    /**
     * Cancel a running session
     * @param sessionHandle Native session handle
     */
    external fun cancel(sessionHandle: Long)

    /**
     * Destroy a session and free resources
     * @param sessionHandle Native session handle
     */
    external fun destroySession(sessionHandle: Long)
}
