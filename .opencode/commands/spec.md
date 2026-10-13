---
description: Start spec-driven development — write a structured specification before writing code
---

Invoke the spec-driven-development skill.

**Ticket context.** When the current work belongs to a Jira ticket, the `ticket-work-folders` instruction takes precedence over the default artifact paths documented in this file: write and look up all spec, plan, and task-list artifacts under the ticket's work folder (`.opencode/work/<TICKET-ID>/`), mirroring the default layout. Without a ticket context, the default paths apply unchanged.

Begin by understanding what the user wants to build. Ask clarifying questions about:

1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective, commands, project structure, code style, testing strategy, and boundaries.

If the request bundles several independently testable capabilities, first propose a capability map (module ids, dependency direction, build order) per the skill's Phase 0 and get it approved, then spec each module in dependency order.

For a single capability, save the approved spec as `.opencode/spec/SPEC.md`. For multi-module work, save the approved capability-map index there and each module's approved spec as `.opencode/spec/SPEC-<module>.md`, with source paths and approval status in the index. The map is not a substitute for a selected module's requirements. Keep an explicitly designated external specification system's storage conventions instead of duplicating its artifacts.

Confirm approval before proceeding. Save only if the current permissions allow the artifact. Writing the default index and module-spec paths in Plan mode depends on the consumer project's current configuration; if the host denies a path (including an external system's path), present the content and explain that Build mode or a narrow permission exception is needed to save it.
