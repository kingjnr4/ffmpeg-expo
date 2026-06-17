#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.resolve(__dirname, '..', 'packages', 'expo-ffmpeg', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const tag = `v${packageJson.version}`;

function commandSucceeds(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return result.status === 0;
}

const npmPublished = commandSucceeds('npm', ['view', `${packageJson.name}@${packageJson.version}`, 'version']);
const releaseExists = commandSucceeds('gh', ['release', 'view', tag, '--repo', 'kingjnr4/ffmpeg-expo']);

const outputs = {
  name: packageJson.name,
  version: packageJson.version,
  tag,
  npm_published: String(npmPublished),
  release_exists: String(releaseExists),
  should_publish: String(!npmPublished),
  should_create_release: String(!releaseExists && npmPublished),
};

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
  );
}

for (const [key, value] of Object.entries(outputs)) {
  console.log(`${key}=${value}`);
}
