---
description: Break work into small verifiable tasks with acceptance criteria and dependency ordering
agent: plan
---

Invoke the planning-and-task-breakdown skill.

Read the existing spec (`.opencode/spec/SPEC.md` or equivalent files in this folder) and the relevant codebase sections. Then:

1. Enter plan mode — read only, no code changes
2. Identify the dependency graph between components
3. Slice work vertically (one complete path per task, not horizontal layers)
4. Write tasks with acceptance criteria and verification steps
5. Add checkpoints between phases
6. Present the plan for human review

Save the plan to `.opencode/tasks/plan.md` and task list to `.opencode/tasks/todo.md`. If you are in Plan mode report back to the user and suggest to switch into the build mode to write the files.

If `.opencode/tasks/plan.md` or `.opencode/tasks/todo.md` already exists with unchecked tasks for different work, stop and ask before writing — never silently overwrite an incomplete plan.
