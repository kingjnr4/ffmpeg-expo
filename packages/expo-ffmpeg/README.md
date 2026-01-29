# ffmpeg-expo

Native FFmpeg for Expo/React Native - on-device video and audio processing without relying on the discontinued ffmpeg-kit.

## Features

- Native FFmpeg execution on Android and iOS
- Progress tracking during encoding
- Session cancellation support
- Prebuilt binaries downloaded automatically at install time
- Expo config plugin for seamless integration
- TypeScript support with full type definitions
- LGPL-compliant (no GPL codecs)

## Installation

```bash
npx expo install ffmpeg-expo
```

The postinstall script will automatically download prebuilt FFmpeg binaries for your platform from GitHub Releases.

### Expo Config Plugin

Add the plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": ["ffmpeg-expo"]
  }
}
```

Then run prebuild:

```bash
npx expo prebuild
```

## Usage

### Basic Video Compression

```typescript
import { execute, FFmpegError } from 'ffmpeg-expo';

async function compressVideo(inputPath: string, outputPath: string) {
  try {
    const result = await execute([
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y',
      outputPath,
    ]);
    
    console.log('Compression complete!', result.duration);
  } catch (error) {
    if (error instanceof FFmpegError) {
      console.error('FFmpeg failed:', error.returnCode, error.output);
    }
  }
}
```

### With Progress Tracking

```typescript
import { run } from 'ffmpeg-expo';
import type { FFmpegProgress } from 'ffmpeg-expo';

function compressWithProgress(inputPath: string, outputPath: string) {
  const session = run([
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '28',
    outputPath,
  ], {
    onProgress: (progress: FFmpegProgress) => {
      if (progress.totalDuration) {
        const percent = (progress.time / progress.totalDuration) * 100;
        console.log(`Progress: ${percent.toFixed(1)}%`);
      }
      console.log(`Speed: ${progress.speed}x`);
    },
    onLog: (log) => {
      console.log(`[${log.level}] ${log.message}`);
    },
    logLevel: 'info',
  });

  // Cancel if needed
  // session.cancel();

  return session.result;
}
```

### Get FFmpeg Version

```typescript
import { getVersion } from 'ffmpeg-expo';

const version = getVersion();
console.log(`FFmpeg ${version.version}`);
console.log(`Major: ${version.major}, Minor: ${version.minor}, Patch: ${version.patch}`);
```

## API Reference

### `run(args, options?)`

Execute an FFmpeg command with full control over the session.

**Parameters:**
- `args: string[]` - FFmpeg arguments (without the 'ffmpeg' prefix)
- `options?: RunOptions` - Optional configuration

**Returns:** `FFmpegSession` object with:
- `id: string` - Unique session identifier
- `cancel(): Promise<boolean>` - Cancel the session
- `result: Promise<FFmpegResult>` - Promise resolving when complete

### `execute(args, options?)`

Execute an FFmpeg command and await the result. Throws `FFmpegError` on failure.

**Parameters:**
- `args: string[]` - FFmpeg arguments
- `options?: RunOptions` - Optional configuration

**Returns:** `Promise<FFmpegResult>`

### `getVersion()`

Get FFmpeg version information.

**Returns:** `FFmpegVersion` object with `version`, `major`, `minor`, `patch`

### Types

```typescript
interface RunOptions {
  onProgress?: (progress: FFmpegProgress) => void;
  onLog?: (log: FFmpegLog) => void;
  logLevel?: FFmpegLogLevel;
  env?: Record<string, string>;
}

interface FFmpegProgress {
  sessionId: string;
  time: number;        // Current position in ms
  bitrate: number;     // kbits/s
  speed: number;       // e.g., 1.5 = 1.5x realtime
  frame?: number;      // Current frame (video)
  fps?: number;        // Frames per second
  size?: number;       // Output size in bytes
  totalDuration?: number;  // Total duration in ms
}

interface FFmpegResult {
  returnCode: number;  // 0 = success
  output: string;      // Combined stdout/stderr
  duration: number;    // Execution time in ms
}

type FFmpegLogLevel = 
  | 'quiet' | 'panic' | 'fatal' | 'error' 
  | 'warning' | 'info' | 'verbose' | 'debug' | 'trace';
```

## Included Codecs

This package is built with commonly used codecs:

**Video Decoders:** H.264, HEVC (H.265), VP8, VP9, AV1, MPEG-4, ProRes, GIF, PNG, JPEG

**Video Encoders:** libx264 (H.264), MPEG-4, GIF, PNG, JPEG

**Audio Decoders:** AAC, MP3, Vorbis, Opus, FLAC, PCM variants

**Audio Encoders:** AAC, MP3 (libmp3lame), Opus, FLAC, PCM variants

**Containers:** MP4, MOV, MKV, WebM, AVI, FLV, GIF, MP3, WAV, OGG, FLAC

## Platform Support

| Platform | Architectures |
|----------|---------------|
| Android  | arm64-v8a, armeabi-v7a, x86_64 |
| iOS      | arm64 (device), arm64 + x86_64 (simulator) |

**Minimum Requirements:**
- Android: API 21 (Android 5.0)
- iOS: 13.0

## Expo Config Plugin Options

```javascript
// app.config.js
export default {
  plugins: [
    ['ffmpeg-expo', {
      enableDecoders: ['h264', 'hevc', 'aac', 'mp3'],
      enableEncoders: ['aac', 'libx264'],
    }],
  ],
};
```

## Troubleshooting

### Binaries not found

If the postinstall script fails to download binaries, you can manually download them:

```bash
# In node_modules/ffmpeg-expo
node scripts/postinstall.js
```

Or download directly from the [GitHub Releases](https://github.com/kingjnr4/ffmpeg-expo/releases) page.

### Build errors on Android

Ensure your `android/build.gradle` has the correct NDK version:

```gradle
buildscript {
    ext {
        ndkVersion = "25.1.8937393"
    }
}
```

### Build errors on iOS

Make sure CocoaPods dependencies are up to date:

```bash
cd ios && pod install --repo-update
```

## Building from Source

See [BUILDING_BINARIES.md](https://github.com/kingjnr4/ffmpeg-expo/blob/main/packages/expo-ffmpeg/docs/BUILDING_BINARIES.md) for instructions on building FFmpeg binaries yourself.

## License

This package is licensed under the MIT License.

FFmpeg itself is licensed under LGPL 2.1. This package uses an LGPL-only build without GPL components to simplify licensing compliance. See [LICENSING.md](https://github.com/kingjnr4/ffmpeg-expo/blob/main/packages/expo-ffmpeg/docs/LICENSING.md) for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a pull request.

## Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - The multimedia framework
- [Expo](https://expo.dev/) - The platform this module is built for
