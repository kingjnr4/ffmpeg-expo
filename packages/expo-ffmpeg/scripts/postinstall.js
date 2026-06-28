#!/usr/bin/env node

/**
 * Postinstall script for ffmpeg-expo
 * Downloads prebuilt FFmpeg binaries for Android and iOS
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const packageJson = require('../package.json');
const BINARY_VERSION = packageJson.ffmpegExpo?.binaryReleaseTag;
const FFMPEG_VERSION =
  packageJson.ffmpegExpo?.ffmpegVersion ||
  BINARY_VERSION?.match(/^ffmpeg-(.+)-r\d+$/)?.[1];

if (!BINARY_VERSION) {
  throw new Error('Missing ffmpegExpo.binaryReleaseTag in package.json');
}

const BASE_URL = `https://github.com/kingjnr4/ffmpeg-expo/releases/download/${BINARY_VERSION}`;

const PACKAGE_DIR = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(PACKAGE_DIR, 'android', 'jniLibs');
const ANDROID_INCLUDE_DIR = path.join(PACKAGE_DIR, 'android', 'include');
const IOS_DIR = path.join(PACKAGE_DIR, 'ios', 'Frameworks');
const ANDROID_HEADER_DIRS = ['libavcodec', 'libavformat', 'libavutil', 'libswresample', 'libswscale'];

/**
 * Download a file from URL
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (urlString) => {
      https
        .get(urlString, (response) => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            request(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode}`));
            return;
          }

          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    };

    request(url);
  });
}

/**
 * Extract archive
 */
function extract(archive, dest, type) {
  try {
    if (type === 'tar.gz') {
      execSync(`tar -xzf "${archive}" -C "${dest}"`, { stdio: 'pipe' });
    } else if (type === 'tar.bz2') {
      execSync(`tar -xjf "${archive}" -C "${dest}"`, { stdio: 'pipe' });
    } else if (type === 'zip') {
      execSync(`unzip -q -o "${archive}" -d "${dest}"`, { stdio: 'pipe' });
    }
    return true;
  } catch (error) {
    console.error(`Failed to extract ${archive}:`, error.message);
    return false;
  }
}

function copyHeaderFiles(sourceDir, destDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyHeaderFiles(sourcePath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.h')) {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

function writeAndroidGeneratedHeaders() {
  const avconfigPath = path.join(ANDROID_INCLUDE_DIR, 'libavutil', 'avconfig.h');
  fs.mkdirSync(path.dirname(avconfigPath), { recursive: true });
  fs.writeFileSync(
    avconfigPath,
    [
      '#ifndef AVUTIL_AVCONFIG_H',
      '#define AVUTIL_AVCONFIG_H',
      '#define AV_HAVE_BIGENDIAN 0',
      '#define AV_HAVE_FAST_UNALIGNED 1',
      '#endif /* AVUTIL_AVCONFIG_H */',
      '',
    ].join('\n')
  );
}

/**
 * Check if binaries already exist
 */
function binariesExist(platform) {
  if (platform === 'android') {
    return fs.existsSync(path.join(ANDROID_DIR, 'arm64-v8a', 'libavcodec.so'));
  } else if (platform === 'ios') {
    return fs.existsSync(path.join(IOS_DIR, 'FFmpeg.xcframework'));
  }
  return false;
}

function androidHeadersExist() {
  return fs.existsSync(path.join(ANDROID_INCLUDE_DIR, 'libavcodec', 'avcodec.h'));
}

/**
 * Download and extract binaries for a platform
 */
async function downloadPlatform(platform) {
  if (binariesExist(platform)) {
    console.log(`[${platform}] Binaries already present, skipping download`);
    return true;
  }

  const isIOS = platform === 'ios';
  const ext = isIOS ? 'zip' : 'tar.gz';
  const url = `${BASE_URL}/ffmpeg-${platform}.${ext}`;
  const tempFile = path.join(PACKAGE_DIR, `temp-${platform}.${ext}`);
  const destDir = isIOS ? IOS_DIR : ANDROID_DIR;

  console.log(`[${platform}] Downloading FFmpeg binaries...`);

  try {
    await download(url, tempFile);
    console.log(`[${platform}] Extracting...`);

    // Ensure destination directory exists
    fs.mkdirSync(destDir, { recursive: true });

    if (!extract(tempFile, destDir, ext)) {
      throw new Error('Extraction failed');
    }

    // Cleanup
    fs.unlinkSync(tempFile);
    console.log(`[${platform}] Done`);
    return true;
  } catch (error) {
    console.warn(`[${platform}] Failed to download binaries: ${error.message}`);
    console.warn(`[${platform}] You may need to build binaries manually or download from:`);
    console.warn(`[${platform}] ${url}`);

    // Cleanup temp file if it exists
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    return false;
  }
}

async function downloadAndroidHeaders() {
  if (androidHeadersExist()) {
    writeAndroidGeneratedHeaders();
    console.log('[android] FFmpeg headers already present, skipping download');
    return true;
  }

  if (!FFMPEG_VERSION) {
    console.warn('[android] Cannot determine FFmpeg source version for headers');
    return false;
  }

  const url = `https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2`;
  const tempFile = path.join(PACKAGE_DIR, `temp-ffmpeg-${FFMPEG_VERSION}.tar.bz2`);
  const tempDir = path.join(PACKAGE_DIR, `temp-ffmpeg-${FFMPEG_VERSION}`);
  const sourceDir = path.join(tempDir, `ffmpeg-${FFMPEG_VERSION}`);

  console.log('[android] Downloading FFmpeg headers...');

  try {
    await download(url, tempFile);
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    console.log('[android] Extracting headers...');
    if (!extract(tempFile, tempDir, 'tar.bz2')) {
      throw new Error('Header extraction failed');
    }

    fs.mkdirSync(ANDROID_INCLUDE_DIR, { recursive: true });
    for (const headerDir of ANDROID_HEADER_DIRS) {
      copyHeaderFiles(
        path.join(sourceDir, headerDir),
        path.join(ANDROID_INCLUDE_DIR, headerDir)
      );
    }
    writeAndroidGeneratedHeaders();

    console.log('[android] Headers done');
    return true;
  } catch (error) {
    console.warn(`[android] Failed to download FFmpeg headers: ${error.message}`);
    console.warn(`[android] You may need to download headers manually from:`);
    console.warn(`[android] ${url}`);
    return false;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Main entry point
 */
async function main() {
  // Skip in CI environments that don't need binaries
  if (process.env.SKIP_FFMPEG_DOWNLOAD === '1') {
    console.log('[ffmpeg-expo] Skipping binary download (SKIP_FFMPEG_DOWNLOAD=1)');
    return;
  }

  console.log('[ffmpeg-expo] Checking FFmpeg binaries...');

  // Determine which platforms to download
  const isMac = process.platform === 'darwin';

  // Always download Android (needed for all builds)
  await downloadPlatform('android');
  await downloadAndroidHeaders();

  // Only download iOS on macOS
  if (isMac) {
    await downloadPlatform('ios');
  } else {
    console.log('[ios] Skipping iOS binaries (not on macOS)');
  }

  console.log('[ffmpeg-expo] Binary setup complete');
}

main().catch((error) => {
  console.error('[ffmpeg-expo] Postinstall error:', error);
  // Don't fail the install - binaries can be added manually
  process.exit(0);
});
