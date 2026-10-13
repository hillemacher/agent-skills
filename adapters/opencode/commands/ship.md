---
description: Run the pre-launch checklist via parallel fan-out to specialist personas, then synthesize a go/no-go decision
---

Invoke the shipping-and-launch skill.

`/ship` is a **fan-out orchestrator**. It runs three specialist personas in parallel against the current change, then merges their reports into a single go/no-go decision with a rollback plan. The personas operate independently — no shared state, no ordering — which is what makes parallel execution safe and useful here.

## Phase A — Parallel fan-out

OpenCode discovers the shipped specialist definitions in `.opencode/agents/`, with global definitions under `~/.config/opencode/agents/` also supported. User `@mentions` invoke specialists interactively; an orchestrator uses the Task tool with the appropriate `subagent_type`.

Dispatch independent Task calls concurrently, passing the same change scope to each:

1. **`code-reviewer`** — Five-axis review of the staged changes or selected commits; return the standard review report.
2. **`security-auditor`** — Vulnerability and threat-model pass; return the standard audit report.
3. **`test-engineer`** — Coverage analysis across happy paths, edge cases, error paths, and concurrency; return the standard coverage report.

If a persona is missing or Task dispatch is unavailable or denied, state the limitation and run equivalent passes sequentially in the main context using the available persona instructions. Do not claim independent reviewer contexts for that fallback. If instructions or a required pass are unavailable, mark the review incomplete and return NO-GO.

Each reviewer returns its report to the main session. Personas must not delegate to other personas: this is pack policy, not an absolute OpenCode platform restriction. See [orchestration patterns](../references/orchestration-patterns.md).

Project-local persona definitions override global definitions of the same name. The installer protects customized local definitions rather than overwriting them silently.

## Phase B — Merge in main context

Once all three reports are back, the main agent (not a sub-persona) synthesizes them:

1. **Code Quality** — Aggregate Critical/Required findings from `code-reviewer` and any failing tests, lint, or build output. Resolve duplicates between reviewers.
2. **Security** — Promote any Critical/High `security-auditor` findings to launch blockers. Cross-reference with `code-reviewer`'s security axis.
3. **Performance** — Pull from `code-reviewer`'s performance axis; cross-check Core Web Vitals if applicable.
4. **Accessibility** — Verify keyboard nav, screen reader support, contrast (not covered by the three personas — handle directly here, or invoke the accessibility checklist).
5. **Infrastructure** — Env vars, migrations, monitoring, feature flags. Verify directly.
6. **Documentation** — README, ADRs, changelog. Verify directly.

## Phase C — Decision and rollback

Produce a single output:

```markdown
## Ship Decision: GO | NO-GO

### Blockers (must fix before ship)
- [Source persona: Critical, High, or Required finding + file:line]

### Recommended fixes (should fix before ship)
- [Source persona: Optional or non-blocking finding + file:line]

### Acknowledged risks (shipping anyway)
- [Risk + mitigation]

### Rollback plan
- Trigger conditions: [what signals would prompt rollback]
- Rollback procedure: [exact steps]
- Recovery time objective: [target]

### Specialist reports (full)
- [code-reviewer report]
- [security-auditor report]
- [test-engineer report]
```

## Rules

1. Run the three Phase A personas concurrently when dispatch is available; use the stated sequential fallback only when necessary and disclose it.
2. Personas do not call each other. The main agent merges in Phase B.
3. The rollback plan is mandatory before any GO decision.
4. Unresolved Critical, High security, or Required findings make the default verdict NO-GO unless the user explicitly accepts the specific risk.
5. **Skip the fan-out only if all of the following are true:** the change touches 2 files or fewer, the diff is under 50 lines, and it does not touch auth, payments, data access, or config/env. Otherwise, default to fan-out. `/ship` is designed for production-bound changes — when the blast radius is non-trivial, run the parallel review even if the diff looks small.
