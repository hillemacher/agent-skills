# OpenCode Setup

This guide explains how to use Agent Skills with OpenCode in a way that closely mirrors the Claude Code experience (automatic skill selection, lifecycle-driven workflows, and strict process enforcement).

## Overview

OpenCode does not have a native plugin system, but it supports both automatic skill routing and custom `/commands`. This integration ships both:

- A strong system prompt (`AGENTS.md`)
- The built-in `skill` tool
- Consistent skill discovery from the `skills/` directory
- Optional slash commands in `.opencode/commands/` for users who prefer explicit, manual invocation over relying on intent detection

This creates an **agent-driven workflow** by default, where skills are selected and executed automatically, while still giving you `/spec`, `/plan`, and the rest of the lifecycle commands when you want to trigger a workflow explicitly.

- Skills are selected automatically based on intent, or explicitly via slash command
- Workflows are enforced via `AGENTS.md`
- No manual command invocation is required — but it's available

This more closely matches how Claude Code behaves in practice, where skills are triggered automatically but slash commands remain available as an explicit entry point.

---

## Installation

1. Clone the repository:

```bash
git clone https://github.com/addyosmani/agent-skills.git
```

2. Open the project in OpenCode.

3. Ensure the following files are present in your workspace:

- `AGENTS.md` (root)
- `skills/` directory
- `.opencode/commands/` directory (optional slash commands — see [Slash Commands](#slash-commands) below)
- `opencode.json` (root) — grants the `plan` agent a narrow write exception; see [Slash Commands](#slash-commands) below

No additional installation is required.

---

## How It Works

### 1. Skill Discovery

All skills live in:

```
skills/<skill-name>/SKILL.md
```

OpenCode agents are instructed (via `AGENTS.md`) to:

- Detect when a skill applies
- Invoke the `skill` tool
- Follow the skill exactly

### 2. Automatic Skill Invocation

The agent evaluates every request and maps it to the appropriate skill.

Examples:

- "build a feature" → `incremental-implementation` + `test-driven-development`
- "design a system" → `spec-driven-development`
- "fix a bug" → `debugging-and-error-recovery`
- "review this code" → `code-review-and-quality`

The user does **not** need to explicitly request skills.

### 3. Lifecycle Mapping (Implicit Commands)

The development lifecycle is encoded implicitly:

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
|---------|---------------|
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

> **Note:** `/ship` and `/webperf` fan out to specialist personas (`code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`). OpenCode auto-discovers subagents from project-local `.opencode/agents/` first, then the global `~/.config/opencode/agents/` — not this repo's root `agents/` folder. Either location is enough to enable automatic parallel dispatch; you only need to copy the persona files you want to use into `.opencode/agents/` or `~/.config/opencode/agents/` if you don't already have equivalents in either. If the same persona name exists in both, the project-local copy wins. Both commands fall back to running the personas sequentially in the main context only when a persona is missing from both locations.

### Where planning artifacts live

Unlike the other tool integrations (which write `SPEC.md` and `tasks/plan.md`/`tasks/todo.md` at the project root), the OpenCode commands write everything under `.opencode/`:

- `/spec` → `.opencode/spec/SPEC.md`
- `/plan` → `.opencode/tasks/plan.md` and `.opencode/tasks/todo.md`
- `/build` reads from those same paths

This keeps generated artifacts out of the way of anything your own project already has at its root, and gives `/plan`'s permission exception (below) a clean directory to scope to.

`/plan` and `/review` run under OpenCode's built-in `plan` agent, which denies `edit` (and therefore `write`) by default — the same read-only guarantee as Claude Code's plan mode. `/review` never needs to write anything, so that's a non-issue for it. `/plan`, however, is contractually required by the `planning-and-task-breakdown` skill to persist its output, so the root-level `opencode.json` grants the `plan` agent a narrow exception:

```jsonc
{
  "agent": {
    "plan": {
      "permission": {
        "edit": {
          "*": "deny",
          ".opencode/tasks/plan.md": "allow",
          ".opencode/tasks/todo.md": "allow"
        }
      }
    }
  }
}
```

Everything else stays denied in `plan` mode — this mirrors Claude Code's plan-mode behavior of allowing writes only to its own designated plan file.

---

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

---

### Example 2: Bug Fix

User:
```
This endpoint is returning 500 errors
```

Agent behavior:
- Invokes `debugging-and-error-recovery`
- Reproduces → localizes → fixes → adds guards

---

### Example 3: Code Review

User:
```
Review this PR
```

Agent behavior:
- Invokes `code-review-and-quality`
- Applies structured review (correctness, design, readability, etc.)

---

## Agent Expectations (Critical)

For OpenCode to work correctly, the agent must follow these rules:

- Always check if a skill applies before acting
- If a skill applies, it MUST be used
- Never skip required workflows (spec, plan, test, etc.)
- Do not jump directly to implementation

These rules are enforced via `AGENTS.md`.

---

## Limitations

- No plugin system (handled via prompt + structure)
- Skill invocation depends on model compliance
- Slash commands are optional and additive — the agent-driven flow above works with or without them, and `/ship`/`/webperf` need personas copied into `.opencode/agents/` to fan out automatically (see [Slash Commands](#slash-commands))

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

OpenCode integration works by combining:

- Structured skills (this repo)
- Strong agent rules (`AGENTS.md`)
- Automatic skill invocation via reasoning
- Optional slash commands (`.opencode/commands/`) for explicit, manual invocation

This results in a **fully agent-driven, production-grade engineering workflow** without requiring a plugin system — with manual commands available whenever you want them.
