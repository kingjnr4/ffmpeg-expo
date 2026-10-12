# ffmpeg-expo

## 0.2.0

### Minor Changes

- [#19](https://github.com/kingjnr4/ffmpeg-expo/pull/19) [`9bbc9a1`](https://github.com/kingjnr4/ffmpeg-expo/commit/9bbc9a171f4ffdea9d237b8e069e2d312e7dfc06) Thanks [@kingjnr4](https://github.com/kingjnr4)! - Embed the upstream FFmpeg command frontend so `run` and `execute` support the arguments and workflows enabled by the installed binary profile, including transcoding, filters, stream mapping, and multiple inputs.

  Add a shared LGPL `min` binary profile, serialized native execution, repeat-invocation cleanup, cooperative cancellation, and preview binary overrides for testing package builds before release.

- [#21](https://github.com/kingjnr4/ffmpeg-expo/pull/21) [`0a8a341`](https://github.com/kingjnr4/ffmpeg-expo/commit/0a8a341aeb7bb0680662da68f4b2bfe1c6063b47) Thanks [@kingjnr4](https://github.com/kingjnr4)! - Add a typed complex filtergraph builder with FFmpeg-aware option escaping and an argv helper for `run` and `execute`.

## 0.1.0

### Minor Changes

- [#9](https://github.com/kingjnr4/ffmpeg-expo/pull/9) [`158a2b1`](https://github.com/kingjnr4/ffmpeg-expo/commit/158a2b1134af15702d28427fae32bbca4ef63826) Thanks [@kingjnr4](https://github.com/kingjnr4)! - Require Expo SDK 56 and align the native module with the SDK 56 Expo Modules runtime, including React Native 0.85, React 19.2, iOS 16.4+,android 7+ and Node 22.13.0+ development support.

### Patch Changes

- [#15](https://github.com/kingjnr4/ffmpeg-expo/pull/15) [`92a819c`](https://github.com/kingjnr4/ffmpeg-expo/commit/92a819c8fa51a12b7598960b7ec5f41b3823f4d7) Thanks [@kingjnr4](https://github.com/kingjnr4)! - Fixes Android FFmpeg argument corruption during command execution by preserving native argv pointer validity before parsing.

- [#14](https://github.com/kingjnr4/ffmpeg-expo/pull/14) [`4a36365`](https://github.com/kingjnr4/ffmpeg-expo/commit/4a36365cf2cdcd3baba00b9cbe30dcd4d9c6ee1c) Thanks [@kingjnr4](https://github.com/kingjnr4)! - Fix Android Expo autolinking by disabling Expo's local Maven publication path for the source-built module and stop overriding the app's NDK version unless explicitly configured.

## 0.0.2

### Patch Changes

- [#6](https://github.com/kingjnr4/ffmpeg-expo/pull/6) [`4aa220d`](https://github.com/kingjnr4/ffmpeg-expo/commit/4aa220dabeb93f9c897957597da9ece1e09a1976) Thanks [@kingjnr4](https://github.com/kingjnr4)! - Changed ffmpeg binary tag to match the new versioning scheme

- [#3](https://github.com/kingjnr4/ffmpeg-expo/pull/3) [`070ff5c`](https://github.com/kingjnr4/ffmpeg-expo/commit/070ff5cf174901cbec2abbb7bb4400faa345aee8) Thanks [@kingjnr4](https://github.com/kingjnr4)! - Fix binary release tag configuration and package metadata for the decoupled release workflow.
