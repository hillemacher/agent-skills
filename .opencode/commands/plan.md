---
description: Break work into small verifiable tasks with acceptance criteria and dependency ordering
agent: plan
---

Invoke the planning-and-task-breakdown skill.

Resolve the approved specification using the handoff in `spec-driven-development`: use the user's explicit specification/module selection or the source recorded in an existing plan; otherwise use an approved single-capability `.opencode/spec/SPEC.md`. If that file is a capability-map index, require an explicit module selection and follow its approved spec path. An explicitly identified, readable, approved external specification is supported without creating a duplicate local file. Do not guess among module specs or replace another module's incomplete plan.

Read the resolved specification and relevant codebase sections. Then:

1. Use Plan mode — no implementation changes; save only permitted planning artifacts
2. Identify the dependency graph between components
3. Slice work vertically (one complete path per task, not horizontal layers)
4. Write tasks with acceptance criteria and verification steps
5. Add checkpoints between phases
6. Present the plan for human review

Save the plan to `.opencode/tasks/plan.md`, recording the specification source, selected module and capability-map source when applicable, and task list target. Use the task list target defined by `planning-and-task-breakdown`: by default write `.opencode/tasks/todo.md`; when the user or existing project instructions designate an external tracker, create tasks there instead and keep an ordered index of item IDs/links in the plan. Do not create a duplicate todo checklist for external tracker work. If the designated tracker is unavailable or unauthorized, report that blocker rather than silently switching targets. The repository configuration permits writing these planning artifacts in Plan mode. If the host project denies these paths, present the plan and explain that Build mode or a narrow permission exception is needed to save it.

If `.opencode/tasks/plan.md` or `.opencode/tasks/todo.md` already exists with unchecked tasks for different work, stop and ask before writing — never silently overwrite an incomplete plan.
