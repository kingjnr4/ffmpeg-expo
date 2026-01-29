# Building FFmpeg Binaries

This document explains how to build FFmpeg binaries for Android and iOS from source.

## Prerequisites

### Common Requirements

- Git
- At least 20GB of free disk space
- A fast internet connection (downloads ~2GB of dependencies)

### Android Requirements

- Docker (for consistent build environment)
- Or: Linux with Android NDK r25+ installed

### iOS Requirements

- macOS with Xcode Command Line Tools
- Homebrew (for installing dependencies)

## Building for Android

### Using Docker (Recommended)

The easiest way to build Android binaries is using Docker:

```bash
cd packages/ffmpeg-build/android

# Build the Docker image
docker build -t ffmpeg-android-builder .

# Run the build (outputs to ./output/)
docker run --rm -v $(pwd)/output:/output ffmpeg-android-builder
```

This will produce:
- `output/arm64-v8a/` - 64-bit ARM libraries
- `output/armeabi-v7a/` - 32-bit ARM libraries
- `output/x86_64/` - x86_64 libraries (for emulators)

### Manual Build

If you prefer to build without Docker:

1. Install Android NDK r25 or newer
2. Set environment variables:

```bash
export ANDROID_NDK_HOME=/path/to/android-ndk-r25
export PATH=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH
```

3. Run the build script:

```bash
cd packages/ffmpeg-build/android
./build-ffmpeg.sh
```

### Build Options

Edit `build-ffmpeg.sh` to customize:

```bash
# FFmpeg version
FFMPEG_VERSION="6.1"

# Target architectures
ARCHS="arm64-v8a armeabi-v7a x86_64"

# Minimum Android API level
API_LEVEL=21
```

## Building for iOS

### Prerequisites

1. Install Xcode Command Line Tools:
```bash
xcode-select --install
```

2. Install dependencies via Homebrew:
```bash
brew install automake libtool pkg-config nasm
```

### Build Process

```bash
cd packages/ffmpeg-build/ios
./build-ffmpeg.sh
```

This will create:
- `output/FFmpeg.xcframework` - Universal framework for device and simulator

### Build Options

Edit `build-ffmpeg.sh` to customize:

```bash
# FFmpeg version
FFMPEG_VERSION="6.1"

# Target platforms
# - arm64 for physical devices
# - arm64-simulator + x86_64-simulator for simulators
PLATFORMS="arm64 arm64-simulator x86_64-simulator"

# Minimum iOS version
IOS_MIN_VERSION="13.0"
```

## Codec Selection

Both build scripts are configured to build commonly used codecs while maintaining LGPL compliance.

### Included by Default

**Decoders:**
- H.264, HEVC (H.265), VP8, VP9
- AV1 (via libdav1d)
- AAC, MP3, Vorbis, Opus, FLAC
- PNG, JPEG, GIF

**Encoders:**
- H.264 (via libx264)
- AAC, MP3 (via libmp3lame)
- Opus, FLAC
- PNG, JPEG, GIF

### Adding/Removing Codecs

To modify the codec selection, edit the `--enable-*` and `--disable-*` flags in the configure command:

```bash
./configure \
    --enable-decoder=h264 \
    --enable-decoder=hevc \
    --enable-encoder=aac \
    --disable-decoder=mpeg2video \
    # ... etc
```

### GPL Codecs

Some popular codecs like libx264 (H.264 encoder) are GPL-licensed. If you use them, your build becomes GPL:

```bash
# To enable GPL codecs (changes license!)
./configure \
    --enable-gpl \
    --enable-libx264 \
    --enable-libx265
```

**Warning:** Enabling GPL codecs requires you to comply with GPL licensing terms, which may require releasing source code of your application.

## Output Structure

### Android

```
output/
├── arm64-v8a/
│   ├── lib/
│   │   ├── libavcodec.so
│   │   ├── libavformat.so
│   │   ├── libavutil.so
│   │   ├── libswresample.so
│   │   └── libswscale.so
│   └── include/
│       └── libav*/
├── armeabi-v7a/
│   └── ...
└── x86_64/
    └── ...
```

### iOS

```
output/
└── FFmpeg.xcframework/
    ├── ios-arm64/
    │   └── FFmpeg.framework/
    ├── ios-arm64_x86_64-simulator/
    │   └── FFmpeg.framework/
    └── Info.plist
```

## Uploading to GitHub Releases

After building, package and upload the binaries:

### Android

```bash
cd output
tar -czvf ffmpeg-android-arm64-v8a.tar.gz arm64-v8a/
tar -czvf ffmpeg-android-armeabi-v7a.tar.gz armeabi-v7a/
tar -czvf ffmpeg-android-x86_64.tar.gz x86_64/
```

### iOS

```bash
cd output
zip -r ffmpeg-ios.zip FFmpeg.xcframework/
```

Then upload to your GitHub repository's Releases page.

## Troubleshooting

### Build fails with "nasm not found"

Install NASM:
```bash
# macOS
brew install nasm

# Ubuntu/Debian
apt-get install nasm

# The Docker build includes this automatically
```

### Android build fails with NDK errors

Ensure you're using a compatible NDK version (r25+) and that `ANDROID_NDK_HOME` is set correctly.

### iOS build fails with "arm64 slice not found"

Make sure you're building on an Apple Silicon Mac or that Rosetta is working correctly. The simulator build requires both arm64 and x86_64 slices.

### Library size is too large

Enable size optimization:

```bash
./configure \
    --enable-small \
    --disable-debug \
    # ... other options
```

You can also strip debug symbols:

```bash
# Android
$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip lib/*.so

# iOS (done automatically by Xcode during archive)
strip -x FFmpeg.framework/FFmpeg
```

## Verifying the Build

### Check Version

```bash
# The built ffmpeg binary (if enabled)
./ffmpeg -version

# Check library dependencies
# Android
readelf -d libavcodec.so | grep NEEDED

# iOS
otool -L FFmpeg.framework/FFmpeg
```

### Check Codecs

```bash
./ffmpeg -codecs | grep -E "(h264|hevc|aac|mp3)"
```

## CI Integration

The repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) that automatically builds binaries when a new tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers:
1. Android build (via Docker)
2. iOS build (on macOS runner)
3. Upload to GitHub Releases
4. npm publish

See the workflow file for details on customizing the CI process.
