#!/usr/bin/env node

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MANIFEST_PATH = '.opencode/agent-skills-manifest.json';
const MANIFEST_SCHEMA_VERSION = 1;
const PACK_NAME = 'agent-skills-opencode';

class InstallerError extends Error {
  constructor(message, exitCode = 3) {
    super(message);
    this.exitCode = exitCode;
  }
}

function usage() {
  return `Usage: node scripts/install-opencode-assets.js <target> [--source <source-root>] [--dry-run] [--force]\n\n` +
    'Installs this repository\'s OpenCode assets into a Git worktree without replacing local changes by default.';
}

function parseArgs(args) {
  let target;
  let source = path.resolve(__dirname, '..');
  let dryRun = false;
  let force = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--source') {
      source = args[++index];
      if (!source) throw new InstallerError('--source requires a directory.', 1);
    } else if (arg.startsWith('-')) {
      throw new InstallerError(`Unknown option: ${arg}`, 1);
    } else if (!target) {
      target = arg;
    } else {
      throw new InstallerError(`Unexpected argument: ${arg}`, 1);
    }
  }
  if (!target) throw new InstallerError('A target Git worktree is required.\n\n' + usage(), 1);
  return { target, source: path.resolve(source), dryRun, force };
}

function lstatOrNull(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function assertDirectory(directory, label) {
  const stat = lstatOrNull(directory);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new InstallerError(`${label} must be a real directory: ${directory}`);
  }
}

function gitWorktreeRoot(candidate) {
  const stat = lstatOrNull(candidate);
  if (!stat || !stat.isDirectory()) throw new InstallerError(`Target directory does not exist: ${candidate}`);
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: candidate, encoding: 'utf8' });
  if (result.status !== 0) throw new InstallerError(`Target must be inside a non-bare Git worktree: ${candidate}`);
  return fs.realpathSync(result.stdout.trim());
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function posixJoin(...parts) {
  return parts.join('/');
}

function walkFiles(root, destinationPrefix) {
  const files = [];
  function walk(directory, relativeDirectory = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const sourcePath = path.join(directory, entry.name);
      const relativePath = relativeDirectory ? path.join(relativeDirectory, entry.name) : entry.name;
      const stat = fs.lstatSync(sourcePath);
      if (stat.isSymbolicLink()) throw new InstallerError(`Source asset must not be a symlink: ${sourcePath}`);
      if (stat.isDirectory()) {
        walk(sourcePath, relativePath);
      } else if (stat.isFile()) {
        const content = fs.readFileSync(sourcePath);
        files.push({
          sourcePath,
          destinationPath: posixJoin(destinationPrefix, ...relativePath.split(path.sep)),
          content,
          sha256: sha256(content),
          mode: stat.mode & 0o777,
        });
      } else {
        throw new InstallerError(`Source asset must be a regular file: ${sourcePath}`);
      }
    }
  }
  walk(root);
  return files;
}

function sourceAssets(sourceRoot) {
  const locations = [
    ['.opencode/commands', '.opencode/commands'],
    ['skills', '.opencode/skills'],
    ['.opencode/agents', '.opencode/agents'],
    ['.opencode/references', '.opencode/references'],
  ];
  const assets = [];
  for (const [sourceRelative, destinationPrefix] of locations) {
    const directory = path.join(sourceRoot, ...sourceRelative.split('/'));
    assertDirectory(directory, `Source ${sourceRelative}`);
    assets.push(...walkFiles(directory, destinationPrefix));
  }
  if (assets.length === 0) throw new InstallerError(`No portable OpenCode assets found in ${sourceRoot}`);
  return assets.sort((left, right) => left.destinationPath.localeCompare(right.destinationPath));
}

function assertNoDestinationSymlink(targetRoot, relativePath) {
  const pieces = relativePath.split('/');
  let current = targetRoot;
  for (const piece of pieces) {
    current = path.join(current, piece);
    const stat = lstatOrNull(current);
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new InstallerError(`Destination path contains a symlink: ${current}`);
  }
}

function loadManifest(targetRoot) {
  const manifestFile = path.join(targetRoot, ...MANIFEST_PATH.split('/'));
  assertNoDestinationSymlink(targetRoot, MANIFEST_PATH);
  const stat = lstatOrNull(manifestFile);
  if (!stat) return { files: {} };
  if (!stat.isFile()) throw new InstallerError(`Installer manifest is not a regular file: ${manifestFile}`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch {
    throw new InstallerError(`Installer manifest is invalid JSON: ${manifestFile}`);
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION || manifest.pack !== PACK_NAME || !manifest.files || Array.isArray(manifest.files)) {
    throw new InstallerError(`Installer manifest has an unsupported format: ${manifestFile}`);
  }
  for (const [file, record] of Object.entries(manifest.files)) {
    if (!record || typeof record.sha256 !== 'string') throw new InstallerError(`Installer manifest has an invalid file record: ${file}`);
  }
  return manifest;
}

function makePlan(targetRoot, assets, manifest, force) {
  const plan = { create: [], update: [], adopt: [], unchanged: [], retained: [], conflicts: [] };
  const currentPaths = new Set(assets.map(asset => asset.destinationPath));
  for (const oldPath of Object.keys(manifest.files)) {
    if (!currentPaths.has(oldPath)) plan.retained.push(oldPath);
  }

  for (const asset of assets) {
    assertNoDestinationSymlink(targetRoot, asset.destinationPath);
    const destination = path.join(targetRoot, ...asset.destinationPath.split('/'));
    const stat = lstatOrNull(destination);
    const record = manifest.files[asset.destinationPath];
    if (!stat) {
      if (record) {
        plan.conflicts.push(`${asset.destinationPath} was removed locally after installation`);
      } else {
        plan.create.push(asset);
      }
      continue;
    }
    if (!stat.isFile()) {
      plan.conflicts.push(`${asset.destinationPath} is not a regular file`);
      continue;
    }
    const destinationHash = sha256(fs.readFileSync(destination));
    if (destinationHash === asset.sha256) {
      (record ? plan.unchanged : plan.adopt).push(asset);
    } else if (record && destinationHash === record.sha256) {
      plan.update.push(asset);
    } else if (force) {
      plan.update.push(asset);
    } else {
      plan.conflicts.push(`${asset.destinationPath} differs from the source and is ${record ? 'locally modified' : 'not installer-owned'}`);
    }
  }
  return plan;
}

function gitRevision(sourceRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function writeAtomically(file, content, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.agent-skills-${process.pid}-${Math.random().toString(16).slice(2)}`);
  fs.writeFileSync(temporary, content, { mode });
  fs.chmodSync(temporary, mode);
  fs.renameSync(temporary, file);
}

function applyPlan(targetRoot, sourceRoot, assets, manifest, plan) {
  const changed = [...plan.create, ...plan.update];
  const backups = [];
  const created = [];
  const manifestFile = path.join(targetRoot, ...MANIFEST_PATH.split('/'));
  const manifestStat = lstatOrNull(manifestFile);
  const manifestBackup = manifestStat
    ? { content: fs.readFileSync(manifestFile), mode: manifestStat.mode & 0o777 }
    : null;
  try {
    for (const asset of changed) {
      const destination = path.join(targetRoot, ...asset.destinationPath.split('/'));
      const stat = lstatOrNull(destination);
      if (stat) {
        backups.push({ destination, content: fs.readFileSync(destination), mode: stat.mode & 0o777 });
      } else {
        created.push(destination);
      }
      writeAtomically(destination, asset.content, asset.mode);
    }
    const files = { ...manifest.files };
    for (const asset of assets) files[asset.destinationPath] = { sha256: asset.sha256 };
    const nextManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      pack: PACK_NAME,
      sourceRevision: gitRevision(sourceRoot),
      installedAt: new Date().toISOString(),
      files,
    };
    writeAtomically(manifestFile, `${JSON.stringify(nextManifest, null, 2)}\n`, 0o644);
  } catch (error) {
    for (const backup of backups.reverse()) writeAtomically(backup.destination, backup.content, backup.mode);
    for (const file of created.reverse()) {
      try { fs.unlinkSync(file); } catch { /* Best-effort cleanup after a failed install. */ }
    }
    if (manifestBackup) writeAtomically(manifestFile, manifestBackup.content, manifestBackup.mode);
    else {
      try { fs.unlinkSync(manifestFile); } catch { /* The manifest may not have been created yet. */ }
    }
    throw error;
  }
}

function printSummary(plan, dryRun) {
  if (dryRun) console.log('Dry run — no files were written.');
  console.log(`Install: ${plan.create.length}, update: ${plan.update.length}, adopt: ${plan.adopt.length}, unchanged: ${plan.unchanged.length}, retained: ${plan.retained.length}.`);
  if (plan.retained.length) console.log(`Retained obsolete installer-owned assets: ${plan.retained.join(', ')}`);
  console.log(`\nAdd this to the target project's AGENTS.md (review and adapt it; the installer never edits AGENTS.md):

## Skill-Driven Execution

This project uses OpenCode skills installed in \`.opencode/skills/\`.

- If a task matches a skill, invoke it with the \`skill\` tool before acting.
- Follow the selected skill workflow completely; do not skip its required spec, plan, or test steps.
- Map feature work to \`spec-driven-development\`, \`incremental-implementation\`, and \`test-driven-development\`; bugs to \`debugging-and-error-recovery\`; planning to \`planning-and-task-breakdown\`; review to \`code-review-and-quality\`.
`);
  console.log('Shared references were installed in .opencode/references/ and resolve from installed skills via ../../references/....');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  assertDirectory(options.source, 'Source root');
  const targetRoot = gitWorktreeRoot(options.target);
  const sourceRoot = fs.realpathSync(options.source);
  if (targetRoot === sourceRoot) throw new InstallerError('Refusing to install into the source repository itself.');
  const assets = sourceAssets(sourceRoot);
  const manifest = loadManifest(targetRoot);
  const plan = makePlan(targetRoot, assets, manifest, options.force);
  if (plan.conflicts.length) {
    console.error(`Conflict: installation aborted before writing files:\n- ${plan.conflicts.join('\n- ')}`);
    throw new InstallerError('Resolve the conflicts or re-run with --force to replace regular-file conflicts.', 2);
  }
  if (!options.dryRun) applyPlan(targetRoot, sourceRoot, assets, manifest, plan);
  printSummary(plan, options.dryRun);
}

try {
  main();
} catch (error) {
  if (!(error instanceof InstallerError)) console.error(error.stack || error.message);
  else if (error.exitCode !== 2) console.error(error.message);
  process.exitCode = error instanceof InstallerError ? error.exitCode : 3;
}
