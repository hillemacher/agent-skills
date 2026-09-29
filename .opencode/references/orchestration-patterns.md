# Orchestration Patterns

Reference catalog of agent orchestration patterns this repo endorses, plus anti-patterns to avoid. Read this before adding a new slash command that coordinates multiple personas, or before introducing a new persona that "wraps" existing ones.

The governing rule: **the user (or a slash command) is the orchestrator. Personas do not invoke other personas.** Skills are mandatory hops inside a persona's workflow.

---

## Endorsed patterns

### 1. Direct invocation (no orchestration)

Single persona, single perspective, single artifact. The default and the cheapest option.

```
user → code-reviewer → report → user
```

**Use when:** the work is one perspective on one artifact and you can describe it in one sentence.

**Examples:**
- "Review this PR" → `code-reviewer`
- "Find security issues in `auth.ts`" → `security-auditor`
- "What tests are missing for the checkout flow?" → `test-engineer`

**Cost:** one round trip. The baseline you should always compare orchestrated patterns against.

---

### 2. Single-persona slash command

A slash command that wraps one persona with the project's skills. Saves the user from re-explaining the workflow every time.

```
/webperf → web-performance-auditor → performance report
```

**Use when:** the same single-persona invocation happens repeatedly with the same setup.

**Example in this repo:** `/webperf`. `/review`, `/test`, and `/code-simplify` run their respective skills in the main session; they do not require persona dispatch.

**Cost:** same as direct invocation. The slash command is just a saved prompt.

**Anti-signal:** if the slash command's body is mostly "decide which persona to call," delete it and let the user call the persona directly.

---

### 3. Parallel fan-out with merge

Multiple personas operate on the same input concurrently, each producing an independent report. A merge step (in the main agent's context) synthesizes them into a single decision.

```
                    ┌─→ code-reviewer    ─┐
/ship → fan out  ───┼─→ security-auditor ─┤→ merge → go/no-go + rollback
                    └─→ test-engineer    ─┘
```

**Use when:**
- The sub-tasks are genuinely independent (no shared mutable state, no ordering dependency)
- Each sub-agent benefits from its own context window
- The merge step is small enough to stay in the main context
- Wall-clock latency matters

**Examples in this repo:** `/ship`.

**Cost:** N parallel sub-agent contexts + one merge turn. Higher than direct invocation, but faster wall-clock and produces better reports because each sub-agent stays focused on its single perspective.

**Validation checklist before adopting this pattern:**
- [ ] Can I run all sub-agents at the same time without ordering issues?
- [ ] Does each persona produce a different *kind* of finding, not just the same finding from a different angle?
- [ ] Will the merge step fit in the main agent's remaining context?
- [ ] Is the user's wait time long enough that parallelism is actually noticeable?

If any answer is "no," fall back to direct invocation or a single-persona command.

---

### 4. Sequential pipeline as user-driven slash commands

The user runs slash commands in a defined order, carrying context (or commit history) between them. There is no orchestrator agent — the user IS the orchestrator.

```
user runs:  /spec  →  /plan  →  /build  →  /test  →  /review  →  /ship
```

**Use when:** the workflow has dependencies (each step needs the previous step's output) and human judgment between steps adds value.

**Examples in this repo:** the entire DEFINE → PLAN → BUILD → VERIFY → REVIEW → SHIP lifecycle.

**Cost:** one sub-agent context per step. Free for the orchestration layer because there is no orchestrator agent.

**Why not automate it:** an LLM "lifecycle orchestrator" would (a) lose nuance between steps because it has to summarize for hand-off, (b) skip the human checkpoints that catch wrong-direction work early, and (c) double the token cost via paraphrasing turns.

---

### 5. Research isolation (context preservation)

When a task requires reading large amounts of material that shouldn't pollute the main context, spawn a research sub-agent that returns only a digest.

```
main agent → research sub-agent (reads 50 files) → digest → main agent continues
```

**Use when:**
- The main session needs to stay focused on a downstream task
- The investigation result is much smaller than the input it consumes
- The decision quality benefits from the main agent having room to think after

**Examples:** "Find every call site of this deprecated API across the monorepo," "Summarize what these 30 ADRs say about caching."

**Cost:** one isolated sub-agent context. Worth it any time the alternative is loading hundreds of files into the main context.

Use OpenCode's built-in `explore` subagent for read-only codebase research. Select models through the host configuration rather than assuming a vendor-specific model.

## OpenCode dispatch

OpenCode discovers specialist definitions in `.opencode/agents/` and `~/.config/opencode/agents/`. Each shipped persona uses `mode: subagent`.

The user can invoke a specialist with `@code-reviewer`. The main agent dispatches programmatically using the Task tool with `subagent_type: "code-reviewer"` and a prompt containing the artifact, scope, and expected report. `@mention` is user-facing invocation syntax, not a substitute for a tool call inside an orchestrator.

For `/ship`, dispatch independent reviewers concurrently when Task dispatch and the active permissions allow it. Pass the same change scope to each reviewer and merge the returned reports in the main session. Do not assume a Claude Agent Teams API, teammate messaging, fixed model, or background-task feature.

If dispatch is unavailable, denied, or a persona is absent, report the limitation. Perform equivalent passes in the main context only when the relevant persona instructions are available; identify this as a sequential fallback. If any required pass cannot be completed, report it as incomplete and return NO-GO.

## Persona composition policy

Personas in this pack do not invoke other personas. This is repository policy, independent of the host's supported nesting depth. A specialist may load relevant skills; recommendations for another specialist belong in its report for the main session to act on.

Avoid router personas, persona-calls-persona chains, and multi-agent work that modifies shared files concurrently. Use a single specialist when one perspective suffices; use fan-out only for independent passes with a concrete merge decision.

Project rules such as `AGENTS.md` are optional. OpenCode discovers skills natively; this pack does not require installing an additional always-on router.
