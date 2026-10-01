# Spec: Safe OpenCode artifact copier

Approved by the user's explicit request to implement the Safe OpenCode artifact copier plan.

## Objective

Merge the adapted agents, commands, references, and complete skills from this repository into an arbitrary artifact folder without deleting unrelated content. Prompt for conflicting artifacts with replace, skip, replace all, and skip all; bulk answers apply to one artifact type only. A skill receives one decision for all its source files and retains destination-only files.

## Commands

```bash
node scripts/copy-opencode-assets.js <target> [--source <source-root>] [--dry-run]
node --test scripts/copy-opencode-assets-test.js scripts/install-opencode-assets-test.js
node scripts/validate-artifact-paths.js
```

## Project Structure and Tech Stack

Dependency-free Node.js CommonJS CLI and node:test integration tests under scripts/. Document the CLI in docs/opencode-setup.md and include its tests in existing platform CI jobs.

## Code Style

Follow the existing installer: two-space indentation, single quotes, named functions, built-in node: modules, and explicit error messages. Example: `const targetRoot = path.resolve(options.target);`.

## Testing Strategy

Use isolated temporary source and destination trees, real CLI subprocesses, and newline-delimited stdin answers. Cover merges, whole-skill decisions, cancellation before writes, dry runs, unsafe paths, permission preservation, and rollback after an injected filesystem failure.

## Boundaries and Success Criteria

- Always preserve unrelated and destination-only files; create missing folders; retain complete skill supporting resources and relative links.
- Gather decisions before writing; blank means skip, invalid answers retry, cancellation or unresolved EOF aborts without writes.
- Dry run reports additions, unchanged artifacts, and conflicts without prompts or writes.
- Reject symlinks, file/directory mismatches, and source/destination overlap before applying changes.
- Atomic writes and rollback protect original files after write failures.
- Never edit the existing installer or copy configuration, instructions, planning artifacts, or manifests.
- Changes beyond the approved script, tests, documentation, and CI integration require separate agreement.
- No Git requirement, no ownership manifest, no obsolete-file deletion, and no content/path rewriting.

## Open Questions

None. The target is the artifact folder itself and always uses plural skills/.
