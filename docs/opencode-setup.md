# OpenCode Setup

This guide explains how to use Agent Skills with OpenCode. The reusable assets are the markdown skills in the `skills/` directory; the root `AGENTS.md` file in this repository is repo-scoped and should not be copied into other projects.

## Overview

OpenCode does not have a native plugin system, but it supports both automatic skill routing and custom `/commands`. This integration ships both:

- A strong system prompt (`AGENTS.md`)
- The built-in `skill` tool
- Consistent skill discovery via the `.opencode/skills` symlink to the `skills/` directory
- A checked-in `.opencode/agents/` mirror for specialist personas
- A checked-in `.opencode/references/` mirror for shared skill checklists
- Optional slash commands in `.opencode/commands/` for users who prefer explicit, manual invocation over relying on intent detection

This creates an **agent-driven workflow** by default, where skills are selected and executed automatically, while still giving you `/spec`, `/plan`, and the rest of the lifecycle commands when you want to trigger a workflow explicitly.

- Skills are selected automatically based on intent, or explicitly via slash command
- Workflows are enforced via `AGENTS.md`
- No manual command invocation is required — but it's available

This more closely matches how Claude Code behaves in practice, where skills are triggered automatically but slash commands remain available as an explicit entry point.

If you're installing these skills into a separate project rather than working in this repo, the two pieces above are still optional independently: an **agent-driven workflow** (skills selected automatically via the `skill` tool and your own project-local `AGENTS.md`) and a **command-driven workflow** (manually invoking lifecycle commands you copy into `.opencode/commands/`).

---

## Installation

There are two ways to get the skills into your project:

1. Install with the `skills` CLI (fastest).
2. Clone this repository and copy the skill directories manually.

After either step, create your own project-local `AGENTS.md` and, if you want them, copy the `.opencode/commands/*.md` files.

### Option 1: Install with `npx skills`

The fastest path is the open [`skills` CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add addyosmani/agent-skills            # install selected skills
npx skills add addyosmani/agent-skills --list     # browse before installing
```

Install a single skill:

```bash
npx skills add addyosmani/agent-skills --skill spec-driven-development
```

By default `npx skills` installs into a tool-specific directory (often `.claude/skills/` or a shared location). OpenCode will discover skills placed there because it reads `.claude/skills/<name>/SKILL.md` and the generic `.agents/skills/<name>/SKILL.md` paths.

If the skills land somewhere OpenCode does not scan, copy or symlink them into one of the discovery paths listed below, for example:

```bash
mkdir -p .opencode/skills
cp -r .claude/skills/<skill-name> .opencode/skills/
```

> **Note:** Per-skill installs copy only the skill directory itself. For OpenCode, also copy this repository's `.opencode/references/` directory into the target project's `.opencode/references/` when a selected skill uses shared `../../references/...` paths; alternatively install the whole pack. See [#361](https://github.com/addyosmani/agent-skills/issues/361) for background.

### Option 2: Clone this repository

1. Clone the repository:

```bash
git clone https://github.com/addyosmani/agent-skills.git
```

If you're opening this repository itself in OpenCode (for example, to contribute to it), the files below are already present and committed — no copying needed:

- `AGENTS.md` (root)
- `skills/` directory
- `.opencode/skills` — a symlink to `../skills/`, already committed in this repo. OpenCode's `skill` tool only auto-discovers `SKILL.md` files under `.opencode/skills/`, `.claude/skills/`, or `.agents/skills/` (or their global equivalents) — a bare root `skills/` directory is not itself a discovery path
- `.opencode/commands/` directory (optional slash commands — see [Slash Commands](#slash-commands) below)
- `.opencode/agents/` directory — a verified mirror of root `agents/`, auto-discovered as subagents
- `.opencode/references/` directory — a verified mirror of root `references/`
- `.opencode/opencode.json` — grants the `plan` agent a narrow write exception; see [Slash Commands](#slash-commands) below

If instead you're installing these skills into a **different** project, copy the desired skills into one of the OpenCode skill discovery paths:

#### Project-local installation

```bash
mkdir -p .opencode/skills
cp -r /path/to/agent-skills/skills/<skill-name> .opencode/skills/
```

For example, to install `spec-driven-development` and `incremental-implementation`:

```bash
mkdir -p .opencode/skills
cp -r /path/to/agent-skills/skills/spec-driven-development .opencode/skills/
cp -r /path/to/agent-skills/skills/incremental-implementation .opencode/skills/
```

#### Install the full OpenCode pack

For the full set of skills, personas, commands, and references, run the checked-in installer from a clone of this repository:

```bash
node /path/to/agent-skills/scripts/install-opencode-assets.js /path/to/your-project
```

The target must be an existing Git worktree. The installer merges only its managed files, records their hashes in `.opencode/agent-skills-manifest.json`, and aborts before writing if a target file was customized. Re-run it to safely update unchanged installed files; use `--dry-run` to inspect changes or `--force` only when you explicitly want to replace a conflicting regular file. It never edits `AGENTS.md` or `.opencode/opencode.json`.

The pack includes verified mirrors of root `agents/` and `references/` in `.opencode/agents/` and `.opencode/references/`. From an installed agent, `../references/...` resolves to the shared checklists; skill links using `../../references/...` remain valid too.

#### Global installation

```bash
mkdir -p ~/.config/opencode/skills
cp -r /path/to/agent-skills/skills/<skill-name> ~/.config/opencode/skills/
```

#### Cross-compatible paths

OpenCode also discovers skills placed in Claude-compatible or generic agent paths:

- `.claude/skills/<name>/SKILL.md`
- `~/.claude/skills/<name>/SKILL.md`
- `.agents/skills/<name>/SKILL.md`
- `~/.agents/skills/<name>/SKILL.md`

If you already share skills across Claude Code and OpenCode, any of these locations work.

### What to copy

Copy the directories under `skills/` (for example `skills/spec-driven-development/`). Each directory must contain a `SKILL.md` file. Do not copy the repository's root `AGENTS.md` or `CLAUDE.md`; those files configure development of this repository itself.

## Project `AGENTS.md`

Create an `AGENTS.md` in **your own project** root. This is the system prompt that tells OpenCode when and how to invoke the installed skills. Unlike the repo-scoped `AGENTS.md` in `addyosmani/agent-skills`, this file belongs to your project and should be adapted to your stack.

Below is a template you can paste into your project's `AGENTS.md`:

```markdown
# Agent Skills (OpenCode)

This project uses skills installed under `.opencode/skills/` (or a compatible path).

## Core Rules

- If a task matches a skill, invoke it with the `skill` tool before acting.
- Skills are located in `.opencode/skills/<skill-name>/SKILL.md`.
- Follow the skill workflow strictly; do not partially apply it.
- Never skip required steps such as spec, plan, or test when a skill demands them.

## Intent → Skill Mapping

Map the user's intent to the matching skill automatically:

- Feature / new functionality → `spec-driven-development`, then `incremental-implementation` and `test-driven-development`
- Planning / breakdown → `planning-and-task-breakdown`
- Bug / failure / unexpected behavior → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`
- Refactoring / simplification → `code-simplification`
- API or interface design → `api-and-interface-design`
- UI work → `frontend-ui-engineering`

## Execution Model

For every request:

1. Determine if any skill applies (even a small chance).
2. Load the skill with `skill({ name: "<skill-name>" })`.
3. Follow the skill workflow exactly.
4. Only proceed to implementation once required steps are complete.
```

Save this as `AGENTS.md` in your project root. OpenCode will load it automatically.

> **Note:** The root `AGENTS.md` inside the `addyosmani/agent-skills` repository is intended for contributors working on this repository and should not be copied into other projects. See [CONTRIBUTING.md](../CONTRIBUTING.md#repo-scoped-files).

## How It Works

### 1. Skill Discovery

OpenCode's `skill` tool only auto-discovers `SKILL.md` files under `.opencode/skills/`, `.claude/skills/`, or `.agents/skills/` (project-local, walking up to the git root) — or their global equivalents under `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`. A bare project-root `skills/` directory is **not** itself a discovery path.

This repo keeps the actual skill content in `skills/<skill-name>/SKILL.md` — shared with every other tool integration (Claude Code plugin, Cursor, Copilot, etc.) — and exposes it to OpenCode via a symlink, already committed in this repo:

```
.opencode/skills -> ../skills/
```

**If you're copying these skills into a separate project** that only needs OpenCode support, the simplest option is to copy the skill folders directly into `.opencode/skills/<skill-name>/SKILL.md` — no root-level `skills/` needed. Only use the symlink approach (a root `skills/` plus `.opencode/skills` pointing to it) if you also want other tools like Claude Code or Cursor to share the same skill files.

#### Example: AGENTS.md excerpt for a separate project

OpenCode doesn't auto-discover skill-routing rules — they have to be spelled out in the system prompt. Append this to whatever your project's `AGENTS.md` already contains (don't replace it):

```markdown
## Skill-Driven Execution

This project uses a **skill-driven execution model** powered by the `skill` tool and the `.opencode/skills/` directory.

### Core Rules

- If a task matches a skill, you MUST invoke it
- Skills are located in `.opencode/skills/<skill-name>/SKILL.md`
- Never implement directly if a skill applies
- Always follow the skill instructions exactly (do not partially apply them)

### Intent → Skill Mapping

Map user intent to the skills you've actually copied, for example:

- Feature / new functionality → `spec-driven-development`, then `incremental-implementation`, `test-driven-development`
- Bug / failure / unexpected behavior → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`

### Execution Model

For every request:

1. Determine if any skill applies (even 1% chance)
2. Invoke the appropriate skill using the `skill` tool
3. Follow the skill workflow strictly
4. Only proceed to implementation after required steps (spec, plan, etc.) are complete

### Anti-Rationalization

The following thoughts are incorrect and must be ignored:

- "This is too small for a skill"
- "I can just quickly implement this"
- "I'll gather context first"

Correct behavior: always check for and use skills first.
```

Trim the Intent → Skill Mapping list down to only the skills you actually copied — listing one that isn't present just gives the model a dead end to invoke.

If you install personas into `.opencode/agents/` (the full pack does this) and commands into `.opencode/commands/`, append this section too:

```markdown
## Orchestration: Personas, Skills, and Commands

Three layers, different jobs:

- **Skills** (`.opencode/skills/<name>/SKILL.md`) — workflows with steps and exit criteria. The *how*.
- **Personas** (`.opencode/agents/<role>.md`) — roles with a perspective and an output format. The *who*.
- **Slash commands** (`.opencode/commands/*.md`) — user-facing entry points. The *when*.

Composition rule: the user (or a slash command) is the orchestrator. **Personas do not invoke other personas.** A persona may invoke skills.

The only multi-persona pattern is **parallel fan-out with a merge step** — used by `/ship` to run `code-reviewer`, `security-auditor`, and `test-engineer` concurrently and synthesize their reports. Don't build a "router" persona that decides which other persona to call.
```

Each skill must contain a `SKILL.md` file with a valid `name` and `description` in its frontmatter.

### 2. Automatic Skill Invocation

When your project's `AGENTS.md` instructs the agent to use skills, the agent evaluates every request and maps it to the appropriate skill.

Examples:

- "build a feature" → `incremental-implementation` + `test-driven-development`
- "design a system" → `spec-driven-development`
- "fix a bug" → `debugging-and-error-recovery`
- "review this code" → `code-review-and-quality`

### 3. Lifecycle Mapping (Implicit Commands)

OpenCode does not require slash commands, but if you prefer them see the next section. In agent-driven mode the lifecycle is mapped implicitly:

- DEFINE → `spec-driven-development`
- PLAN → `planning-and-task-breakdown`
- BUILD → `incremental-implementation` + `test-driven-development`
- VERIFY → `debugging-and-error-recovery`
- REVIEW → `code-review-and-quality`
- SHIP → `shipping-and-launch`

Each lifecycle phase also has a matching slash command (see below) for when you'd rather trigger it explicitly instead of relying on intent detection.

---

## Slash Commands

The repo ships 8 slash commands under `.opencode/commands/`: 7 lifecycle commands plus the `/webperf` specialist audit. OpenCode auto-discovers them when you run from the project root.

| Command | What it does |
| --------- | --------------- |
| `/spec` | Write a structured spec before writing code |
| `/plan` | Break work into small, verifiable tasks (runs in OpenCode's read-only `plan` agent mode) |
| `/build` | Implement the next task incrementally |
| `/build auto` | Generate the plan if needed, get one approval, then implement every task without stopping |
| `/test` | Run TDD workflow — red, green, refactor |
| `/review` | Five-axis code review (runs in OpenCode's read-only `plan` agent mode) |
| `/code-simplify` | Reduce complexity without changing behavior |
| `/ship` | Pre-launch checklist via parallel persona fan-out |
| `/webperf` | Audit browser-facing apps for Core Web Vitals and performance issues |

Each command invokes the corresponding skill automatically — no manual skill loading required.

> **Note:** `/ship` and `/webperf` fan out to specialist personas (`code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`). This repository ships those personas in the verified `.opencode/agents/` mirror, which OpenCode discovers before global `~/.config/opencode/agents/`. In another project, install the full pack or copy the desired mirror files into `.opencode/agents/`; a global definition also works. If the same persona name exists in both locations, the project-local copy wins. Both commands fall back to running the personas sequentially in the main context only when a persona is missing from both locations. Each persona file carries `mode: subagent` in its frontmatter, so OpenCode only offers them for dispatch (via commands or the Task tool) and doesn't also list them as selectable primary agents.

### Where planning artifacts live

Unlike the other tool integrations (which write `SPEC.md` and `tasks/plan.md`/`tasks/todo.md` at the project root), the OpenCode commands write everything under `.opencode/`:

- `/spec` → `.opencode/spec/SPEC.md`
- `/plan` → `.opencode/tasks/plan.md` and `.opencode/tasks/todo.md`
- `/build` reads from those same paths

This keeps generated artifacts out of the way of anything your own project already has at its root, and gives `/plan`'s permission exception (below) a clean directory to scope to.

`/plan` and `/review` run under OpenCode's built-in `plan` agent, which denies `edit` (and therefore `write`) by default — the same read-only guarantee as Claude Code's plan mode. `/review` never needs to write anything, so that's a non-issue for it. `/plan`, however, is contractually required by the `planning-and-task-breakdown` skill to persist its output, so `.opencode/opencode.json` grants the `plan` agent a narrow exception:

```jsonc
{
  "agent": {
    "plan": {
      "permission": {
        "edit": {
          "*": "deny",
          ".opencode/spec/SPEC.md": "allow",
          ".opencode/tasks/plan.md": "allow",
          ".opencode/tasks/todo.md": "allow"
        }
      }
    }
  }
}
```

Everything else stays denied in `plan` mode — this mirrors Claude Code's plan-mode behavior of allowing writes only to its own designated plan file.

If you're installing skills into a **different** project rather than this repo, copy the command files from `.opencode/commands/*.md` here and adjust them to invoke the skills you installed:

```bash
mkdir -p .opencode/commands
cp /path/to/agent-skills/.opencode/commands/*.md .opencode/commands/
```

## Usage Examples

### Example 1: Feature Development

User:

```
Add authentication to this app
```

Agent behavior:

- Detects feature work
- Invokes `spec-driven-development`
- Produces a spec before writing code
- Moves to planning and implementation skills

### Example 2: Bug Fix

User:

```
This endpoint is returning 500 errors
```

Agent behavior:

- Invokes `debugging-and-error-recovery`
- Reproduces → localizes → fixes → adds guards

### Example 3: Code Review

User:

```
Review this PR
```

Agent behavior:

- Invokes `code-review-and-quality`
- Applies structured review (correctness, design, readability, etc.)

## Agent Expectations

For OpenCode to work correctly, the agent should:

- Always check if a skill applies before acting
- Use the `skill` tool to load the skill when it applies
- Never skip required workflows (spec, plan, test, etc.)
- Not jump directly to implementation

These rules are enforced by your project's `AGENTS.md`, not by the copy of the skill itself.

## Limitations

- No plugin system (handled via prompt + structure)
- Skill invocation depends on model compliance
- Slash commands are optional and additive — the agent-driven flow above works with or without them, and `/ship`/`/webperf` need personas copied into `.opencode/agents/` to fan out automatically (see [Slash Commands](#slash-commands))
- OpenCode does not install skills automatically; copy or install the directories you need
- If a skill references files under `references/`, you may need to copy those as well when installing manually

Despite these, the workflow closely matches Claude Code in practice.

---

## Recommended Workflow

Just use natural language:

- "Design a feature"
- "Plan this change"
- "Implement this"
- "Fix this bug"
- "Review this"

The agent will automatically select and execute the correct skills.

---

## Summary

1. Install the skills you need, either with `npx skills add addyosmani/agent-skills` or by copying them from a clone of this repository into `.opencode/skills/` (project), `~/.config/opencode/skills/` (global), or a cross-compatible path such as `.claude/skills/` / `.agents/skills/`.
2. Create your own project-local `AGENTS.md` with the rules and intent mapping above.
3. OpenCode discovers the skills and your `AGENTS.md` guides the agent to invoke them.
4. Optionally add `.opencode/commands/*.md` for explicit slash commands.

- Structured skills (this repo)
- Strong agent rules (`AGENTS.md`)
- Automatic skill invocation via reasoning
- Optional slash commands (`.opencode/commands/`) for explicit, manual invocation

This results in a **fully agent-driven, production-grade engineering workflow** without requiring a plugin system — with manual commands available whenever you want them. When installing into a different project, this keeps the reusable assets (skills) separate from the repository-specific configuration (the `addyosmani/agent-skills` root `AGENTS.md`).
