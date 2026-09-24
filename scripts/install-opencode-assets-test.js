#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const INSTALLER = path.join(__dirname, 'install-opencode-assets.js');
const sandboxes = [];

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-opencode-installer-test-'));
  sandboxes.push(root);
  return root;
}

function writeFile(root, relativePath, content, mode) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  if (mode != null) fs.chmodSync(file, mode);
}

function initGitWorktree(root) {
  const result = spawnSync('git', ['init', '--quiet'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function makeSource() {
  const source = makeSandbox();
  writeFile(source, '.opencode/commands/review.md', '---\ndescription: Review\n---\nReview it.\n');
  writeFile(source, '.opencode/commands/ship.md', 'See ../references/checklist.md.\n');
  writeFile(source, 'skills/example/SKILL.md', '---\nname: example\ndescription: Example\n---\nSee ../../references/checklist.md.\n');
  writeFile(source, 'skills/example/scripts/run.sh', '#!/bin/sh\necho run\n', 0o755);
  writeFile(source, '.opencode/agents/reviewer.md', '---\nname: reviewer\ndescription: Reviewer\n---\n');
  writeFile(source, '.opencode/agents/auditor.md', 'Use ../references/checklist.md.\n');
  writeFile(source, '.opencode/references/checklist.md', '# Checklist\n');
  return source;
}

function run(source, target, ...args) {
  return spawnSync(process.execPath, [INSTALLER, target, '--source', source, ...args], {
    encoding: 'utf8',
  });
}

function readManifest(target) {
  return JSON.parse(fs.readFileSync(path.join(target, '.opencode/agent-skills-manifest.json'), 'utf8'));
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('installs every portable asset into OpenCode paths and records ownership', () => {
  const source = makeSource();
  const target = makeSandbox();
  initGitWorktree(target);
  writeFile(target, 'AGENTS.md', '# Existing project rules\n');
  writeFile(target, '.opencode/opencode.json', '{"existing":true}\n');

  const result = run(source, target);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(path.join(target, '.opencode/commands/review.md'), 'utf8'), '---\ndescription: Review\n---\nReview it.\n');
  assert.equal(fs.readFileSync(path.join(target, '.opencode/skills/example/SKILL.md'), 'utf8'), '---\nname: example\ndescription: Example\n---\nSee ../../references/checklist.md.\n');
  assert.equal(fs.readFileSync(path.join(target, '.opencode/agents/reviewer.md'), 'utf8'), '---\nname: reviewer\ndescription: Reviewer\n---\n');
  assert.equal(fs.readFileSync(path.join(target, '.opencode/agents/auditor.md'), 'utf8'), 'Use ../references/checklist.md.\n');
  assert.equal(fs.readFileSync(path.join(target, '.opencode/references/checklist.md'), 'utf8'), '# Checklist\n');
  assert.equal(
    path.resolve(target, '.opencode/skills/example', '../../references/checklist.md'),
    path.join(target, '.opencode/references/checklist.md'),
  );
  assert.equal(fs.existsSync(path.resolve(target, '.opencode/skills/example', '../../references/checklist.md')), true);
  assert.equal(fs.existsSync(path.resolve(target, '.opencode/commands', '../references/checklist.md')), true);
  assert.equal(fs.existsSync(path.resolve(target, '.opencode/agents', '../references/checklist.md')), true);
  assert.ok(fs.statSync(path.join(target, '.opencode/skills/example/scripts/run.sh')).mode & 0o111);
  assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), '# Existing project rules\n');
  assert.equal(fs.readFileSync(path.join(target, '.opencode/opencode.json'), 'utf8'), '{"existing":true}\n');
  assert.equal(readManifest(target).files['.opencode/commands/review.md'].sha256, hash('---\ndescription: Review\n---\nReview it.\n'));
  assert.match(result.stdout, /## Skill-Driven Execution/);
});

test('dry run reports planned files without writing them', () => {
  const source = makeSource();
  const target = makeSandbox();
  initGitWorktree(target);

  const result = run(source, target, '--dry-run');

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Dry run/);
  assert.equal(fs.existsSync(path.join(target, '.opencode')), false);
});

test('aborts before writes when an unmanaged file differs', () => {
  const source = makeSource();
  const target = makeSandbox();
  initGitWorktree(target);
  writeFile(target, '.opencode/commands/review.md', 'project command\n');

  const result = run(source, target);

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(path.join(target, '.opencode/commands/review.md'), 'utf8'), 'project command\n');
  assert.equal(fs.existsSync(path.join(target, '.opencode/skills/example/SKILL.md')), false);
  assert.match(result.stderr, /Conflict/);
});

test('updates unchanged managed files, rejects local edits, and force replaces them', () => {
  const source = makeSource();
  const target = makeSandbox();
  initGitWorktree(target);
  assert.equal(run(source, target).status, 0);

  writeFile(source, '.opencode/commands/review.md', '---\ndescription: Updated\n---\nUpdated.\n');
  assert.equal(run(source, target).status, 0);
  assert.equal(fs.readFileSync(path.join(target, '.opencode/commands/review.md'), 'utf8'), '---\ndescription: Updated\n---\nUpdated.\n');

  writeFile(target, '.opencode/commands/review.md', 'local customization\n');
  writeFile(source, '.opencode/commands/review.md', '---\ndescription: Newer\n---\nNewer.\n');
  const conflict = run(source, target);
  assert.equal(conflict.status, 2, conflict.stdout + conflict.stderr);
  assert.equal(fs.readFileSync(path.join(target, '.opencode/commands/review.md'), 'utf8'), 'local customization\n');

  const forced = run(source, target, '--force');
  assert.equal(forced.status, 0, forced.stdout + forced.stderr);
  assert.equal(fs.readFileSync(path.join(target, '.opencode/commands/review.md'), 'utf8'), '---\ndescription: Newer\n---\nNewer.\n');
});

test('retains removed managed assets and rejects a managed destination symlink', () => {
  const source = makeSource();
  const target = makeSandbox();
  initGitWorktree(target);
  assert.equal(run(source, target).status, 0);
  fs.rmSync(path.join(source, '.opencode/agents/reviewer.md'));

  const update = run(source, target);
  assert.equal(update.status, 0, update.stdout + update.stderr);
  assert.equal(fs.existsSync(path.join(target, '.opencode/agents/reviewer.md')), true);
  assert.match(update.stdout, /Retained/);

  const secondTarget = makeSandbox();
  initGitWorktree(secondTarget);
  fs.mkdirSync(path.join(secondTarget, '.opencode'), { recursive: true });
  fs.symlinkSync('../outside', path.join(secondTarget, '.opencode/skills'));
  const symlink = run(source, secondTarget);
  assert.equal(symlink.status, 3, symlink.stdout + symlink.stderr);
  assert.match(symlink.stderr, /symlink/i);
});

test('rejects non-Git targets, self-installation, malformed manifests, and type conflicts', () => {
  const source = makeSource();
  const nonGitTarget = makeSandbox();
  const nonGit = run(source, nonGitTarget);
  assert.equal(nonGit.status, 3, nonGit.stdout + nonGit.stderr);
  assert.match(nonGit.stderr, /Git worktree/);

  initGitWorktree(source);
  const self = run(source, source);
  assert.equal(self.status, 3, self.stdout + self.stderr);
  assert.match(self.stderr, /source repository itself/);

  const malformedTarget = makeSandbox();
  initGitWorktree(malformedTarget);
  writeFile(malformedTarget, '.opencode/agent-skills-manifest.json', '{ not json\n');
  const malformed = run(source, malformedTarget);
  assert.equal(malformed.status, 3, malformed.stdout + malformed.stderr);
  assert.match(malformed.stderr, /invalid JSON/);

  const typeConflictTarget = makeSandbox();
  initGitWorktree(typeConflictTarget);
  fs.mkdirSync(path.join(typeConflictTarget, '.opencode/commands/review.md'), { recursive: true });
  const typeConflict = run(source, typeConflictTarget);
  assert.equal(typeConflict.status, 2, typeConflict.stdout + typeConflict.stderr);
  assert.match(typeConflict.stderr, /not a regular file/);
  assert.equal(fs.existsSync(path.join(typeConflictTarget, '.opencode/skills/example/SKILL.md')), false);
});

test('rejects symlinks inside the source asset tree', () => {
  const source = makeSource();
  const target = makeSandbox();
  initGitWorktree(target);
  fs.symlinkSync('checklist.md', path.join(source, '.opencode/references/linked-checklist.md'));

  const result = run(source, target);

  assert.equal(result.status, 3, result.stdout + result.stderr);
  assert.match(result.stderr, /Source asset must not be a symlink/);
  assert.equal(fs.existsSync(path.join(target, '.opencode')), false);
});
