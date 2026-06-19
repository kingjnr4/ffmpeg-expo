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
- Java 17 for Android project builds

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

# Minimum Android API level (Android 7+)
ANDROID_API=24
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
IOS_MIN_VERSION="16.4"
```

## Codec Selection

Both build scripts are configured to build commonly used codecs while maintaining LGPL compliance.

### Included by Default

These are the FFmpeg components included by the current build scripts. App support still depends on what the package API exposes.

| Component | Android | iOS |
| --- | --- | --- |
| Decoders | `aac`, `aac_latm`, `ac3`, `h264`, `hevc`, `mp3`, `mpeg4`, `vorbis`, `opus`, `flac`, `pcm_*`, `vp8`, `vp9`, `gif`, `png`, `mjpeg` | `aac`, `aac_latm`, `ac3`, `h264`, `hevc`, `mp3`, `mpeg4`, `vorbis`, `opus`, `flac`, `pcm_*`, `vp8`, `vp9`, `av1` |
| Encoders | `aac`, `mpeg4`, `pcm_*`, `gif`, `png`, `mjpeg` | `aac`, `mpeg4`, `pcm_*` |
| Demuxers | `aac`, `ac3`, `avi`, `flac`, `h264`, `hevc`, `matroska`, `mov`, `mp3`, `mp4`, `mpegts`, `ogg`, `pcm_*`, `wav`, `webm`, `gif`, `image2` | `aac`, `ac3`, `avi`, `flac`, `h264`, `hevc`, `matroska`, `mov`, `mp3`, `mp4`, `mpegts`, `ogg`, `pcm_*`, `wav`, `webm` |
| Muxers | `adts`, `flac`, `ipod`, `matroska`, `mov`, `mp3`, `mp4`, `mpegts`, `ogg`, `pcm_*`, `wav`, `webm`, `gif`, `image2` | `adts`, `flac`, `ipod`, `matroska`, `mov`, `mp3`, `mp4`, `mpegts`, `ogg`, `pcm_*`, `wav`, `webm` |
| Filters | `aformat`, `anull`, `atrim`, `concat`, `scale`, `trim`, `volume`, `fps`, `format`, `null`, `overlay`, `drawtext` | `aformat`, `anull`, `atrim`, `concat`, `scale`, `trim`, `volume`, `fps`, `format`, `null` |

The default build scripts do not enable external libraries such as `libx264`, `libx265`, `libmp3lame`, `libvpx`, `libopus`, `libvorbis`, `libass`, or `libdav1d`. FLAC decode/demux/mux is enabled, but FLAC encoding is not enabled. Subtitle support such as `mov_text`, `srt`, `ass`, the `subtitles` filter, and `libass` is not enabled.

### Adding/Removing Codecs

To modify codec selection, edit the `--enable-*` and `--disable-*` flags in the build scripts, rebuild binaries, publish or host the new artifacts, and point the package at those artifacts:

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
    │   └── libffmpeg.a
    ├── ios-arm64_x86_64-simulator/
    │   └── libffmpeg.a
    └── Info.plist
```

## Uploading to GitHub Releases

After building, package and upload the binaries:

### Android

```bash
cd output
mkdir -p jniLibs
for arch in arm64-v8a armeabi-v7a x86_64; do
  mkdir -p "jniLibs/${arch}"
  cp android/${arch}/lib/*.so "jniLibs/${arch}/"
done
tar -czvf ffmpeg-android.tar.gz -C jniLibs .
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

# iOS static libraries are packaged in FFmpeg.xcframework.
strip -x output/ios/FFmpeg.xcframework/ios-arm64/libffmpeg.a
```

## Verifying the Build

### Check Libraries

```bash
# Check library dependencies
# Android
readelf -d output/android/arm64-v8a/lib/libavcodec.so

# iOS
file output/ios/FFmpeg.xcframework/ios-arm64/libffmpeg.a
```

## CI Integration

The repository includes a manually triggered GitHub Actions workflow (`.github/workflows/ffmpeg-binaries.yml`) that builds and publishes binary release assets:

```bash
gh workflow run ffmpeg-binaries.yml -f ffmpeg_version=6.1.1 -f binary_release_tag=ffmpeg-6.1.1-r1
```

This triggers:
1. Android build on Ubuntu
2. iOS build on macOS
3. Upload of `ffmpeg-android.tar.gz`, `ffmpeg-ios.zip`, and checksums to a GitHub Release

See the workflow file for details on customizing the CI process.
