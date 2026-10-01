#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const COPIER = path.join(__dirname, 'copy-opencode-assets.js');
const sandboxes = [];

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-copier-test-'));
  sandboxes.push(root);
  return root;
}

function write(root, relativePath, content, mode) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  if (mode != null) fs.chmodSync(file, mode);
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function source() {
  const root = sandbox();
  write(root, '.opencode/agents/a.md', 'Agent A: ../references/checklist.md\n');
  write(root, '.opencode/agents/b.md', 'Agent B\n');
  write(root, '.opencode/commands/review.md', 'Review: ../references/checklist.md\n');
  write(root, '.opencode/references/checklist.md', 'Checklist\n');
  write(root, '.opencode/skills/example/SKILL.md', 'Example: ../../references/checklist.md\n');
  write(root, '.opencode/skills/example/scripts/run.sh', '#!/bin/sh\necho run\n', 0o755);
  write(root, '.opencode/skills/example/references/local.md', 'Local reference\n');
  write(root, 'skills/example/SKILL.md', 'Upstream content\n');
  write(root, '.opencode/opencode.json', '{"private":true}\n');
  write(root, '.opencode/spec/SPEC.md', 'Contributor spec\n');
  write(root, 'AGENTS.md', 'Contributor rules\n');
  return root;
}

function run(sourceRoot, target, { args = [], input = '', nodeArgs = [] } = {}) {
  return spawnSync(process.execPath, [...nodeArgs, COPIER, target, '--source', sourceRoot, ...args], {
    encoding: 'utf8', input, timeout: 10000,
  });
}

function success(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('copies complete adapted assets into a missing non-Git target and preserves permissions and links', () => {
  const sourceRoot = source();
  const target = path.join(sandbox(), 'missing', 'assets');
  const result = run(sourceRoot, target);
  success(result);
  assert.equal(read(target, 'agents/a.md'), read(sourceRoot, '.opencode/agents/a.md'));
  assert.equal(read(target, 'commands/review.md'), read(sourceRoot, '.opencode/commands/review.md'));
  assert.equal(read(target, 'skills/example/SKILL.md'), read(sourceRoot, '.opencode/skills/example/SKILL.md'));
  assert.equal(read(target, 'skills/example/references/local.md'), 'Local reference\n');
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(target, 'skills/example/scripts/run.sh')).mode & 0o777, 0o755);
  assert.equal(fs.existsSync(path.resolve(target, 'skills/example', '../../references/checklist.md')), true);
  assert.equal(fs.existsSync(path.resolve(target, 'agents', '../references/checklist.md')), true);
  assert.equal(fs.existsSync(path.resolve(target, 'commands', '../references/checklist.md')), true);
  assert.deepEqual(fs.readdirSync(target).sort(), ['agents', 'commands', 'references', 'skills']);
  assert.match(result.stdout, /skills: created 1/);
});

test('adds missing files without deleting unrelated artifacts or rewriting identical files', () => {
  const sourceRoot = source();
  const target = sandbox();
  write(target, 'agents/custom.md', 'Custom agent\n');
  write(target, 'skills/custom/SKILL.md', 'Custom skill\n');
  write(target, 'skills/example/notes.md', 'Local notes\n');
  write(target, 'skills/example/SKILL.md', read(sourceRoot, '.opencode/skills/example/SKILL.md'));
  const identicalFile = path.join(target, 'skills/example/SKILL.md');
  fs.utimesSync(identicalFile, new Date(100000), new Date(100000));
  const mtime = fs.statSync(identicalFile).mtimeMs;
  success(run(sourceRoot, target));
  assert.equal(read(target, 'agents/custom.md'), 'Custom agent\n');
  assert.equal(read(target, 'skills/custom/SKILL.md'), 'Custom skill\n');
  assert.equal(read(target, 'skills/example/notes.md'), 'Local notes\n');
  assert.equal(read(target, 'skills/example/scripts/run.sh'), read(sourceRoot, '.opencode/skills/example/scripts/run.sh'));
  assert.equal(fs.statSync(identicalFile).mtimeMs, mtime);
  const repeat = run(sourceRoot, target);
  success(repeat);
  assert.match(repeat.stdout, /skills: created 0, replaced 0, skipped 0, unchanged 1/);
});

test('dry run lists additions, unchanged artifacts, and conflicts without prompts or writes', () => {
  const sourceRoot = source();
  const target = sandbox();
  write(target, 'agents/a.md', 'Local agent\n');
  write(target, 'agents/b.md', 'Agent B\n');
  const result = run(sourceRoot, target, { args: ['--dry-run'] });
  success(result);
  assert.match(result.stdout, /conflict agents\/a.md/);
  assert.match(result.stdout, /unchanged agents\/b.md/);
  assert.match(result.stdout, /create skills\/example/);
  assert.doesNotMatch(result.stdout, /\[r\/s\/ra\/sa\]/);
  assert.equal(read(target, 'agents/a.md'), 'Local agent\n');
  assert.equal(fs.existsSync(path.join(target, 'skills')), false);
  const missing = path.join(sandbox(), 'missing');
  success(run(sourceRoot, missing, { args: ['--dry-run'] }));
  assert.equal(fs.existsSync(missing), false);
});

test('replace merges one whole skill and skip leaves every file in that skill untouched', () => {
  const sourceRoot = source();
  write(sourceRoot, '.opencode/skills/second/SKILL.md', 'Second skill\n');
  write(sourceRoot, '.opencode/skills/second/new.md', 'New supporting file\n');
  const target = sandbox();
  write(target, 'skills/example/SKILL.md', 'Customized example\n');
  write(target, 'skills/example/scripts/run.sh', 'Customized script\n');
  write(target, 'skills/example/notes.md', 'Local notes\n');
  write(target, 'skills/second/SKILL.md', 'Customized second\n');
  const result = run(sourceRoot, target, { input: 'replace\nskip\n' });
  success(result);
  assert.equal(read(target, 'skills/example/SKILL.md'), read(sourceRoot, '.opencode/skills/example/SKILL.md'));
  assert.equal(read(target, 'skills/example/scripts/run.sh'), read(sourceRoot, '.opencode/skills/example/scripts/run.sh'));
  assert.equal(read(target, 'skills/example/references/local.md'), 'Local reference\n');
  assert.equal(read(target, 'skills/example/notes.md'), 'Local notes\n');
  assert.equal(read(target, 'skills/second/SKILL.md'), 'Customized second\n');
  assert.equal(fs.existsSync(path.join(target, 'skills/second/new.md')), false);
  assert.equal((result.stdout.match(/\[r\/s\/ra\/sa\]/g) || []).length, 2);
  assert.match(result.stdout, /skills: created 0, replaced 1, skipped 1, unchanged 0/);
});

test('replace-all and skip-all apply only to remaining conflicts of the current type', () => {
  const sourceRoot = source();
  write(sourceRoot, '.opencode/commands/ship.md', 'Ship\n');
  write(sourceRoot, '.opencode/references/other.md', 'Other checklist\n');
  write(sourceRoot, '.opencode/skills/second/SKILL.md', 'Second\n');
  const target = sandbox();
  for (const relative of ['agents/a.md', 'agents/b.md', 'commands/review.md', 'commands/ship.md', 'references/checklist.md', 'references/other.md', 'skills/example/SKILL.md', 'skills/second/SKILL.md']) {
    write(target, relative, 'Local\n');
  }
  write(sourceRoot, '.opencode/commands/new.md', 'New command\n');
  const result = run(sourceRoot, target, { input: 'ra\nsa\nreplace all\nskip all\n' });
  success(result);
  assert.equal(read(target, 'agents/a.md'), read(sourceRoot, '.opencode/agents/a.md'));
  assert.equal(read(target, 'agents/b.md'), 'Agent B\n');
  assert.equal(read(target, 'commands/review.md'), 'Local\n');
  assert.equal(read(target, 'commands/ship.md'), 'Local\n');
  assert.equal(read(target, 'commands/new.md'), 'New command\n');
  assert.equal(read(target, 'references/checklist.md'), 'Checklist\n');
  assert.equal(read(target, 'references/other.md'), 'Other checklist\n');
  assert.equal(read(target, 'skills/example/SKILL.md'), 'Local\n');
  assert.equal(read(target, 'skills/second/SKILL.md'), 'Local\n');
  assert.equal(fs.existsSync(path.join(target, 'skills/example/scripts/run.sh')), false);
  assert.equal((result.stdout.match(/\[r\/s\/ra\/sa\]/g) || []).length, 4);
  assert.match(result.stdout, /commands: created 1, replaced 0, skipped 2, unchanged 0/);
});

test('individual decisions remain individual, blank skips, and invalid answers retry', () => {
  const sourceRoot = source();
  const target = sandbox();
  write(target, 'agents/a.md', 'Local A\n');
  write(target, 'agents/b.md', 'Local B\n');
  const result = run(sourceRoot, target, { input: 'nonsense\nr\n\n' });
  success(result);
  assert.match(result.stdout, /Invalid answer/);
  assert.equal(read(target, 'agents/a.md'), read(sourceRoot, '.opencode/agents/a.md'));
  assert.equal(read(target, 'agents/b.md'), 'Local B\n');
  assert.equal((result.stdout.match(/\[r\/s\/ra\/sa\]/g) || []).length, 3);
});

test('EOF or cancellation after an earlier replace decision aborts before any writes', () => {
  const sourceRoot = source();
  for (const input of ['', 'replace\n', 'replace\nq\n', 'replace\n\u0003\n']) {
    const target = sandbox();
    write(target, 'agents/a.md', 'Local A\n');
    write(target, 'skills/example/SKILL.md', 'Local skill\n');
    const result = run(sourceRoot, target, { input });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stderr, /no files were written/i);
    assert.equal(read(target, 'agents/a.md'), 'Local A\n');
    assert.equal(read(target, 'skills/example/SKILL.md'), 'Local skill\n');
    assert.equal(fs.existsSync(path.join(target, 'agents/b.md')), false);
    assert.equal(fs.existsSync(path.join(target, 'commands')), false);
  }
});

test('rejects symlinks in source assets and destination paths before any writes', () => {
  for (const kind of ['source', 'target', 'type', 'file', 'parent', 'skill-resource']) {
    const sourceRoot = source();
    const root = sandbox();
    let target = path.join(root, 'target');
    fs.mkdirSync(target);
    const outside = path.join(root, 'outside');
    fs.mkdirSync(outside);
    if (kind === 'source') fs.symlinkSync(outside, path.join(sourceRoot, '.opencode/skills/link'), process.platform === 'win32' ? 'junction' : 'dir');
    else if (kind === 'target') {
      fs.rmdirSync(target);
      fs.symlinkSync(outside, target, process.platform === 'win32' ? 'junction' : 'dir');
    } else if (kind === 'type' || kind === 'parent') {
      fs.symlinkSync(outside, path.join(target, 'agents'), process.platform === 'win32' ? 'junction' : 'dir');
      if (kind === 'parent') target = path.join(target, 'agents', 'nested');
    } else if (kind === 'file') {
      fs.mkdirSync(path.join(target, 'agents'));
      // A directory symlink at a source-file destination also avoids Windows file-symlink privileges.
      fs.symlinkSync(outside, path.join(target, 'agents/a.md'), process.platform === 'win32' ? 'junction' : 'dir');
    } else {
      fs.mkdirSync(path.join(target, 'skills/example'), { recursive: true });
      fs.symlinkSync(outside, path.join(target, 'skills/example/scripts'), process.platform === 'win32' ? 'junction' : 'dir');
    }
    const result = run(sourceRoot, target, { input: 'ra\n' });
    assert.equal(result.status, 3, result.stdout + result.stderr);
    assert.match(result.stderr, /symlink/i);
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.equal(fs.existsSync(path.join(target, 'commands')), false);
  }
});

test('rejects directory/file mismatches and missing source directories before any writes', () => {
  for (const kind of ['root', 'type', 'file', 'resource', 'source']) {
    const sourceRoot = source();
    const root = sandbox();
    const target = path.join(root, 'target');
    if (kind === 'root') write(root, 'target', 'Target file\n');
    else fs.mkdirSync(target);
    if (kind === 'type') write(target, 'skills', 'Not a folder\n');
    if (kind === 'file') fs.mkdirSync(path.join(target, 'agents/a.md'), { recursive: true });
    if (kind === 'resource') write(target, 'skills/example/scripts', 'Not a folder\n');
    if (kind === 'source') fs.rmSync(path.join(sourceRoot, '.opencode/references'), { recursive: true });
    const result = run(sourceRoot, target);
    assert.equal(result.status, 3, result.stdout + result.stderr);
    assert.match(result.stderr, /directory|regular file|missing/i);
    assert.equal(fs.existsSync(path.join(target, 'commands')), false);
  }
});

test('rejects overlapping source and destination roots, including nonexistent nested targets', () => {
  const sourceRoot = source();
  for (const target of [sourceRoot, path.join(sourceRoot, '.opencode'), path.join(sourceRoot, 'missing', 'target'), path.dirname(sourceRoot)]) {
    const result = run(sourceRoot, target);
    assert.equal(result.status, 3, result.stdout + result.stderr);
    assert.match(result.stderr, /overlap/);
  }
  assert.equal(fs.existsSync(path.join(sourceRoot, 'missing')), false);
});

test('CLI help and argument errors do not create a target', () => {
  const sourceRoot = source();
  const target = path.join(sandbox(), 'missing');
  const help = run(sourceRoot, target, { args: ['--help'] });
  success(help);
  assert.match(help.stdout, /Usage:.*copy-opencode-assets/);
  for (const args of [[], ['--source'], ['--source', '--dry-run'], [target, '--unknown'], [target, 'extra']]) {
    const result = spawnSync(process.execPath, [COPIER, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
  }
  assert.equal(fs.existsSync(target), false);
});

test('copies empty skill resource directories when merging an otherwise identical skill', () => {
  const sourceRoot = source();
  const target = sandbox();
  success(run(sourceRoot, target));
  fs.mkdirSync(path.join(sourceRoot, '.opencode/skills/example/empty'));
  success(run(sourceRoot, target));
  assert.equal(fs.statSync(path.join(target, 'skills/example/empty')).isDirectory(), true);
});

test('rolls back replaced files, newly created files, and directories after a write failure', () => {
  const sourceRoot = source();
  const target = sandbox();
  write(target, 'agents/a.md', 'Local A\n', 0o600);
  const mode = fs.statSync(path.join(target, 'agents/a.md')).mode & 0o777;
  const preloadRoot = sandbox();
  write(preloadRoot, 'fail-write.cjs', `
    const fs = require('node:fs');
    const rename = fs.renameSync;
    let failed = false;
    fs.renameSync = function (from, to) {
      if (!failed && to === ${JSON.stringify(path.join(fs.realpathSync(target), 'commands/review.md'))}) {
        failed = true;
        throw new Error('Injected rename failure');
      }
      return rename.apply(this, arguments);
    };
  `);
  const result = run(sourceRoot, target, { input: 'r\n', nodeArgs: ['--require', path.join(preloadRoot, 'fail-write.cjs')] });
  assert.equal(result.status, 3, result.stdout + result.stderr);
  assert.match(result.stderr, /Injected rename failure/);
  assert.equal(read(target, 'agents/a.md'), 'Local A\n');
  assert.equal(fs.statSync(path.join(target, 'agents/a.md')).mode & 0o777, mode);
  assert.deepEqual(fs.readdirSync(target), ['agents']);
  assert.deepEqual(fs.readdirSync(path.join(target, 'agents')), ['a.md']);
});

test('cleans up a partially written temporary file and a newly created target on failure', () => {
  const sourceRoot = source();
  const root = sandbox();
  const target = path.join(root, 'missing', 'target');
  const preloadRoot = sandbox();
  write(preloadRoot, 'fail-write.cjs', `
    const fs = require('node:fs');
    const write = fs.writeFileSync;
    let failed = false;
    fs.writeFileSync = function () {
      if (!failed) {
        failed = true;
        write.apply(this, arguments);
        throw new Error('Injected partial write failure');
      }
      return write.apply(this, arguments);
    };
  `);
  const result = run(sourceRoot, target, { nodeArgs: ['--require', path.join(preloadRoot, 'fail-write.cjs')] });
  assert.equal(result.status, 3, result.stdout + result.stderr);
  assert.match(result.stderr, /Injected partial write failure/);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('SIGINT while waiting for a later answer aborts without applying earlier decisions', { timeout: 10000 }, async context => {
  const sourceRoot = source();
  const target = sandbox();
  write(target, 'agents/a.md', 'Local A\n');
  write(target, 'skills/example/SKILL.md', 'Local skill\n');
  const child = spawn(process.execPath, [COPIER, target, '--source', sourceRoot], { stdio: ['pipe', 'pipe', 'pipe'] });
  context.after(() => { child.kill(); child.stdin.destroy(); });
  let output = '';
  let error = '';
  let answered = false;
  let interrupted = false;
  child.stderr.on('data', data => { error += data; });
  const result = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal }));
    child.stdout.on('data', data => {
      output += data;
      if (!answered && output.includes('Conflict agents/a.md')) {
        answered = true;
        child.stdin.write('replace\n');
      }
      if (!interrupted && output.includes('Conflict skills/example')) {
        interrupted = true;
        child.kill('SIGINT');
      }
    });
  });
  assert.equal(interrupted, true, output + error);
  // Windows terminates the process directly; POSIX delivers our cancellation handler.
  if (process.platform !== 'win32') {
    assert.equal(result.code, 2, output + error);
    assert.match(error, /no files were written/i);
  }
  assert.equal(read(target, 'agents/a.md'), 'Local A\n');
  assert.equal(read(target, 'skills/example/SKILL.md'), 'Local skill\n');
  assert.equal(fs.existsSync(path.join(target, 'agents/b.md')), false);
});

test('preserves an intervening destination edit and aborts before applying a stale replace decision', { timeout: 10000 }, async context => {
  const sourceRoot = source();
  const target = sandbox();
  write(target, 'agents/a.md', 'Local A\n');
  const child = spawn(process.execPath, [COPIER, target, '--source', sourceRoot], { stdio: ['pipe', 'pipe', 'pipe'] });
  context.after(() => { child.kill(); child.stdin.destroy(); });
  let output = '';
  let error = '';
  let answered = false;
  child.stderr.on('data', data => { error += data; });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
    child.stdout.on('data', data => {
      output += data;
      if (!answered && output.includes('Conflict agents/a.md')) {
        answered = true;
        write(target, 'agents/a.md', 'Edited while the prompt was open\n');
        child.stdin.end('replace\n');
      }
    });
  });
  assert.equal(code, 2, output + error);
  assert.match(error, /Destination changed.*no files were written/);
  assert.equal(read(target, 'agents/a.md'), 'Edited while the prompt was open\n');
  assert.equal(fs.existsSync(path.join(target, 'agents/b.md')), false);
  assert.equal(fs.existsSync(path.join(target, 'commands')), false);
});
