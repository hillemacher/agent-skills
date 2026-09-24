#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIRRORS = [
  ['references', '.opencode/references'],
  ['agents', '.opencode/agents'],
];

function lstat(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function entriesIn(directory, label, errors) {
  const entries = new Map();
  const rootStat = lstat(directory);
  if (!rootStat || !rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    errors.push(`${label}/ — must be a real directory`);
    return entries;
  }

  function walk(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      const relativePath = relative ? path.join(relative, entry.name) : entry.name;
      const posixPath = relativePath.split(path.sep).join('/');
      const stat = lstat(file);
      if (stat.isSymbolicLink()) {
        errors.push(`${label}/${posixPath} — must be a regular file, not a symlink`);
        entries.set(posixPath, { type: 'symlink' });
      } else if (stat.isDirectory()) {
        entries.set(posixPath, { type: 'directory' });
        walk(file, relativePath);
      } else if (stat.isFile()) {
        entries.set(posixPath, { type: 'file', content: fs.readFileSync(file) });
      } else {
        errors.push(`${label}/${posixPath} — must be a regular file`);
        entries.set(posixPath, { type: 'other' });
      }
    }
  }

  walk(directory);
  return entries;
}

function validatePair(canonicalLabel, mirrorLabel, errors) {
  const canonical = entriesIn(path.join(ROOT, ...canonicalLabel.split('/')), canonicalLabel, errors);
  const mirror = entriesIn(path.join(ROOT, ...mirrorLabel.split('/')), mirrorLabel, errors);

  for (const [relativePath, source] of canonical) {
    const copy = mirror.get(relativePath);
    if (!copy) {
      errors.push(`${canonicalLabel}/${relativePath} — missing from ${mirrorLabel}/`);
    } else if (source.type !== copy.type) {
      errors.push(`${canonicalLabel}/${relativePath} — must be a ${source.type === 'file' ? 'regular file' : source.type} in ${mirrorLabel}/`);
    } else if (source.type === 'file' && !source.content.equals(copy.content)) {
      errors.push(`${canonicalLabel}/${relativePath} — content differs`);
    }
  }
  for (const relativePath of mirror.keys()) {
    if (!canonical.has(relativePath)) errors.push(`${canonicalLabel}/${relativePath} — not present in ${canonicalLabel}/`);
  }

  return [...canonical.values()].filter((entry) => entry.type === 'file').length;
}

function main() {
  const errors = [];
  let files = 0;
  for (const [canonical, mirror] of MIRRORS) files += validatePair(canonical, mirror, errors);

  const status = errors.length === 0 ? 'PASSED' : 'FAILED';
  console.log('Checking OpenCode adapter mirrors...\n');
  for (const error of errors) console.log(`  ✗  ${error}`);
  if (errors.length === 0) {
    for (const [canonical, mirror] of MIRRORS) console.log(`  ✓  ${mirror}/ exactly matches ${canonical}/`);
  }
  console.log(`\n${MIRRORS.length} mirror pair(s) checked — ${status} (${files} canonical file(s))`);
  if (errors.length > 0) process.exitCode = 1;
}

main();
