#include "ffmpeg_jni.h"
#include <android/log.h>
#include <vector>
#include <cstring>

#define LOG_TAG "FFmpegJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace ffmpeg {

// Thread-local session for log callback
thread_local FFmpegSession* currentSession = nullptr;

// Custom FFmpeg log callback
static void ffmpeg_log_callback(void* ptr, int level, const char* fmt, va_list vl) {
    if (currentSession == nullptr) return;
    
    char line[1024];
    vsnprintf(line, sizeof(line), fmt, vl);
    
    // Remove trailing newline
    size_t len = strlen(line);
    if (len > 0 && line[len - 1] == '\n') {
        line[len - 1] = '\0';
    }
    
    if (strlen(line) > 0) {
        currentSession->notifyLog(level, line);
    }
}

// SessionManager implementation
SessionManager& SessionManager::getInstance() {
    static SessionManager instance;
    return instance;
}

long SessionManager::createSession(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(mutex_);
    long handle = nextHandle_++;
    sessions_[handle] = std::make_unique<FFmpegSession>(sessionId);
    return handle;
}

FFmpegSession* SessionManager::getSession(long handle) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = sessions_.find(handle);
    return it != sessions_.end() ? it->second.get() : nullptr;
}

void SessionManager::destroySession(long handle) {
    std::lock_guard<std::mutex> lock(mutex_);
    sessions_.erase(handle);
}

// FFmpegSession implementation
FFmpegSession::FFmpegSession(const std::string& sessionId)
    : sessionId_(sessionId) {
}

FFmpegSession::~FFmpegSession() {
    // Ensure callback is cleared
    if (callbackRef_ != nullptr && jvm_ != nullptr) {
        JNIEnv* env;
        if (jvm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_OK) {
            env->DeleteGlobalRef(callbackRef_);
        }
    }
}

void FFmpegSession::setCallback(JNIEnv* env, jobject callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    
    env->GetJavaVM(&jvm_);
    callbackRef_ = env->NewGlobalRef(callback);
    
    jclass callbackClass = env->GetObjectClass(callback);
    onProgressMethod_ = env->GetMethodID(callbackClass, "onProgress", "(JDDIDJ)V");
    onLogMethod_ = env->GetMethodID(callbackClass, "onLog", "(ILjava/lang/String;)V");
}

void FFmpegSession::clearCallback(JNIEnv* env) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    
    if (callbackRef_ != nullptr) {
        env->DeleteGlobalRef(callbackRef_);
        callbackRef_ = nullptr;
    }
    onProgressMethod_ = nullptr;
    onLogMethod_ = nullptr;
}

void FFmpegSession::notifyProgress(int64_t time, double bitrate, double speed, int frame, double fps, int64_t size) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    
    if (callbackRef_ == nullptr || jvm_ == nullptr || onProgressMethod_ == nullptr) return;
    
    JNIEnv* env;
    bool attached = false;
    
    if (jvm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
        if (jvm_->AttachCurrentThread(&env, nullptr) != JNI_OK) return;
        attached = true;
    }
    
    env->CallVoidMethod(callbackRef_, onProgressMethod_, 
                       (jlong)time, (jdouble)bitrate, (jdouble)speed, 
                       (jint)frame, (jdouble)fps, (jlong)size);
    
    if (attached) {
        jvm_->DetachCurrentThread();
    }
}

void FFmpegSession::notifyLog(int level, const char* message) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    
    if (callbackRef_ == nullptr || jvm_ == nullptr || onLogMethod_ == nullptr) return;
    
    JNIEnv* env;
    bool attached = false;
    
    if (jvm_->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
        if (jvm_->AttachCurrentThread(&env, nullptr) != JNI_OK) return;
        attached = true;
    }
    
    jstring jmessage = env->NewStringUTF(message);
    env->CallVoidMethod(callbackRef_, onLogMethod_, (jint)level, jmessage);
    env->DeleteLocalRef(jmessage);
    
    if (attached) {
        jvm_->DetachCurrentThread();
    }
}

void FFmpegSession::cancel() {
    cancelled_.store(true);
}

} // namespace ffmpeg

// JNI exports
extern "C" {

JNIEXPORT jstring JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_getVersion(JNIEnv* env, jobject thiz) {
    const char* version = av_version_info();
    return env->NewStringUTF(version ? version : "unknown");
}

JNIEXPORT jlong JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_createSession(JNIEnv* env, jobject thiz, jstring sessionId) {
    const char* sessionIdStr = env->GetStringUTFChars(sessionId, nullptr);
    long handle = ffmpeg::SessionManager::getInstance().createSession(sessionIdStr);
    env->ReleaseStringUTFChars(sessionId, sessionIdStr);
    return handle;
}

JNIEXPORT void JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_destroySession(JNIEnv* env, jobject thiz, jlong sessionHandle) {
    ffmpeg::SessionManager::getInstance().destroySession(sessionHandle);
}

JNIEXPORT void JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_cancel(JNIEnv* env, jobject thiz, jlong sessionHandle) {
    auto* session = ffmpeg::SessionManager::getInstance().getSession(sessionHandle);
    if (session) {
        session->cancel();
    }
}

JNIEXPORT jint JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_execute(
    JNIEnv* env,
    jobject thiz,
    jlong sessionHandle,
    jobjectArray args,
    jint logLevel,
    jobject callback
) {
    auto* session = ffmpeg::SessionManager::getInstance().getSession(sessionHandle);
    if (!session) {
        LOGE("Session not found: %ld", (long)sessionHandle);
        return -1;
    }
    
    return session->execute(env, args, logLevel, callback);
}

} // extern "C"
