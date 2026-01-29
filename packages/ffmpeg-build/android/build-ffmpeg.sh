#!/bin/bash
set -e

# FFmpeg Android Build Script
# Builds shared libraries for arm64-v8a, armeabi-v7a, and x86_64

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FFMPEG_VERSION="${FFMPEG_VERSION:-6.1.1}"
ANDROID_API="${ANDROID_API:-21}"
OUTPUT_DIR="${OUTPUT_DIR:-$SCRIPT_DIR/../../../output/android}"

# NDK path detection
if [ -z "$ANDROID_NDK_HOME" ]; then
    if [ -d "/opt/android-ndk/ndk" ]; then
        ANDROID_NDK_HOME="/opt/android-ndk/ndk"
    elif [ -d "$HOME/Android/Sdk/ndk" ]; then
        # Find latest NDK version
        ANDROID_NDK_HOME=$(find "$HOME/Android/Sdk/ndk" -maxdepth 1 -type d | sort -V | tail -1)
    else
        echo "ERROR: ANDROID_NDK_HOME not set and NDK not found"
        exit 1
    fi
fi

TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64"
if [ ! -d "$TOOLCHAIN" ]; then
    # Try macOS path
    TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64"
fi

if [ ! -d "$TOOLCHAIN" ]; then
    echo "ERROR: NDK toolchain not found at $TOOLCHAIN"
    exit 1
fi

echo "Using NDK: $ANDROID_NDK_HOME"
echo "Using Toolchain: $TOOLCHAIN"
echo "Output directory: $OUTPUT_DIR"

# ABI configurations: ARCH|TARGET|CPU
# Note: For arm64-v8a, we use cortex-a53 as a common baseline
declare -A ABI_CONFIGS=(
    ["arm64-v8a"]="aarch64|aarch64-linux-android|cortex-a53"
    ["armeabi-v7a"]="arm|armv7a-linux-androideabi|armv7-a"
    ["x86_64"]="x86_64|x86_64-linux-android|x86-64"
)

# Common FFmpeg configure flags
COMMON_FLAGS="
    --disable-static
    --enable-shared
    --disable-programs
    --disable-doc
    --disable-htmlpages
    --disable-manpages
    --disable-podpages
    --disable-txtpages
    --disable-ffmpeg
    --disable-ffplay
    --disable-ffprobe
    --enable-small
    --enable-jni
    --enable-mediacodec
    --disable-gpl
    --disable-nonfree
    --enable-pic
    --disable-debug
    --disable-symver
    --enable-hardcoded-tables
"

# Enabled components for "most used codecs"
# Note: Using native encoders only (LGPL). For libx264, you'd need GPL.
CODEC_FLAGS="
    --enable-decoder=aac,aac_latm,ac3,h264,hevc,mp3,mpeg4,vorbis,opus,flac,pcm_*,vp8,vp9,gif,png,mjpeg
    --enable-encoder=aac,mpeg4,pcm_*,gif,png,mjpeg
    --enable-demuxer=aac,ac3,avi,flac,h264,hevc,matroska,mov,mp3,mp4,mpegts,ogg,pcm_*,wav,webm,gif,image2
    --enable-muxer=adts,flac,ipod,matroska,mov,mp3,mp4,mpegts,ogg,pcm_*,wav,webm,gif,image2
    --enable-parser=aac,aac_latm,ac3,h264,hevc,mpegaudio,mpeg4video,opus,vorbis
    --enable-protocol=file,pipe,crypto
    --enable-filter=aformat,anull,atrim,concat,scale,trim,volume,fps,format,null,overlay,drawtext
    --enable-bsf=aac_adtstoasc,h264_mp4toannexb,hevc_mp4toannexb
"

build_ffmpeg() {
    local ABI=$1
    local CONFIG=${ABI_CONFIGS[$ABI]}
    
    IFS='|' read -r ARCH TARGET CPU <<< "$CONFIG"
    
    local PREFIX="$OUTPUT_DIR/$ABI"
    local CC="$TOOLCHAIN/bin/${TARGET}${ANDROID_API}-clang"
    local CXX="$TOOLCHAIN/bin/${TARGET}${ANDROID_API}-clang++"
    
    # Special handling for armeabi-v7a
    if [ "$ABI" == "armeabi-v7a" ]; then
        CC="$TOOLCHAIN/bin/armv7a-linux-androideabi${ANDROID_API}-clang"
        CXX="$TOOLCHAIN/bin/armv7a-linux-androideabi${ANDROID_API}-clang++"
    fi
    
    echo ""
    echo "============================================"
    echo "Building FFmpeg for $ABI"
    echo "  ARCH: $ARCH"
    echo "  TARGET: $TARGET"
    echo "  CPU: $CPU"
    echo "  PREFIX: $PREFIX"
    echo "============================================"
    echo ""
    
    # Clean previous build thoroughly
    make distclean 2>/dev/null || make clean 2>/dev/null || true
    
    # Configure
    ./configure \
        --prefix="$PREFIX" \
        --target-os=android \
        --arch=$ARCH \
        --cpu=$CPU \
        --cc="$CC" \
        --cxx="$CXX" \
        --enable-cross-compile \
        --cross-prefix="$TOOLCHAIN/bin/llvm-" \
        --nm="$TOOLCHAIN/bin/llvm-nm" \
        --ar="$TOOLCHAIN/bin/llvm-ar" \
        --ranlib="$TOOLCHAIN/bin/llvm-ranlib" \
        --strip="$TOOLCHAIN/bin/llvm-strip" \
        --extra-cflags="-fPIC -O2 -ffunction-sections -fdata-sections" \
        --extra-ldflags="-Wl,--gc-sections -Wl,--strip-all" \
        $COMMON_FLAGS \
        $CODEC_FLAGS
    
    # Build
    make -j$(nproc)
    
    # Install
    make install
    
    # Strip binaries further
    "$TOOLCHAIN/bin/llvm-strip" --strip-unneeded "$PREFIX/lib/"*.so 2>/dev/null || true
    
    echo "Built $ABI successfully"
}

# Main build process
mkdir -p "$OUTPUT_DIR"

# Check if we're in FFmpeg source directory
if [ ! -f "configure" ]; then
    if [ -d "/src/ffmpeg" ]; then
        cd /src/ffmpeg
    else
        echo "ERROR: Not in FFmpeg source directory and /src/ffmpeg not found"
        echo "Please run this script from the FFmpeg source directory"
        exit 1
    fi
fi

# Build for each ABI in a defined order (arm64 first as it's most common)
for ABI in arm64-v8a armeabi-v7a x86_64; do
    build_ffmpeg "$ABI"
done

# Create summary
echo ""
echo "============================================"
echo "Build Complete!"
echo "============================================"
echo ""
echo "Output locations:"
for ABI in "${!ABI_CONFIGS[@]}"; do
    echo "  $ABI: $OUTPUT_DIR/$ABI/lib/"
    ls -la "$OUTPUT_DIR/$ABI/lib/"*.so 2>/dev/null | awk '{print "    " $NF ": " $5 " bytes"}'
done

# Calculate total size
TOTAL_SIZE=$(find "$OUTPUT_DIR" -name "*.so" -exec stat -f%z {} + 2>/dev/null | awk '{sum+=$1} END {print sum}' || \
             find "$OUTPUT_DIR" -name "*.so" -exec stat -c%s {} + 2>/dev/null | awk '{sum+=$1} END {print sum}')
echo ""
echo "Total size: $((TOTAL_SIZE / 1024 / 1024)) MB"
