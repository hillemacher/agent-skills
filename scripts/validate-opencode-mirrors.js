#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIRRORS = [
  ['skills', '.opencode/skills'],
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

function validatePair(canonicalLabel, mirrorLabel, errors, overrides, used) {
  const canonical = entriesIn(path.join(ROOT, ...canonicalLabel.split('/')), canonicalLabel, errors);
  const mirror = entriesIn(path.join(ROOT, ...mirrorLabel.split('/')), mirrorLabel, errors);

  for (const [relativePath, source] of canonical) {
    const copy = mirror.get(relativePath);
    if (!copy) {
      errors.push(`${canonicalLabel}/${relativePath} — missing from ${mirrorLabel}/`);
    } else if (source.type !== copy.type) {
      errors.push(`${canonicalLabel}/${relativePath} — must be a ${source.type === 'file' ? 'regular file' : source.type} in ${mirrorLabel}/`);
    } else if (source.type === 'file' && !source.content.equals(copy.content)) {
      const key = `${canonicalLabel}/${relativePath}`;
      if (typeof overrides[key] === 'string') used.add(key);
      else errors.push(`${key} — content differs without a declared adaptation`);
    }
  }
  for (const relativePath of mirror.keys()) {
    if (!canonical.has(relativePath)) {
      const key = `${canonicalLabel}/${relativePath}`;
      const declaration = overrides[key];
      const entry = mirror.get(relativePath);
      if (entry.type === 'file' && declaration && typeof declaration === 'object' && declaration.forkOnly === true) {
        used.add(key);
      } else if (entry.type === 'directory' && Object.keys(overrides).some((name) => name.startsWith(key + '/') && overrides[name]?.forkOnly === true)) {
        // Parent directories of explicitly retained fork-only files.
      } else errors.push(`${key} — not present in ${canonicalLabel}/`);
    }
  }

  return [...canonical.values()].filter((entry) => entry.type === 'file').length;
}

function main() {
  const errors = [];
  let overrides = {};
  const overrideFile = path.join(ROOT, '.opencode', 'adapter-overrides.json');
  try {
    if (!lstat(overrideFile)?.isFile() || lstat(overrideFile)?.isSymbolicLink()) throw new Error('must be a regular file');
    overrides = JSON.parse(fs.readFileSync(overrideFile, 'utf8'));
    if (!overrides || Array.isArray(overrides) || typeof overrides !== 'object') throw new Error('must be a path-to-reason object');
    for (const [key, value] of Object.entries(overrides)) {
      const reason = typeof value === 'string' ? value : value?.reason;
      const validValue = typeof value === 'string' || (value && typeof value === 'object' && value.forkOnly === true && Object.keys(value).every((field) => ['reason', 'forkOnly'].includes(field)));
      if (!/^(skills|agents|references)\//.test(key) || key.split('/').some((part) => !part || part === '.' || part === '..') || key.includes('\\') || !validValue || typeof reason !== 'string' || !reason.trim()) {
        errors.push(`adapter-overrides.json — invalid declaration: ${key}`);
      }
    }
  } catch (error) {
    errors.push(`adapter-overrides.json — ${error.message}`);
    overrides = {};
  }
  const used = new Set();
  let files = 0;
  for (const [canonical, mirror] of MIRRORS) files += validatePair(canonical, mirror, errors, overrides, used);
  for (const key of Object.keys(overrides)) {
    if (!used.has(key)) errors.push(`adapter-overrides.json — stale declaration: ${key}`);
  }

  const status = errors.length === 0 ? 'PASSED' : 'FAILED';
  console.log('Checking OpenCode adapter mirrors...\n');
  for (const error of errors) console.log(`  ✗  ${error}`);
  if (errors.length === 0) {
    for (const [canonical, mirror] of MIRRORS) console.log(`  ✓  ${mirror}/ matches ${canonical}/ inventory and declared adaptations`);
  }
  console.log(`\n${MIRRORS.length} mirror pair(s) checked — ${status} (${files} canonical file(s))`);
  if (errors.length > 0) process.exitCode = 1;
}

main();
