#!/usr/bin/env node
/**
 * validate-artifact-paths.js
 *
 * Guards the spec -> plan -> build pipeline against silent artifact-path drift.
 *
 * The `/spec` and `/plan` commands (producers) write their artifacts to a set
 * of paths that the `/build` command and the spec/plan skills (consumers) read
 * back. When a producer moves an artifact without updating the consumers — as
 * in PR #93, which pointed `/spec` and `/plan` at docs/features/[name]/ while
 * `/build` still required SPEC.md and tasks/plan.md — the pipeline breaks, and
 * nothing else in CI catches it (command parity only compares descriptions).
 *
 * This validator enforces approved host-specific spec/plan/todo artifact paths
 * across every file in the pipeline. Changing the convention means updating
 * the approved defaults/module patterns *and* every guarded file in the same change; CI fails
 * until they agree.
 *
 * Scope is deliberately narrow: only spec/plan/todo artifacts, only the files
 * that define the pipeline. It is not a general markdown path linter.
 *
 * Exit codes: 0 = all clear, 1 = one or more drifted paths.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// The canonical spec/plan/todo artifact paths. These are the only artifact
// default file paths the pipeline files may reference. Stable module specs are
// also accepted below. Update the policy and affected pipeline files together.
const ARTIFACT_ALLOWLIST = new Set([
  'SPEC.md',        // spec, project root (produced by /spec, read by /build)
  'docs/SPEC.md',   // spec, alternate location accepted by /build
  'tasks/plan.md',  // plan (produced by /plan, read by /build)
  'tasks/todo.md',  // task list (produced by /plan)
  // OpenCode adapter (fork extension): writes under .opencode/ instead of the
  // project root so generated artifacts don't collide with a host project's own.
  '.opencode/spec/SPEC.md',
  '.opencode/tasks/plan.md',
  '.opencode/tasks/todo.md',
]);

// The files that make up the spec -> plan -> build pipeline. Absent files are
// skipped, not failed: this validator checks path consistency, not presence.
//
// The command bodies exist once per host surface (validate-commands.js checks
// that the three sets stay in step on descriptions, but their prompt bodies
// are allowed to differ), so a producer or consumer can drift on one surface
// while the Claude Code copy stays correct. Every surface is guarded here.
const GUARDED_FILES = [
  // Claude Code commands
  '.claude/commands/spec.md',
  '.claude/commands/plan.md',
  '.claude/commands/build.md',
  // Gemini CLI commands
  '.gemini/commands/spec.toml',
  '.gemini/commands/planning.toml',
  '.gemini/commands/build.toml',
  // Root command set (Antigravity, Codex, and other TOML-based hosts)
  'commands/spec.toml',
  'commands/planning.toml',
  'commands/build.toml',
  // OpenCode commands (fork extension)
  '.opencode/commands/spec.md',
  '.opencode/commands/plan.md',
  '.opencode/commands/build.md',
  '.opencode/skills/spec-driven-development/SKILL.md',
  '.opencode/skills/planning-and-task-breakdown/SKILL.md',
  // OpenCode producers and consumers may only use the .opencode/ paths.
  // Compatibility skills retain root defaults.
  // Skills the commands invoke
  'skills/spec-driven-development/SKILL.md',
  'skills/planning-and-task-breakdown/SKILL.md',
  // Docs that tell users where the artifacts live
  'docs/getting-started.md',
  'docs/adoption-guide.md',
  'docs/copilot-setup.md', // its prompt-file aliases name the artifacts directly
  'docs/opencode-setup.md',
];

// Matches a path-like token ending in a spec/module-spec/plan/todo artifact filename,
// including an optional directory prefix with bracket placeholders like
// docs/features/[feature-name]/spec.md. Case-insensitive so SPEC.md and a
// drifted spec.md are both caught, then compared against the allowlist.
const ARTIFACT_RE = /(?:[A-Za-z0-9._[\]-]+\/)*(?:spec(?:-(?:[A-Za-z0-9-]+|<module>))?|plan|todo)\.md/gi;

function findViolations(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null; // skipped

  const violations = [];
  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const matches = line.match(ARTIFACT_RE);
    if (!matches) return;
    for (const match of matches) {
      const modulePath = /^\.opencode\/spec\/SPEC-(?:[a-z0-9]+(?:-[a-z0-9]+)*|<module>)\.md$/.test(match);
      const compatibilityModule = /^SPEC-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(match);
      const approved = ARTIFACT_ALLOWLIST.has(match) || modulePath || (!relPath.startsWith('.opencode/') && compatibilityModule);
      if (!approved || (relPath.startsWith('.opencode/') && !match.startsWith('.opencode/'))) {
        violations.push({ line: i + 1, match });
      }
    }
  });
  return violations;
}

function main() {
  console.log('Checking spec/plan/todo artifact paths...\n');

  let checked = 0;
  let errors = 0;

  for (const relPath of GUARDED_FILES) {
    const violations = findViolations(relPath);
    if (violations === null) continue; // file not present, skip
    checked++;

    if (violations.length === 0) {
      console.log(`  ✓  ${relPath}`);
    } else {
      console.log(`  ✗  ${relPath}`);
      for (const { line, match } of violations) {
        console.log(`       L${line}: ${match} — not an approved spec/plan/todo artifact path`);
        errors++;
      }
    }
  }

  // A valid producer path must also be writable under the repo's narrow Plan policy.
  // Consumer installations may omit this configuration entirely.
  const configFile = path.join(ROOT, '.opencode', 'opencode.json');
  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      const edit = config.agent?.plan?.permission?.edit;
      const required = ['.opencode/spec/SPEC.md', '.opencode/spec/SPEC-*.md', '.opencode/tasks/plan.md', '.opencode/tasks/todo.md'];
      if (!edit || typeof edit !== 'object' || Array.isArray(edit) || edit['*'] !== 'deny' || required.some((key) => edit[key] !== 'allow') || Object.entries(edit).some(([key, value]) => key !== '*' && value !== 'deny' && !required.includes(key))) {
        console.log('  ✗  .opencode/opencode.json — Plan edit permissions must allow the index, module specs, plan and todo artifacts, and deny other writes');
        errors++;
      } else console.log('  ✓  .opencode/opencode.json — narrow planning artifact permissions');
    } catch (error) {
      console.log(`  ✗  .opencode/opencode.json — ${error.message}`);
      errors++;
    }
  }

  const status = errors > 0 ? 'FAILED' : 'PASSED';
  console.log(`\n${checked} files checked — ${errors} error(s) — ${status}`);

  if (errors > 0) {
    console.log('\nEach host pipeline must use its own approved artifact paths. OpenCode uses .opencode/.');
    console.log('Either use a path from ARTIFACT_ALLOWLIST, or change the convention');
    console.log('across every guarded file and update the allowlist in the same change.');
    process.exit(1);
  }
}

main();
