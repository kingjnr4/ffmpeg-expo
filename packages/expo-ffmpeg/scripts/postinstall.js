#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const packageJson = require('../package.json');
const BINARY_VERSION = packageJson.ffmpegExpo?.binaryReleaseTag;
const FFMPEG_VERSION =
  packageJson.ffmpegExpo?.ffmpegVersion ||
  BINARY_VERSION?.match(/^ffmpeg-(.+)-r\d+$/)?.[1];

if (!BINARY_VERSION) {
  throw new Error('Missing ffmpegExpo.binaryReleaseTag in package.json');
}

const DEFAULT_BASE_URL = `https://github.com/kingjnr4/ffmpeg-expo/releases/download/${BINARY_VERSION}`;

const PACKAGE_DIR = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(PACKAGE_DIR, 'android', 'jniLibs');
const ANDROID_INCLUDE_DIR = path.join(PACKAGE_DIR, 'android', 'include');
const IOS_DIR = path.join(PACKAGE_DIR, 'ios', 'Frameworks');
const ANDROID_HEADER_DIRS = ['libavcodec', 'libavformat', 'libavutil', 'libswresample', 'libswscale'];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (urlString) => {
      https
        .get(urlString, (response) => {
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

function archiveSettings(platform, ext) {
  const prefix = `EXPO_FFMPEG_${platform.toUpperCase()}`;
  const baseUrl = (process.env.EXPO_FFMPEG_BINARY_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const localArchive = process.env[`${prefix}_ARCHIVE`];

  return {
    localArchive: localArchive
      ? path.resolve(process.env.INIT_CWD || process.cwd(), localArchive)
      : null,
    url: process.env[`${prefix}_ARCHIVE_URL`] || `${baseUrl}/ffmpeg-${platform}.${ext}`,
    checksum: process.env[`${prefix}_SHA256`],
  };
}

async function verifyChecksum(archive, expected, platform) {
  if (!expected) return;

  const normalized = expected.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${platform} SHA-256 must be exactly 64 hexadecimal characters`);
  }

  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(archive)) {
    hash.update(chunk);
  }
  const actual = hash.digest('hex');
  if (actual !== normalized) {
    throw new Error(`${platform} SHA-256 mismatch: expected ${normalized}, received ${actual}`);
  }

  console.log(`[${platform}] SHA-256 verified`);
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

function binariesExist(platform) {
  if (platform === 'android') {
    const arm64Dir = path.join(ANDROID_DIR, 'arm64-v8a');
    return (
      fs.existsSync(path.join(arm64Dir, 'libavcodec.so')) &&
      fs.existsSync(path.join(arm64Dir, 'libavfilter.so')) &&
      fs.existsSync(path.join(arm64Dir, 'libexpo_ffmpeg.a'))
    );
  } else if (platform === 'ios') {
    return fs.existsSync(path.join(IOS_DIR, 'FFmpeg.xcframework'));
  }
  return false;
}

function androidHeadersExist() {
  return fs.existsSync(path.join(ANDROID_INCLUDE_DIR, 'libavcodec', 'avcodec.h'));
}

async function downloadPlatform(platform) {
  if (binariesExist(platform)) {
    console.log(`[${platform}] Binaries already present, skipping download`);
    return true;
  }

  const isIOS = platform === 'ios';
  const ext = isIOS ? 'zip' : 'tar.gz';
  const { localArchive, url, checksum } = archiveSettings(platform, ext);
  const tempFile = path.join(PACKAGE_DIR, `temp-${platform}-${process.pid}.${ext}`);
  const destDir = isIOS ? IOS_DIR : ANDROID_DIR;

  console.log(`[${platform}] ${localArchive ? 'Loading local' : 'Downloading'} FFmpeg binaries...`);

  try {
    if (localArchive) {
      fs.copyFileSync(localArchive, tempFile);
    } else {
      await download(url, tempFile);
    }
    await verifyChecksum(tempFile, checksum, platform);
    console.log(`[${platform}] Extracting...`);

    fs.mkdirSync(destDir, { recursive: true });

    if (!extract(tempFile, destDir, ext)) {
      throw new Error('Extraction failed');
    }

    console.log(`[${platform}] Done`);
    return true;
  } catch (error) {
    console.warn(`[${platform}] Failed to install binaries: ${error.message}`);
    console.warn(`[${platform}] Binary source: ${localArchive || url}`);
    return false;
  } finally {
    fs.rmSync(tempFile, { force: true });
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
  const tempFile = path.join(PACKAGE_DIR, `temp-ffmpeg-${FFMPEG_VERSION}-${process.pid}.tar.bz2`);
  const tempDir = path.join(PACKAGE_DIR, `temp-ffmpeg-${FFMPEG_VERSION}-${process.pid}`);
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

async function main() {
  if (process.env.SKIP_FFMPEG_DOWNLOAD === '1') {
    console.log('[ffmpeg-expo] Skipping binary download (SKIP_FFMPEG_DOWNLOAD=1)');
    return;
  }

  console.log('[ffmpeg-expo] Checking FFmpeg binaries...');

  const isMac = process.platform === 'darwin';

  await downloadPlatform('android');
  await downloadAndroidHeaders();

  if (isMac) {
    await downloadPlatform('ios');
  } else {
    console.log('[ios] Skipping iOS binaries (not on macOS)');
  }

  console.log('[ffmpeg-expo] Binary setup complete');
}

main().catch((error) => {
  console.error('[ffmpeg-expo] Postinstall error:', error);
  // Do not fail package installs; binaries can be added manually.
  process.exit(0);
});
