#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');

const VALIDATOR = path.join(__dirname, 'validate-opencode-mirrors.js');
const sandboxes = [];

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-validate-opencode-mirrors-test-'));
  const scriptsDir = path.join(root, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.copyFileSync(VALIDATOR, path.join(scriptsDir, 'validate-opencode-mirrors.js'));
  sandboxes.push(root);
  return root;
}

function writeFile(root, relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function mirror(root, kind, file = 'nested/checklist.md', content = '# Checklist\n') {
  writeFile(root, `${kind}/${file}`, content);
  writeFile(root, `.opencode/${kind}/${file}`, content);
}

function run(root) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'validate-opencode-mirrors.js')], {
    cwd: root,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of sandboxes.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('passes when reference and agent mirrors exactly match their canonical trees', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  mirror(root, 'agents', 'reviewer.md', '---\nname: reviewer\n---\n');

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /2 mirror pair\(s\) checked — PASSED/);
});

test('reports missing, changed, and extra agent files independently', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  writeFile(root, 'agents/changed.md', 'canonical\n');
  writeFile(root, '.opencode/agents/changed.md', 'modified\n');
  writeFile(root, 'agents/missing.md', 'canonical\n');
  writeFile(root, '.opencode/agents/extra.md', 'extra\n');

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /agents\/changed\.md — content differs/);
  assert.match(result.stdout, /agents\/missing\.md — missing from \.opencode\/agents\//);
  assert.match(result.stdout, /agents\/extra\.md — not present in agents\//);
});

test('rejects symlinked and non-regular agent mirror entries', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  writeFile(root, 'agents/reviewer.md', 'canonical\n');
  fs.mkdirSync(path.join(root, '.opencode/agents/reviewer.md'), { recursive: true });
  writeFile(root, 'agents/security.md', 'canonical\n');
  fs.symlinkSync('../../agents/security.md', path.join(root, '.opencode/agents/security.md'));

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /agents\/reviewer\.md — must be a regular file/);
  assert.match(result.stdout, /agents\/security\.md — must be a regular file, not a symlink/);
});
