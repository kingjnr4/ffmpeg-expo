#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(repoRoot, '.changeset', 'release-impact.json'), 'utf8'));
const changedFilesPath = process.argv[2];

if (!changedFilesPath) {
  console.error('Usage: node scripts/check-changeset.js <changed-files.txt>');
  process.exit(2);
}

const changedFiles = fs
  .readFileSync(changedFilesPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

function matchesPattern(file, pattern) {
  if (pattern.endsWith('/**')) {
    return file.startsWith(pattern.slice(0, -3));
  }

  return file === pattern;
}

function isIgnored(file) {
  return config.ignored.some((pattern) => matchesPattern(file, pattern));
}

function getLabels() {
  if (!process.env.GITHUB_EVENT_PATH || !fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
    return [];
  }

  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  return event.pull_request?.labels?.map((label) => label.name) || [];
}

if (process.env.GITHUB_HEAD_REF === config.versionPackagesBranch) {
  console.log('Skipping Changeset check for the Version Packages branch.');
  process.exit(0);
}

const labels = getLabels();
const exemptLabel = config.exemptLabels.find((label) => labels.includes(label));

if (exemptLabel) {
  console.log(`Skipping Changeset check because label '${exemptLabel}' is present.`);
  process.exit(0);
}

const hasChangeset = changedFiles.some(
  (file) => file.startsWith('.changeset/') && file.endsWith('.md') && path.basename(file) !== 'README.md',
);

const relevantChanges = [];

for (const file of changedFiles) {
  if (isIgnored(file)) continue;

  for (const entry of config.relevant) {
    if (entry.paths.some((pattern) => matchesPattern(file, pattern))) {
      relevantChanges.push({ file, reason: entry.reason });
      break;
    }
  }
}

if (relevantChanges.length === 0) {
  console.log('No release-relevant package changes detected.');
  process.exit(0);
}

if (hasChangeset) {
  console.log('Release-relevant changes detected and a Changeset is present.');
  process.exit(0);
}

console.error('Release-relevant changes were detected, but this PR does not add a Changeset.');
console.error('Add a .changeset/*.md file targeting ffmpeg-expo, or ask a maintainer to apply the no-changeset-required label.');
console.error('Relevant changes:');

for (const change of relevantChanges) {
  console.error(`- ${change.file}: ${change.reason}`);
}

process.exit(1);
