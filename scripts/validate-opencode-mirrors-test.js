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
  writeFile(root, "skills/example/SKILL.md", "example\n");
  writeFile(root, ".opencode/skills/example/SKILL.md", "example\n");
  writeFile(root, ".opencode/adapter-overrides.json", "{}\n");
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
  assert.match(result.stdout, /3 mirror pair\(s\) checked — PASSED/);
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

function overrides(root, entries) {
  writeFile(root, '.opencode/adapter-overrides.json', JSON.stringify(entries));
}

test('accepts declared adaptations while rejecting undeclared differences', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  mirror(root, 'agents');
  writeFile(root, '.opencode/skills/example/SKILL.md', 'OpenCode adaptation\n');
  overrides(root, { 'skills/example/SKILL.md': 'Use native OpenCode setup' });
  assert.equal(run(root).status, 0);
  overrides(root, {});
  assert.equal(run(root).status, 1);
});

test('rejects stale, unsafe, and empty override declarations', () => {
  for (const entries of [
    { 'skills/example/SKILL.md': 'No longer differs' },
    { 'skills/missing/SKILL.md': 'Removed upstream' },
    { '../outside.md': 'Unsafe path' },
    { 'skills/example/SKILL.md': '' },
  ]) {
    const root = makeSandbox();
    mirror(root, 'references');
    mirror(root, 'agents');
    overrides(root, entries);
    assert.equal(run(root).status, 1, JSON.stringify(entries));
  }
});

test('rejects missing and unexpected skills, including undeclared upstream deletions', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  mirror(root, 'agents');
  fs.rmSync(path.join(root, '.opencode/skills/example'), { recursive: true });
  writeFile(root, '.opencode/skills/extra/SKILL.md', 'extra\n');
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /skills\/example.*missing/);
  assert.match(result.stdout, /skills\/extra.*not present/);
});

test('rejects a symlinked skill tree', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  mirror(root, 'agents');
  fs.rmSync(path.join(root, '.opencode/skills'), { recursive: true });
  fs.symlinkSync('../skills', path.join(root, '.opencode/skills'));
  assert.equal(run(root).status, 1);
});

test('inventory changes require deliberate adaptation updates', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  mirror(root, 'agents');
  mirror(root, 'skills', 'new/SKILL.md', 'new\n');
  writeFile(root, '.opencode/skills/example/SKILL.md', 'adapted\n');
  overrides(root, { 'skills/example/SKILL.md': 'OpenCode conventions' });
  assert.equal(run(root).status, 0);
  for (const prefix of ['skills', '.opencode/skills']) {
    fs.renameSync(path.join(root, prefix, 'example'), path.join(root, prefix, 'renamed'));
  }
  assert.equal(run(root).status, 1); // stale declaration after rename
  overrides(root, { 'skills/renamed/SKILL.md': 'OpenCode conventions' });
  assert.equal(run(root).status, 0);
  fs.rmSync(path.join(root, 'skills/renamed'), { recursive: true });
  assert.equal(run(root).status, 1); // deletion must be ported explicitly
  fs.rmSync(path.join(root, '.opencode/skills/renamed'), { recursive: true });
  overrides(root, {});
  assert.equal(run(root).status, 0);
});

test('allows explicit fork-only retention, but rejects it for an upstream counterpart', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  mirror(root, 'agents');
  writeFile(root, '.opencode/skills/retained/SKILL.md', 'retained\n');
  overrides(root, { 'skills/retained/SKILL.md': { reason: 'Retained by fork after upstream removal', forkOnly: true } });
  assert.equal(run(root).status, 0);
  writeFile(root, 'skills/retained/SKILL.md', 'new upstream\n');
  assert.equal(run(root).status, 1);
});

test('three-way porting preserves adaptations and incoming upstream edits', () => {
  const root = makeSandbox();
  mirror(root, 'references');
  mirror(root, 'agents');
  const original = [
    'Claude configuration', ...Array.from({ length: 12 }, (_, index) => `shared line ${index}`), 'old upstream guidance', '',
  ].join('\n');
  const adapted = original.replace('Claude configuration', 'OpenCode configuration');
  const incoming = original.replace('old upstream guidance', 'new upstream guidance');
  writeFile(root, 'base.md', original);
  writeFile(root, 'local.md', adapted);
  writeFile(root, 'incoming.md', incoming);
  const merged = spawnSync('git', ['merge-file', '-p', 'local.md', 'base.md', 'incoming.md'], { cwd: root, encoding: 'utf8' });
  assert.equal(merged.status, 0, merged.stderr);
  assert.match(merged.stdout, /OpenCode configuration/);
  assert.match(merged.stdout, /new upstream guidance/);
  writeFile(root, 'skills/example/SKILL.md', incoming);
  writeFile(root, '.opencode/skills/example/SKILL.md', merged.stdout);
  overrides(root, { 'skills/example/SKILL.md': 'OpenCode configuration' });
  assert.equal(run(root).status, 0);
});
