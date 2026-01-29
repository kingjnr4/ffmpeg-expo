#ifndef FFMPEG_JNI_H
#define FFMPEG_JNI_H

#include <jni.h>
#include <string>
#include <memory>
#include <atomic>
#include <mutex>
#include <unordered_map>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libavutil/log.h>
#include <libswresample/swresample.h>
#include <libswscale/swscale.h>
}

namespace ffmpeg {

// Forward declarations
class FFmpegSession;

// Session manager singleton
class SessionManager {
public:
    static SessionManager& getInstance();
    
    long createSession(const std::string& sessionId);
    FFmpegSession* getSession(long handle);
    void destroySession(long handle);
    
private:
    SessionManager() = default;
    std::mutex mutex_;
    std::unordered_map<long, std::unique_ptr<FFmpegSession>> sessions_;
    std::atomic<long> nextHandle_{1};
};

// FFmpeg execution session
class FFmpegSession {
public:
    FFmpegSession(const std::string& sessionId);
    ~FFmpegSession();
    
    int execute(JNIEnv* env, jobjectArray args, int logLevel, jobject callback);
    void cancel();
    bool isCancelled() const { return cancelled_.load(); }
    
    const std::string& getSessionId() const { return sessionId_; }
    
    // Callback handling
    void setCallback(JNIEnv* env, jobject callback);
    void clearCallback(JNIEnv* env);
    void notifyProgress(int64_t time, double bitrate, double speed, int frame, double fps, int64_t size);
    void notifyLog(int level, const char* message);
    
private:
    std::string sessionId_;
    std::atomic<bool> cancelled_{false};
    
    // JNI callback state
    JavaVM* jvm_ = nullptr;
    jobject callbackRef_ = nullptr;
    jmethodID onProgressMethod_ = nullptr;
    jmethodID onLogMethod_ = nullptr;
    
    std::mutex callbackMutex_;
};

} // namespace ffmpeg

#endif // FFMPEG_JNI_H
