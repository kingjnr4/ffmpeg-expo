#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = 'kingjnr4/ffmpeg-expo';
const packageDir = path.resolve(__dirname, '..', 'packages', 'expo-ffmpeg');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const tag = `v${packageJson.version}`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

function succeeds(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

if (!succeeds('npm', ['view', `${packageJson.name}@${packageJson.version}`, 'version'])) {
  console.error(`${packageJson.name}@${packageJson.version} is not published to npm; refusing to create a GitHub Release.`);
  process.exit(1);
}

if (succeeds('gh', ['release', 'view', tag, '--repo', repo])) {
  console.log(`GitHub Release ${tag} already exists; skipping.`);
  process.exit(0);
}

const changelogPath = path.join(packageDir, 'CHANGELOG.md');
let notes = `Released ${packageJson.name}@${packageJson.version}.`;

if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const heading = `## ${packageJson.version}`;
  const start = changelog.indexOf(`${heading}\n`);
  if (start !== -1) {
    const contentStart = start + heading.length + 1;
    const next = changelog.indexOf('\n## ', contentStart);
    notes = changelog.slice(contentStart, next === -1 ? undefined : next).trim();
  }
}

const notesFile = path.join(os.tmpdir(), `${packageJson.name}-${packageJson.version}-notes.md`);
fs.writeFileSync(notesFile, notes + '\n');

run('gh', [
  'release',
  'create',
  tag,
  '--repo',
  repo,
  '--target',
  process.env.GITHUB_SHA || 'main',
  '--title',
  `${packageJson.name} ${packageJson.version}`,
  '--notes-file',
  notesFile,
]);

console.log(`Created GitHub Release ${tag}.`);
