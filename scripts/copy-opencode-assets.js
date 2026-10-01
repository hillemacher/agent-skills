#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { randomBytes } = require('node:crypto');

const TYPES = ['agents', 'commands', 'references', 'skills'];

class CopierError extends Error {
  constructor(message, exitCode = 3) {
    super(message);
    this.exitCode = exitCode;
  }
}

function usage() {
  return 'Usage: node scripts/copy-opencode-assets.js <target> [--source <source-root>] [--dry-run]\n\n' +
    'Merge adapted OpenCode agents, commands, references, and skills directly into an artifact folder.';
}

function parseArgs(args) {
  const options = { source: path.resolve(__dirname, '..'), dryRun: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--source') {
      const source = args[++index];
      if (!source || source.startsWith('-')) throw new CopierError('--source requires a directory.', 1);
      options.source = path.resolve(source);
    } else if (arg.startsWith('-')) throw new CopierError(`Unknown option: ${arg}`, 1);
    else if (!options.target) options.target = path.resolve(arg);
    else throw new CopierError(`Unexpected argument: ${arg}`, 1);
  }
  if (!options.target) throw new CopierError('A target artifact folder is required.\n\n' + usage(), 1);
  return options;
}

function statOrNull(file) {
  try { return fs.lstatSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function assertPath(file, directory) {
  const stat = statOrNull(file);
  if (!stat) return null;
  if (stat.isSymbolicLink()) throw new CopierError(`Path must not be a symlink: ${file}`);
  if (directory ? !stat.isDirectory() : !stat.isFile()) {
    throw new CopierError(`Path must be a ${directory ? 'directory' : 'regular file'}: ${file}`);
  }
  return stat;
}

function canonicalTarget(target) {
  const missing = [];
  let existing = target;
  while (!assertPath(existing, true)) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(fs.realpathSync(existing), ...missing);
}

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

function walk(directory, prefix, files = [], directories = []) {
  directories.push(prefix);
  for (const name of fs.readdirSync(directory).sort()) {
    const source = path.join(directory, name);
    const relative = `${prefix}/${name}`;
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new CopierError(`Source asset must not be a symlink: ${source}`);
    if (stat.isDirectory()) walk(source, relative, files, directories);
    else if (stat.isFile()) files.push({ relative, content: fs.readFileSync(source), mode: stat.mode & 0o777 });
    else throw new CopierError(`Source asset must be a regular file or directory: ${source}`);
  }
  return { files, directories };
}

function sourceArtifacts(sourceRoot) {
  const artifacts = [];
  for (const type of TYPES) {
    const directory = path.join(sourceRoot, '.opencode', type);
    if (!assertPath(path.join(sourceRoot, '.opencode'), true) || !assertPath(directory, true)) {
      throw new CopierError(`Source ${type} directory is missing: ${directory}`);
    }
    if (type === 'skills') {
      for (const name of fs.readdirSync(directory).sort()) {
        const skill = path.join(directory, name);
        if (!assertPath(skill, true) || !assertPath(path.join(skill, 'SKILL.md'), false)) {
          throw new CopierError(`Source skill must contain SKILL.md: ${skill}`);
        }
        artifacts.push({ type, relative: `skills/${name}`, ...walk(skill, `skills/${name}`) });
      }
    } else {
      for (const file of walk(directory, type).files) {
        artifacts.push({ type, relative: file.relative, files: [file], directories: [] });
      }
    }
  }
  if (!artifacts.length) throw new CopierError(`No portable OpenCode assets found in ${sourceRoot}`);
  return artifacts;
}

function validateDestination(targetRoot, relative, directory) {
  const parts = relative.split('/');
  let current = targetRoot;
  assertPath(current, true);
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    assertPath(current, index < parts.length - 1 || directory);
  }
  return statOrNull(current);
}

function makePlan(targetRoot, artifacts) {
  for (const type of TYPES) validateDestination(targetRoot, type, true);
  for (const artifact of artifacts) {
    artifact.writes = [];
    let conflict = false;
    const existed = validateDestination(targetRoot, artifact.relative, artifact.type === 'skills');
    let missingDirectory = false;
    for (const directory of artifact.directories) {
      if (!validateDestination(targetRoot, directory, true)) missingDirectory = true;
    }
    for (const file of artifact.files) {
      const stat = validateDestination(targetRoot, file.relative, false);
      const destination = path.join(targetRoot, ...file.relative.split('/'));
      file.original = stat ? { content: fs.readFileSync(destination), mode: stat.mode & 0o777 } : null;
      const identical = stat && file.original.content.equals(file.content) &&
        (process.platform === 'win32' || (stat.mode & 0o777) === file.mode);
      if (!identical) artifact.writes.push(file);
      if (stat && !identical) conflict = true;
    }
    artifact.status = conflict ? 'conflict' : !existed || artifact.writes.length || missingDirectory ? 'create' : 'unchanged';
  }
  return artifacts;
}

async function resolveConflicts(plan) {
  if (!plan.some(artifact => artifact.status === 'conflict')) return;
  const input = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  const answers = input[Symbol.asyncIterator]();
  const bulk = new Map();
  let cancelled = false;
  function cancel() {
    cancelled = true;
    input.close();
  }
  input.on('SIGINT', cancel);
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    for (const artifact of plan) {
      if (artifact.status !== 'conflict') continue;
      if (bulk.has(artifact.type)) {
        artifact.status = bulk.get(artifact.type);
        continue;
      }
      while (artifact.status === 'conflict') {
        console.log(`Conflict ${artifact.relative}: replace (r), skip (s), replace all (ra), skip all (sa)` +
          ` for ${artifact.type} [r/s/ra/sa] (default: skip; q: cancel):`);
        const answer = await answers.next();
        if (cancelled || answer.done) throw new CopierError('Input cancelled or exhausted; no files were written.', 2);
        const value = answer.value.trim().toLowerCase();
        if (['q', 'quit', 'cancel', '\u0003'].includes(value)) throw new CopierError('Copy cancelled; no files were written.', 2);
        if (['r', 'replace', 'ra', 'replace all', 'replace-all'].includes(value)) artifact.status = 'replace';
        else if (['', 's', 'skip', 'sa', 'skip all', 'skip-all'].includes(value)) artifact.status = 'skip';
        else {
          console.log('Invalid answer. Enter r, s, ra, or sa.');
          continue;
        }
        if (['ra', 'replace all', 'replace-all', 'sa', 'skip all', 'skip-all'].includes(value)) {
          bulk.set(artifact.type, artifact.status);
        }
      }
    }
    if (cancelled) throw new CopierError('Copy cancelled; no files were written.', 2);
  } finally {
    input.close();
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

function ensureDirectory(directory, createdDirectories) {
  if (assertPath(directory, true)) return;
  ensureDirectory(path.dirname(directory), createdDirectories);
  fs.mkdirSync(directory);
  createdDirectories.push(directory);
}

function writeAtomically(destination, content, mode) {
  const temporary = path.join(path.dirname(destination),
    `.${path.basename(destination)}.agent-skills-${process.pid}-${randomBytes(6).toString('hex')}`);
  const descriptor = fs.openSync(temporary, 'wx', mode);
  try {
    try {
      fs.writeFileSync(descriptor, content);
      fs.fchmodSync(descriptor, mode);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, destination);
  } finally {
    if (statOrNull(temporary)) fs.unlinkSync(temporary);
  }
}

function validatePlan(targetRoot, selected) {
  for (const type of TYPES) validateDestination(targetRoot, type, true);
  for (const artifact of selected) {
    for (const directory of artifact.directories) validateDestination(targetRoot, directory, true);
    for (const file of artifact.files) {
      const stat = validateDestination(targetRoot, file.relative, false);
      const destination = path.join(targetRoot, ...file.relative.split('/'));
      const unchanged = file.original
        ? stat && fs.readFileSync(destination).equals(file.original.content) && (stat.mode & 0o777) === file.original.mode
        : !stat;
      if (!unchanged) throw new CopierError(`Destination changed while collecting answers: ${file.relative}; no files were written.`, 2);
    }
  }
}

function applyPlan(targetRoot, plan) {
  const selected = plan.filter(artifact => ['create', 'replace'].includes(artifact.status));
  validatePlan(targetRoot, selected);
  const changedFiles = [];
  const createdDirectories = [];
  try {
    for (const type of TYPES) ensureDirectory(path.join(targetRoot, type), createdDirectories);
    for (const artifact of selected) {
      for (const directory of artifact.directories) ensureDirectory(path.join(targetRoot, ...directory.split('/')), createdDirectories);
      for (const file of artifact.writes) {
        const destination = path.join(targetRoot, ...file.relative.split('/'));
        ensureDirectory(path.dirname(destination), createdDirectories);
        changedFiles.push({ destination, original: file.original });
        writeAtomically(destination, file.content, file.mode);
      }
    }
  } catch (error) {
    const failures = [];
    for (const { destination, original } of changedFiles.reverse()) {
      try {
        if (original) writeAtomically(destination, original.content, original.mode);
        else if (statOrNull(destination)) fs.unlinkSync(destination);
      } catch (rollbackError) {
        failures.push(`${destination}: ${rollbackError.message}`);
      }
    }
    for (const directory of createdDirectories.reverse()) {
      try { fs.rmdirSync(directory); }
      catch (rollbackError) { failures.push(`${directory}: ${rollbackError.message}`); }
    }
    throw new CopierError(`Copy failed: ${error.message}. ` +
      (failures.length ? `Rollback incomplete:\n- ${failures.join('\n- ')}` : 'Original files restored; new files and directories removed.'));
  }
}

function printSummary(plan, dryRun) {
  if (dryRun) {
    console.log('Dry run — no files were written.');
    for (const artifact of plan) console.log(`${artifact.status} ${artifact.relative}`);
  }
  for (const type of TYPES) {
    const count = status => plan.filter(artifact => artifact.type === type && artifact.status === status).length;
    console.log(`${type}: created ${count('create')}, replaced ${count('replace')}, skipped ${count('skip')}, unchanged ${count('unchanged')}` +
      (dryRun ? `, conflicts ${count('conflict')}` : '') + '.');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return console.log(usage());
  if (!assertPath(options.source, true)) throw new CopierError(`Source root does not exist: ${options.source}`);
  const sourceRoot = fs.realpathSync(options.source);
  const targetRoot = canonicalTarget(options.target);
  if (contains(sourceRoot, targetRoot) || contains(targetRoot, sourceRoot)) {
    throw new CopierError('Source and destination must not overlap.');
  }
  const plan = makePlan(targetRoot, sourceArtifacts(sourceRoot));
  if (!options.dryRun) {
    await resolveConflicts(plan);
    applyPlan(targetRoot, plan);
  }
  printSummary(plan, options.dryRun);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = error instanceof CopierError ? error.exitCode : 3;
});
