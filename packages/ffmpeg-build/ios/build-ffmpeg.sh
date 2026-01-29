#!/bin/bash
set -e

# FFmpeg iOS Build Script
# Builds static libraries and creates XCFramework for arm64 (device) and x86_64/arm64 (simulator)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FFMPEG_VERSION="${FFMPEG_VERSION:-6.1.1}"
IOS_MIN_VERSION="${IOS_MIN_VERSION:-13.0}"
OUTPUT_DIR="${OUTPUT_DIR:-$SCRIPT_DIR/../../../output/ios}"

# Xcode detection
if ! command -v xcrun &> /dev/null; then
    echo "ERROR: Xcode command line tools not found"
    echo "Install with: xcode-select --install"
    exit 1
fi

XCODE_PATH=$(xcode-select -p)
echo "Using Xcode: $XCODE_PATH"

# Architecture configurations
# Format: "sdk|arch|host|deployment_target_flag"
declare -a ARCH_CONFIGS=(
    "iphoneos|arm64|aarch64-apple-darwin|-mios-version-min=$IOS_MIN_VERSION"
    "iphonesimulator|arm64|aarch64-apple-darwin|-mios-simulator-version-min=$IOS_MIN_VERSION"
    "iphonesimulator|x86_64|x86_64-apple-darwin|-mios-simulator-version-min=$IOS_MIN_VERSION"
)

# Common FFmpeg configure flags
COMMON_FLAGS="
    --enable-static
    --disable-shared
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
    --disable-gpl
    --disable-nonfree
    --enable-pic
    --disable-debug
    --disable-symver
    --enable-hardcoded-tables
    --enable-videotoolbox
    --enable-audiotoolbox
    --disable-avdevice
    --disable-indev=audiotoolbox
    --disable-outdev=audiotoolbox
"

# Enabled components for "most used codecs"
CODEC_FLAGS="
    --enable-decoder=aac,aac_latm,ac3,h264,hevc,mp3,mpeg4,vorbis,opus,flac,pcm_*,vp8,vp9,av1
    --enable-encoder=aac,mpeg4,pcm_*
    --enable-demuxer=aac,ac3,avi,flac,h264,hevc,matroska,mov,mp3,mp4,mpegts,ogg,pcm_*,wav,webm
    --enable-muxer=adts,flac,ipod,matroska,mov,mp3,mp4,mpegts,ogg,pcm_*,wav,webm
    --enable-parser=aac,aac_latm,ac3,h264,hevc,mpegaudio,mpeg4video,opus,vorbis
    --enable-protocol=file,pipe,crypto
    --enable-filter=aformat,anull,atrim,concat,scale,trim,volume,fps,format,null
    --enable-bsf=aac_adtstoasc,h264_mp4toannexb,hevc_mp4toannexb
    --enable-hwaccel=h264_videotoolbox,hevc_videotoolbox
"

build_ffmpeg() {
    local CONFIG=$1
    IFS='|' read -r SDK ARCH HOST DEPLOYMENT_FLAG <<< "$CONFIG"
    
    local SDK_PATH=$(xcrun --sdk $SDK --show-sdk-path)
    local CC=$(xcrun --sdk $SDK -f clang)
    local PREFIX="$OUTPUT_DIR/build/$SDK-$ARCH"
    
    echo ""
    echo "============================================"
    echo "Building FFmpeg for $SDK ($ARCH)"
    echo "  SDK Path: $SDK_PATH"
    echo "  Host: $HOST"
    echo "  Prefix: $PREFIX"
    echo "============================================"
    echo ""
    
    # Clean previous build - must use distclean to remove ALL object files and archives
    # to prevent mixing architectures (arm64 vs x86_64)
    make distclean 2>/dev/null || true
    
    # Extra flags for bitcode (disabled - FFmpeg doesn't support it well)
    local EXTRA_CFLAGS="-arch $ARCH -isysroot $SDK_PATH $DEPLOYMENT_FLAG -O2 -ffunction-sections -fdata-sections"
    local EXTRA_LDFLAGS="-arch $ARCH -isysroot $SDK_PATH $DEPLOYMENT_FLAG -Wl,-dead_strip"
    
    # Configure
    ./configure \
        --prefix="$PREFIX" \
        --target-os=darwin \
        --arch=$ARCH \
        --cc="$CC" \
        --enable-cross-compile \
        --sysroot="$SDK_PATH" \
        --extra-cflags="$EXTRA_CFLAGS" \
        --extra-ldflags="$EXTRA_LDFLAGS" \
        $COMMON_FLAGS \
        $CODEC_FLAGS
    
    # Build
    make -j$(sysctl -n hw.ncpu)
    
    # Install
    make install
    
    echo "Built $SDK-$ARCH successfully"
}

create_fat_library() {
    local SDK=$1
    local OUTPUT_LIB=$2
    shift 2
    local INPUTS=("$@")
    
    echo "Creating fat library: $OUTPUT_LIB"
    mkdir -p "$(dirname "$OUTPUT_LIB")"
    
    lipo -create "${INPUTS[@]}" -output "$OUTPUT_LIB"
}

create_xcframework() {
    echo ""
    echo "============================================"
    echo "Creating XCFramework"
    echo "============================================"
    echo ""
    
    local XCFRAMEWORK_DIR="$OUTPUT_DIR/FFmpeg.xcframework"
    rm -rf "$XCFRAMEWORK_DIR"
    
    # Libraries to include
    local LIBS=("libavcodec" "libavformat" "libavutil" "libswresample" "libswscale")
    
    # First, create combined static libraries per platform
    # Device (arm64)
    local DEVICE_DIR="$OUTPUT_DIR/combined/iphoneos"
    mkdir -p "$DEVICE_DIR"
    
    libtool -static -o "$DEVICE_DIR/libffmpeg.a" \
        "$OUTPUT_DIR/build/iphoneos-arm64/lib/libavcodec.a" \
        "$OUTPUT_DIR/build/iphoneos-arm64/lib/libavformat.a" \
        "$OUTPUT_DIR/build/iphoneos-arm64/lib/libavutil.a" \
        "$OUTPUT_DIR/build/iphoneos-arm64/lib/libswresample.a" \
        "$OUTPUT_DIR/build/iphoneos-arm64/lib/libswscale.a"
    
    # Copy headers
    cp -R "$OUTPUT_DIR/build/iphoneos-arm64/include" "$DEVICE_DIR/"
    
    # Simulator (arm64 + x86_64 fat binary)
    local SIM_DIR="$OUTPUT_DIR/combined/iphonesimulator"
    mkdir -p "$SIM_DIR"
    
    # Create fat libraries for simulator
    for lib in "${LIBS[@]}"; do
        lipo -create \
            "$OUTPUT_DIR/build/iphonesimulator-arm64/lib/${lib}.a" \
            "$OUTPUT_DIR/build/iphonesimulator-x86_64/lib/${lib}.a" \
            -output "$OUTPUT_DIR/build/iphonesimulator-fat/lib/${lib}.a" 2>/dev/null || \
        mkdir -p "$OUTPUT_DIR/build/iphonesimulator-fat/lib" && \
        lipo -create \
            "$OUTPUT_DIR/build/iphonesimulator-arm64/lib/${lib}.a" \
            "$OUTPUT_DIR/build/iphonesimulator-x86_64/lib/${lib}.a" \
            -output "$OUTPUT_DIR/build/iphonesimulator-fat/lib/${lib}.a"
    done
    
    libtool -static -o "$SIM_DIR/libffmpeg.a" \
        "$OUTPUT_DIR/build/iphonesimulator-fat/lib/libavcodec.a" \
        "$OUTPUT_DIR/build/iphonesimulator-fat/lib/libavformat.a" \
        "$OUTPUT_DIR/build/iphonesimulator-fat/lib/libavutil.a" \
        "$OUTPUT_DIR/build/iphonesimulator-fat/lib/libswresample.a" \
        "$OUTPUT_DIR/build/iphonesimulator-fat/lib/libswscale.a"
    
    # Copy headers
    cp -R "$OUTPUT_DIR/build/iphonesimulator-arm64/include" "$SIM_DIR/"
    
    # Create XCFramework
    xcodebuild -create-xcframework \
        -library "$DEVICE_DIR/libffmpeg.a" \
        -headers "$DEVICE_DIR/include" \
        -library "$SIM_DIR/libffmpeg.a" \
        -headers "$SIM_DIR/include" \
        -output "$XCFRAMEWORK_DIR"
    
    echo "Created XCFramework at: $XCFRAMEWORK_DIR"
}

# Main build process
mkdir -p "$OUTPUT_DIR/build"

# Check if we're in FFmpeg source directory
if [ ! -f "configure" ]; then
    FFMPEG_SRC="$SCRIPT_DIR/../../../ffmpeg-$FFMPEG_VERSION"
    if [ -d "$FFMPEG_SRC" ]; then
        cd "$FFMPEG_SRC"
    else
        echo "ERROR: Not in FFmpeg source directory"
        echo "Please run this script from the FFmpeg source directory or set FFMPEG_VERSION"
        echo "Expected: $FFMPEG_SRC"
        exit 1
    fi
fi

echo "Building FFmpeg $FFMPEG_VERSION for iOS"
echo "Minimum iOS version: $IOS_MIN_VERSION"
echo ""

# Build for each architecture
for CONFIG in "${ARCH_CONFIGS[@]}"; do
    build_ffmpeg "$CONFIG"
done

# Create XCFramework
create_xcframework

# Create summary
echo ""
echo "============================================"
echo "Build Complete!"
echo "============================================"
echo ""
echo "XCFramework: $OUTPUT_DIR/FFmpeg.xcframework"
echo ""

# Show sizes
echo "Library sizes:"
find "$OUTPUT_DIR/FFmpeg.xcframework" -name "*.a" -exec sh -c 'echo "  $(basename $(dirname $(dirname {}))): $(du -h {} | cut -f1)"' \;

TOTAL_SIZE=$(du -sh "$OUTPUT_DIR/FFmpeg.xcframework" | cut -f1)
echo ""
echo "Total XCFramework size: $TOTAL_SIZE"
