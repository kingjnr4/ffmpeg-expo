# ffmpeg-expo

Native FFmpeg support for Expo and React Native apps.

Use this package for basic on-device remux/copy operations, progress updates, logs, cancellation, and FFmpeg version information. Advanced transcoding recipes such as CRF/preset compression, MP3 encoding, H.265 encoding, VP9 encoding, subtitles, filters, and multi-input mapping are not supported by the default package.

## Features

- Android and iOS native FFmpeg binaries
- Basic remux/copy command support
- Progress and log callbacks
- Session cancellation
- Expo config plugin
- TypeScript definitions
- LGPL-only FFmpeg build with no GPL codecs

## Requirements

| Requirement | Version |
| --- | --- |
| Expo SDK | `>=56.0.0` |
| React Native | `>=0.85.0` |
| React | `>=19.2.0` |
| Node.js | `>=22.13.0` |
| Android | Android 7.0+ / API 24+ |
| iOS | 16.4+ |

Expo Go is not supported because this package includes native code. Use an Expo development build, a prebuilt native project, or a bare React Native app.

## Installation

```bash
npx expo install ffmpeg-expo
```

The package downloads prebuilt FFmpeg binaries during install.

## Expo Setup

Add the config plugin, then run prebuild.

```json
{
  "expo": {
    "plugins": [
      [
        "ffmpeg-expo",
        {
          "includeX86": true
        }
      ]
    ]
  }
}
```

```bash
npx expo prebuild
```

### Plugin Options

| Option | Default | Use it for |
| --- | --- | --- |
| `includeX86` | `false` | Including Android x86_64 emulator binaries in generated ABI filters. |
| `ndkVersion` | `26.1.10909125` | Overriding the Android NDK version written during prebuild. |
| `binaryUrl` | unset | Reserved for self-hosted binary setups. Not needed for normal installs. |

`app.config.js` example:

```javascript
export default {
  expo: {
    plugins: [
      [
        'ffmpeg-expo',
        {
          includeX86: true,
          ndkVersion: '26.1.10909125',
        },
      ],
    ],
  },
};
```

The config plugin does not change FFmpeg codec support. Custom codec builds require custom binaries.

## Bare React Native Setup

- Run `pod install` after installing or updating the package.
- Include Android ABI filters for the ABIs you ship: `arm64-v8a`, `armeabi-v7a`, and optionally `x86_64` for emulators.
- Keep the downloaded native binaries in the package `android/jniLibs` and `ios/Frameworks` directories.

## Usage

### Basic Remux

```typescript
import { execute, FFmpegError } from 'ffmpeg-expo';

async function remux(inputPath: string, outputPath: string) {
  try {
    const result = await execute(['-i', inputPath, '-y', outputPath]);
    console.log('Finished', result.returnCode, result.duration);
  } catch (error) {
    if (error instanceof FFmpegError) {
      console.error('FFmpeg failed:', error.returnCode, error.output);
    }
  }
}
```

### Progress And Logs

```typescript
import { run } from 'ffmpeg-expo';

function remuxWithProgress(inputPath: string, outputPath: string) {
  const session = run(['-i', inputPath, '-y', outputPath], {
    onProgress: (progress) => {
      console.log(`Processed: ${progress.time}ms`);
      console.log(`Speed: ${progress.speed}x`);
    },
    onLog: (log) => {
      console.log(`[${log.level}] ${log.message}`);
    },
    logLevel: 'info',
  });

  return session.result;
}
```

Progress events include `sessionId`, `time`, `bitrate`, `speed`, `frame`, `fps`, and `size`.

### Cancellation

```typescript
const session = run(['-i', inputPath, '-y', outputPath]);

await session.cancel();
const result = await session.result;
```

Cancelled sessions finish with return code `255`. Partial output files are not deleted automatically.

### FFmpeg Version

```typescript
import { getVersion } from 'ffmpeg-expo';

const version = getVersion();
console.log(`FFmpeg ${version.version}`);
```

## API

### `run(args, options?)`

Starts a session and returns:

- `id`: session identifier.
- `cancel()`: requests cancellation.
- `result`: promise that resolves with the session result.

Supported command shape:

```typescript
run(['-i', inputPath, '-y', outputPath]);
```

### `execute(args, options?)`

Runs a command and resolves with the result. Throws `FFmpegError` when FFmpeg returns a non-zero code.

### `getVersion()`

Returns FFmpeg version information.

## Default Codec Support

The default binaries are LGPL-only and are intended for basic remux/copy workflows. They do not include GPL or external codec libraries such as `libx264`, `libx265`, `libmp3lame`, `libvpx`, `libopus`, `libvorbis`, `libass`, or `libdav1d`.

This means common recipes such as video compression with `libx264`, video to MP3, video to FLAC, H.264 to H.265, H.264 to VP9, subtitles, and multi-track mapping are not supported by default.

For the detailed binary build configuration, see [BUILDING_BINARIES.md](./packages/expo-ffmpeg/docs/BUILDING_BINARIES.md).

## Platform Binaries

| Platform | Architectures |
| --- | --- |
| Android | `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| iOS | `arm64` device, `arm64` + `x86_64` simulator |

## Troubleshooting

### Binaries not found

Run the install script again from the installed package:

```bash
node scripts/postinstall.js
```

The expected release assets are `ffmpeg-android.tar.gz` and `ffmpeg-ios.zip`.

### Android build errors

Check that your Android project uses a compatible NDK and ABI filters. The plugin default NDK version is `26.1.10909125`.

### iOS build errors

Run CocoaPods after native project generation or package updates:

```bash
cd ios && pod install --repo-update
```

## Building From Source

See [BUILDING_BINARIES.md](./packages/expo-ffmpeg/docs/BUILDING_BINARIES.md).

## License

This package is MIT licensed. FFmpeg is LGPL 2.1. See [LICENSING.md](./packages/expo-ffmpeg/docs/LICENSING.md).
