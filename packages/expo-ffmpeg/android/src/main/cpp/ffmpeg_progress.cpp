#include "ffmpeg_jni.h"
#include <cstring>
#include <cstdlib>

namespace ffmpeg {

// Parses lines like: frame=  123 fps= 24 q=28.0 size=    1234kB time=00:00:05.12 bitrate= 197.4kbits/s speed=1.23x

struct ParsedProgress {
    int64_t time_ms = 0;
    double bitrate = 0;
    double speed = 0;
    int frame = 0;
    double fps = 0;
    int64_t size_bytes = 0;
    bool valid = false;
};

static const char* findValue(const char* line, const char* key) {
    const char* pos = strstr(line, key);
    if (pos) {
        pos += strlen(key);
        while (*pos == ' ' || *pos == '=') pos++;
        return pos;
    }
    return nullptr;
}

ParsedProgress parseProgressLine(const char* line) {
    ParsedProgress progress;
    
    if (strstr(line, "frame=") == nullptr && strstr(line, "size=") == nullptr) {
        return progress;
    }
    
    const char* val = findValue(line, "frame=");
    if (val) {
        progress.frame = atoi(val);
    }
    
    val = findValue(line, "fps=");
    if (val) {
        progress.fps = atof(val);
    }
    
    val = findValue(line, "size=");
    if (val) {
        progress.size_bytes = atoll(val) * 1024;
    }
    
    val = findValue(line, "time=");
    if (val) {
        int hours = 0, minutes = 0;
        double seconds = 0;
        if (sscanf(val, "%d:%d:%lf", &hours, &minutes, &seconds) >= 3) {
            progress.time_ms = (int64_t)((hours * 3600 + minutes * 60 + seconds) * 1000);
        }
    }
    
    val = findValue(line, "bitrate=");
    if (val) {
        progress.bitrate = atof(val);
    }
    
    val = findValue(line, "speed=");
    if (val) {
        progress.speed = atof(val);
    }
    
    progress.valid = (progress.time_ms > 0 || progress.frame > 0 || progress.size_bytes > 0);
    return progress;
}

void notifyProgressFromLine(const char* line, FFmpegSession* session) {
    const ParsedProgress progress = parseProgressLine(line);
    if (!progress.valid) return;

    session->notifyProgress(
        progress.time_ms,
        progress.bitrate,
        progress.speed,
        progress.frame,
        progress.fps,
        progress.size_bytes);
}

}
