#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const packageDir = path.resolve(__dirname, '..', 'packages', 'expo-ffmpeg');

const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: packageDir,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status || 1);
}

let pack;
try {
  [pack] = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(result.stdout);
  throw error;
}

const files = new Set(pack.files.map((file) => file.path));
const required = [
  'package.json',
  'README.md',
  'LICENSE',
  'build/index.js',
  'build/index.d.ts',
  'build/ExpoFFmpeg.js',
  'build/ExpoFFmpeg.d.ts',
  'plugin/build/index.js',
  'app.plugin.js',
  'expo-module.config.json',
  'scripts/postinstall.js',
  'android/build.gradle.kts',
  'android/CMakeLists.txt',
  'ios/ExpoFFmpeg.podspec',
];

const forbidden = [
  /^node_modules\//,
  /^\.env/,
  /^temp-/,
  /^example\//,
  /^packages\//,
  /^android\/jniLibs\//,
  /^android\/libs\//,
  /^ios\/Frameworks\//,
  /\.tsbuildinfo$/,
  /\.log$/,
];

const missing = required.filter((file) => !files.has(file));
const unwanted = [...files].filter((file) => forbidden.some((pattern) => pattern.test(file)));

if (missing.length > 0 || unwanted.length > 0) {
  if (missing.length > 0) {
    console.error('Missing required package files:');
    for (const file of missing) console.error(`- ${file}`);
  }

  if (unwanted.length > 0) {
    console.error('Unwanted package files:');
    for (const file of unwanted) console.error(`- ${file}`);
  }

  process.exit(1);
}

console.log(`Validated ${pack.name}@${pack.version} package contents (${pack.entryCount} files).`);
