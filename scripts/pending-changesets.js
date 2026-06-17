#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const changesetDir = path.resolve(__dirname, '..', '.changeset');
const pending = fs
  .readdirSync(changesetDir)
  .filter((file) => file.endsWith('.md') && file !== 'README.md');

const value = pending.length > 0 ? 'true' : 'false';

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `pending=${value}\n`);
}

console.log(value);
