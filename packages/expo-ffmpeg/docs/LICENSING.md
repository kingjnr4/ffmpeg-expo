# Licensing Information

This document explains the licensing of ffmpeg-expo and FFmpeg, and your obligations when using this package.

## Summary

| Component | License |
|-----------|---------|
| ffmpeg-expo (this package) | MIT |
| FFmpeg libraries (prebuilt) | LGPL 2.1 |
| Your application | Your choice (with LGPL compliance) |

## ffmpeg-expo Package License

The ffmpeg-expo package code (TypeScript, Kotlin, Swift, C++ wrapper code) is licensed under the MIT License:

```
MIT License

Copyright (c) 2024 ffmpeg-expo contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## FFmpeg License

The prebuilt FFmpeg binaries distributed with this package are built under **LGPL 2.1** (Lesser General Public License).

### Why LGPL?

FFmpeg can be built under different licenses depending on which features are enabled:

- **LGPL 2.1** - Base FFmpeg without GPL components
- **GPL 2.0/3.0** - When GPL-licensed codecs are included (e.g., libx264, libx265)

This package uses an **LGPL-only build** to simplify compliance for app developers. This means:

1. You can use this package in proprietary/closed-source applications
2. You don't need to release your app's source code
3. You only need to comply with LGPL requirements (see below)

### Excluded GPL Components

The following popular codecs are **not included** because they would require GPL licensing:

- libx264 (H.264 encoder) - We use FFmpeg's native encoders instead
- libx265 (HEVC encoder)
- libmp3lame (MP3 encoder)
- libvpx, libopus, libvorbis, libass, and libdav1d
- Some filters and features

If you need these codecs, see [Building with GPL Codecs](#building-with-gpl-codecs) below.

## Your LGPL Compliance Obligations

When you distribute an app using ffmpeg-expo, you must comply with LGPL 2.1. Here's what you need to do:

### 1. Attribution

Include attribution to FFmpeg in your app. This can be in:
- An "About" screen
- Your app's settings
- A licenses/credits section

Example text:
```
This app uses FFmpeg, licensed under the LGPL 2.1.
https://ffmpeg.org/
```

### 2. License Text

Make the LGPL 2.1 license text available to users. Options:
- Include it in an in-app licenses section
- Link to https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html

### 3. Source Code Offer

You must provide a way for users to obtain the FFmpeg source code. Options:

**Option A (Easiest):** Link to the official FFmpeg source
```
FFmpeg source code is available at: https://ffmpeg.org/download.html
```

**Option B:** Host the exact source version used
If you modify FFmpeg or want to provide the exact version, host the source code and provide a link.

### 4. Allow Library Replacement (Technical Requirement)

LGPL requires that users can replace the LGPL library with their own version. For mobile apps, this is typically satisfied by:

- **Android:** FFmpeg is packaged as shared libraries (`.so` files).
- **iOS:** FFmpeg is packaged as static libraries inside an XCFramework. Static linking can add LGPL compliance obligations around relinking or object-file availability.

Consult legal counsel for distribution requirements, especially for iOS static linking and app store distribution.

## Attribution Template

You can copy this template for your app's attribution:

```
Open Source Licenses

FFmpeg
-------
This application uses FFmpeg (https://ffmpeg.org/), a complete, 
cross-platform solution to record, convert and stream audio and video.

FFmpeg is licensed under the GNU Lesser General Public License (LGPL) 
version 2.1 or later. The LGPL license is available at:
https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html

FFmpeg source code is available at:
https://ffmpeg.org/download.html

ffmpeg-expo
-----------
React Native/Expo wrapper for FFmpeg
Licensed under the MIT License
https://github.com/kingjnr4/ffmpeg-expo
```

## Building with GPL Codecs

If you need GPL-licensed codecs (like libx264 for H.264 encoding), you can build FFmpeg yourself with GPL enabled. **This will change your obligations:**

### GPL Requirements

1. **Source Code Release:** You must make your complete app's source code available under GPL
2. **License Change:** Your app must be distributed under GPL-compatible terms
3. **Attribution:** Same as LGPL, plus GPL license text

### How to Build GPL Version

Edit the build scripts to enable GPL:

```bash
./configure \
    --enable-gpl \
    --enable-libx264 \
    --enable-libx265 \
    # ... other options
```

**Warning:** Only do this if you understand and accept GPL obligations. For most commercial apps, the LGPL build is preferable.

## Codec-Specific Licenses

Some codecs have their own licenses in addition to FFmpeg's:

| Codec | License | Notes |
|-------|---------|-------|
| AAC (native) | LGPL | Part of FFmpeg |
| MP3 decode/demux/mux | LGPL | Native FFmpeg components; `libmp3lame` is not included |
| H.264 decoder | LGPL | Patent considerations may apply |
| HEVC decoder | LGPL | Patent considerations may apply |
| VP8/VP9 decode | LGPL | Native FFmpeg components; external `libvpx` is not included |
| Opus decode | LGPL | Native FFmpeg component; external `libopus` is not included |
| FLAC decode/demux/mux | LGPL | FLAC encoding is not enabled in the default binaries |

### Patent Considerations

Some video codecs (H.264, HEVC, AAC) may be covered by patents in certain jurisdictions. This is separate from software licensing:

- **H.264/AVC:** MPEG LA patent pool
- **HEVC/H.265:** Multiple patent pools (MPEG LA, HEVC Advance, others)
- **AAC:** Patent licensing through Via Licensing

For personal/non-commercial use, these patents are generally not a concern. For commercial distribution, consult with legal counsel regarding patent licensing in your target markets.

## Questions?

### Can I use this in a commercial app?

Yes! The LGPL build allows commercial use. Just follow the compliance steps above.

### Do I need to open-source my app?

No, not with the LGPL build. You only need to provide attribution and a way to get FFmpeg source.

### What if I modify FFmpeg itself?

If you modify the FFmpeg libraries (not just the wrapper), you must:
1. Make your modifications available under LGPL
2. Clearly indicate what you changed

### Can I use this in an app I sell?

Yes, you can sell apps that use ffmpeg-expo. The LGPL doesn't restrict commercial use.

### What about the App Store / Play Store?

Both stores allow LGPL software. The main consideration is that LGPL technically requires allowing library replacement, which may conflict with code signing requirements. In practice, this hasn't been an enforcement issue for mobile apps, but it's a theoretical concern.

## Resources

- [FFmpeg Legal](https://ffmpeg.org/legal.html)
- [LGPL 2.1 Full Text](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html)
- [LGPL FAQ](https://www.gnu.org/licenses/gpl-faq.html)
- [FFmpeg Licensing Explanation](https://ffmpeg.org/doxygen/trunk/md_LICENSE.html)
