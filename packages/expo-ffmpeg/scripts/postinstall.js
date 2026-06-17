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

if (!BINARY_VERSION) {
  throw new Error('Missing ffmpegExpo.binaryReleaseTag in package.json');
}

const BASE_URL = `https://github.com/kingjnr4/ffmpeg-expo/releases/download/${BINARY_VERSION}`;

const PACKAGE_DIR = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(PACKAGE_DIR, 'android', 'jniLibs');
const IOS_DIR = path.join(PACKAGE_DIR, 'ios', 'Frameworks');

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
    } else if (type === 'zip') {
      execSync(`unzip -q -o "${archive}" -d "${dest}"`, { stdio: 'pipe' });
    }
    return true;
  } catch (error) {
    console.error(`Failed to extract ${archive}:`, error.message);
    return false;
  }
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
