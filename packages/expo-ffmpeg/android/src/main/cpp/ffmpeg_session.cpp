#include "ffmpeg_jni.h"

#include <android/log.h>
#include <mutex>
#include <string>
#include <vector>

#define LOG_TAG "FFmpegSession"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace ffmpeg {

void installLogCallback();

namespace {

std::mutex executionMutex;

int shouldCancel(void* opaque) {
    return static_cast<FFmpegSession*>(opaque)->isCancelled() ? 1 : 0;
}

} // namespace

int FFmpegSession::execute(JNIEnv* env, jobjectArray args, int logLevel, jobject callback) {
    std::lock_guard<std::mutex> executionLock(executionMutex);
    setCallback(env, callback);
    currentSession = this;
    installLogCallback();
    av_log_set_level(logLevel);

    const int argCount = env->GetArrayLength(args);
    std::vector<std::string> argStrings;
    argStrings.reserve(argCount + 1);
    argStrings.emplace_back("ffmpeg");

    for (int i = 0; i < argCount; i++) {
        auto arg = static_cast<jstring>(env->GetObjectArrayElement(args, i));
        const char* value = env->GetStringUTFChars(arg, nullptr);
        argStrings.emplace_back(value);
        env->ReleaseStringUTFChars(arg, value);
        env->DeleteLocalRef(arg);
    }

    std::vector<char*> argv;
    argv.reserve(argStrings.size());
    for (auto& arg : argStrings) {
        argv.push_back(arg.data());
    }

    LOGI("Executing embedded FFmpeg with %d arguments", static_cast<int>(argv.size()));
    const int result = expo_ffmpeg_execute(
        static_cast<int>(argv.size()), argv.data(), shouldCancel, this);

    currentSession = nullptr;
    clearCallback(env);
    return result;
}

} // namespace ffmpeg
