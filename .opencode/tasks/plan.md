# Implementation Plan: Safe OpenCode artifact copier

## Work Handoff

- Specification source: .opencode/spec/SPEC.md (user-approved plan).
- Module: single capability.
- Task list target: .opencode/tasks/todo.md.

## Implementation Order

1. Test and implement source discovery, safe target validation, automatic additions, and dry runs.
2. Test and implement conflict prompts and whole-skill merge/skip decisions; collect answers before writes.
3. Test and implement atomic writes, rollback, and cancellation handling.
4. Document CLI behavior, add tests to platform CI, and run the focused suite and repository checks.

## Decisions

Use a standalone CommonJS script and built-in APIs. Process agents, commands, references, skills in that order, with sorted artifacts. Replace matching files, preserve destination-only files, and leave identical files unchanged. No manifest or Git dependency. Missing target directories are created only when applying the complete plan.

## Verification

Each implementation slice runs its focused node:test coverage; final verification runs both copier and existing installer tests plus artifact-path validation. Use fault injection in tests to verify rollback without requiring platform-specific permissions.
