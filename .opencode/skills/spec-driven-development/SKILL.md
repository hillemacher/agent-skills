---
name: spec-driven-development
description: Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists yet. Use when drafting a PRD or requirements document with objectives and scope, or when requirements are unclear, ambiguous, or only exist as a vague idea. Use when a single requirement spans several independently testable capabilities and needs decomposing into a capability map of modules before specifying.
---

# Spec-Driven Development

## Overview

Write a structured specification before writing any code. The spec is the shared source of truth between you and the human engineer — it defines what we're building, why, and how we'll know it's done. Code without a spec is guessing.

## When to Use

- Starting a new project or feature
- Requirements are ambiguous or incomplete
- The change touches multiple files or modules
- You're about to make an architectural decision
- The task would take more than 30 minutes to implement

**When NOT to use:** Single-line fixes, typo corrections, or changes where requirements are unambiguous and self-contained.

## The Gated Workflow

Spec-driven development has four phases, preceded by a scope check (Phase 0) that activates only when one request bundles several independently testable capabilities. Do not advance to the next phase until the current one is validated.

```
SPECIFY ──→ PLAN ──→ TASKS ──→ IMPLEMENT
   │          │        │          │
   ▼          ▼        ▼          ▼
 Human      Human    Human      Human
 reviews    reviews  reviews    reviews
```

### Phase 0: Scope Check

Most requests describe one capability. If this one does, skip this phase and go straight to Specify — Phase 0 exists for the exception, not the rule, and it puts no hierarchy on single-capability features.

**Detection.** Decompose before specifying when a single requirement bundles several independently testable capabilities:

- The requirement names distinct capabilities with their own consumers or data (e.g. identity, billing, notifications, reporting)
- Acceptance criteria cluster into groups that could ship and be verified separately
- One capability could be cut or replaced without rewriting the others' requirements

**Propose a capability map before writing any spec.** Small and reviewable — a module table plus a build order, not a project plan:

```markdown
# Capability Map: [Initiative Name]

| Module id | Responsibility | Depends on | Specification | Approval |
|---|---|---|---|---|
| identity | Accounts, sessions, SSO | — | .opencode/spec/SPEC-identity.md | pending |
| billing | Plans, invoices, payments | identity | .opencode/spec/SPEC-billing.md | pending |
| notifications | Email and webhook fan-out | identity | .opencode/spec/SPEC-notifications.md | pending |
| reporting | Usage dashboards | billing, notifications | .opencode/spec/SPEC-reporting.md | pending |

Build order: identity → billing, notifications → reporting
```

- **Stable module ids.** Kebab-case, chosen once, never renamed mid-initiative. Specs, plans, and downstream commands select work by these ids instead of guessing which spec is active.
- **Dependency direction, no cycles.** Arrows point one way. If two modules each need the other, they are one module.
- **Interfaces live at the boundary.** The map records that `billing` depends on `identity`; the contract between them belongs in the provider module's spec (see `api-and-interface-design` for designing it).

**The map is gated like every phase.** The human reviews module boundaries, dependency direction, and build order before any module spec is written. Getting the map wrong is expensive; reviewing ten lines is not.

**Then recurse per module.** Run Specify → Plan → Tasks → Implement for each module in dependency order. Each module gets its own spec, scoped to that module's objective, boundaries, and success criteria. Save the approved capability map as the index at `.opencode/spec/SPEC.md`. Save each approved module specification alongside it as `.opencode/spec/SPEC-<module>.md`, using the stable kebab-case module id (for example `.opencode/spec/SPEC-identity.md`). The index records each module's specification path and approval status; a proposed path is not an approved specification. `/plan` and `/build` require an explicit selected module from the user or an existing plan, resolve its approved specification through this index, and do not treat the map alone as implementation requirements. Keep the shared plan scoped to one selected module; never overwrite another module's incomplete plan.

### Phase 1: Specify

Start with a high-level vision. Ask the human clarifying questions until requirements are concrete.

**Surface assumptions immediately.** Before writing any spec content, list what you're assuming:

```
ASSUMPTIONS I'M MAKING:
1. This is a web application (not native mobile)
2. Authentication uses session-based cookies (not JWT)
3. The database is PostgreSQL (based on existing Prisma schema)
4. We're targeting modern browsers only (no IE11)
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The spec's entire purpose is to surface misunderstandings *before* code gets written — assumptions are the most dangerous form of misunderstanding.

**Write a spec document covering these six core areas:**

1. **Objective** — What are we building and why? Who is the user? What does success look like?

2. **Commands** — Full executable commands with flags, not just tool names.
   ```
   Build: npm run build
   Test: npm test -- --coverage
   Lint: npm run lint --fix
   Dev: npm run dev
   ```

3. **Project Structure** — Where source code lives, where tests go, where docs belong.
   ```
   src/           → Application source code
   src/components → React components
   src/lib        → Shared utilities
   tests/         → Unit and integration tests
   e2e/           → End-to-end tests
   docs/          → Documentation
   ```

4. **Code Style** — One real code snippet showing your style beats three paragraphs describing it. Include naming conventions, formatting rules, and examples of good output.

5. **Testing Strategy** — What framework, where tests live, coverage expectations, which test levels for which concerns.

6. **Boundaries** — Three-tier system:
   - **Always do:** Run tests before commits, follow naming conventions, validate inputs
   - **Ask first:** Database schema changes, adding dependencies, changing CI config
   - **Never do:** Commit secrets, edit vendor directories, remove failing tests without approval

**Spec template:**

```markdown
# Spec: [Project/Feature Name]

## Objective
[What we're building and why. User stories or acceptance criteria.]

## Tech Stack
[Framework, language, key dependencies with versions]

## Commands
[Build, test, lint, dev — full commands]

## Project Structure
[Directory layout with descriptions]

## Code Style
[Example snippet + key conventions]

## Testing Strategy
[Framework, test locations, coverage requirements, test levels]

## Boundaries
- Always: [...]
- Ask first: [...]
- Never: [...]

## Success Criteria
[How we'll know this is done — specific, testable conditions]

## Open Questions
[Anything unresolved that needs human input]
```

**Output convention:** For a single capability, save the approved specification to `.opencode/spec/SPEC.md`. For multi-module work, that path is the capability-map index and each selected module has its own specification as described in Phase 0. Save only artifacts permitted by the current host; if a module path is denied in Plan mode, present the content and explain that a narrow permission exception or Build mode is needed.

**External spec tools:** This workflow is format-agnostic. If the project
already uses OpenSpec or another specification system, keep that system's
artifact format and storage conventions instead of creating a duplicate
`.opencode/spec/SPEC.md`. This skill owns the clarification, content, and approval gates; the
external tool owns how the approved spec is represented.

**Specification handoff:** `/plan` and both `/build` modes use an approved specification explicitly identified by the user or recorded in an existing plan. This may be a local path or an external system's artifact id/link; verify that it is readable, approved, and covers the selected work before proceeding. An explicit selection takes precedence over the default path, but must agree with an existing incomplete plan. A README or arbitrary document does not become a specification merely because it exists.

Without an explicit selection or recorded handoff, use `.opencode/spec/SPEC.md` if it is an approved single-capability specification. If it is a capability-map index, require an explicit module selection and resolve the module's approved spec from the index. If no approved specification can be resolved, stop and request the missing source or `/spec`; do not invent requirements or require an external system to create a duplicate default file.

The plan records a **Specification source** (path or external id/link), **Module** (selected id, or single capability), and **Task list target** (default checklist path or designated external tracker). For multi-module work, also record the capability-map source. Check module dependencies before planning or building; if a dependency is unimplemented, surface it rather than changing the selected module silently.


**Reframe instructions as success criteria.** When receiving vague requirements, translate them into concrete conditions:

```
REQUIREMENT: "Make the dashboard faster"

REFRAMED SUCCESS CRITERIA:
- Dashboard LCP < 2.5s on 4G connection
- Initial data load completes in < 500ms
- No layout shift during load (CLS < 0.1)
→ Are these the right targets?
```

This lets you loop, retry, and problem-solve toward a clear goal rather than guessing what "faster" means.

### Phase 2: Plan

With the validated spec, generate a technical implementation plan:

1. Identify the major components and their dependencies
2. Determine the implementation order (what must be built first)
3. Note risks and mitigation strategies
4. Identify what can be built in parallel vs. what must be sequential
5. Define verification checkpoints between phases

> Follow `planning-and-task-breakdown` for the dependency-graph mapping and vertical-slicing mechanics behind these steps; it is the canonical source. The bullets above are a lightweight summary; if they ever diverge, `planning-and-task-breakdown` takes precedence.
>
> **Output convention:** Save the plan to `.opencode/tasks/plan.md` and record the task list in the task list target defined by `planning-and-task-breakdown` (default `.opencode/tasks/todo.md`; projects may designate an external tracker instead). Create `.opencode/tasks/` if it does not exist. Downstream commands (`/build`, etc.) expect these defaults.

The plan should be reviewable: the human should be able to read it and say "yes, that's the right approach" or "no, change X."

### Phase 3: Tasks

Break the plan into discrete, implementable tasks:

- Each task should be completable in a single focused session
- Each task has explicit acceptance criteria
- Each task includes a verification step (test, build, manual check)
- Tasks are ordered by dependency, not by perceived importance
- No task should require changing more than ~5 files

> Follow `planning-and-task-breakdown` for the full task-sizing and dependency-ordering mechanics; it is the canonical source. The template below is a lightweight inline form; if they ever diverge, `planning-and-task-breakdown` takes precedence.

**Task template:**
```markdown
- [ ] Task: [Description]
  - Acceptance: [What must be true when done]
  - Verify: [How to confirm — test command, build, manual check]
  - Files: [Which files will be touched]
```

### Phase 4: Implement

Execute tasks one at a time following `skills/incremental-implementation/SKILL.md` (`incremental-implementation`) and `skills/test-driven-development/SKILL.md` (`test-driven-development`). Use `skills/context-engineering/SKILL.md` (`context-engineering`) to load the right spec sections and source files at each step rather than flooding the agent with the entire spec.

## Keeping the Spec Alive

The spec is a living document, not a one-time artifact:

- **Update when decisions change** — If you discover the data model needs to change, update the spec first, then implement.
- **Update when scope changes** — Features added or cut should be reflected in the spec.
- **Offer a version-control handoff when the skill work concludes** — Gather every specification artifact written or updated by this workflow: the spec document for single-capability work, or the approved capability map and all module specs for multi-module work. If inside a Git worktree, check each path with `git check-ignore -q -- <path>`. Exclude ignored paths. If any eligible paths remain, list them and ask the user whether to commit them; stage and commit only after an explicit affirmative. If every artifact is ignored, Git is unavailable, or the user declines, do not commit anything.
- **Reference the spec in PRs** — Link back to the spec section that each PR implements.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is simple, I don't need a spec" | Simple tasks don't need *long* specs, but they still need acceptance criteria. A two-line spec is fine. |
| "I'll write the spec after I code it" | That's documentation, not specification. The spec's value is in forcing clarity *before* code. |
| "The spec will slow us down" | A 15-minute spec prevents hours of rework. Waterfall in 15 minutes beats debugging in 15 hours. |
| "Requirements will change anyway" | That's why the spec is a living document. An outdated spec is still better than no spec. |
| "The user knows what they want" | Even clear requests have implicit assumptions. The spec surfaces those assumptions. |
| "It's one big feature; splitting it is overhead" | If acceptance criteria cluster into independently testable groups, a monolithic spec forces every downstream task to reason over the whole contract. A ten-line capability map is the cheap alternative. |
| "I'll decompose during planning" | Planning slices tasks within a spec. By then the oversized artifact already exists — module boundaries and dependency direction must be decided before the spec is written, not after. |

## Red Flags

- Starting to write code without any written requirements
- Asking "should I just start building?" before clarifying what "done" means
- Implementing features not mentioned in any spec or task list
- Making architectural decisions without documenting them
- Skipping the spec because "it's obvious what to build"
- One spec whose requirements span several independently testable capabilities
- Module boundaries or build order decided implicitly during implementation because no capability map was approved up front

## Verification

Before proceeding to implementation, confirm:

- [ ] The spec covers all six core areas
- [ ] The human has reviewed and approved the spec
- [ ] Success criteria are specific and testable
- [ ] Boundaries (Always/Ask First/Never) are defined
- [ ] The spec is saved to a file in the repository
- [ ] If the request bundles several independently testable capabilities, a capability map (module ids, dependency direction, build order) was approved before any module spec was written
- [ ] Every module spec traces to a module id in the approved map
