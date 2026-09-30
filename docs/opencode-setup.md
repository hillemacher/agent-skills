# OpenCode Setup

This fork maintains OpenCode adaptations in `.opencode/`. The root `skills/`, `agents/`, and `references/` remain upstream-facing compatibility assets. OpenCode consumes checked-in copies rather than a skills symlink.

## Install the complete pack

```bash
git clone https://github.com/hillemacher/agent-skills.git
cd agent-skills
node scripts/install-opencode-assets.js /path/to/target-repo --dry-run
node scripts/install-opencode-assets.js /path/to/target-repo
```

The target must be an existing Git worktree. The installer copies adapted skills, commands, personas, and shared references into `.opencode/`, records ownership in `.opencode/agent-skills-manifest.json`, and aborts before writing when an existing file conflicts. Re-run to update unchanged managed files. `--force` replaces conflicting regular files only when explicitly requested; obsolete installed files are retained and reported for review.

The installer never edits `AGENTS.md`, other project instructions, or `.opencode/opencode.json`. No rules file is required: OpenCode lists skill descriptions through its native `skill` tool and loads the selected skill on demand. Installing skills makes them available; it does not guarantee that every matching task will invoke one.

For a single skill, copy the complete adapted folder into `.opencode/skills/<name>/`, including any `scripts/` and local `references/`. Also copy `.opencode/references/` when the skill uses shared checklists. The full-pack installer avoids missing dependencies.

## Repository layout

| Assets | Upstream-facing source | OpenCode adaptation |
|---|---|---|
| Skills | `skills/` | `.opencode/skills/` |
| Personas | `agents/` | `.opencode/agents/` |
| Shared checklists | `references/` | `.opencode/references/` |
| Commands | `.claude/commands/` and other adapters | `.opencode/commands/` |

From an installed skill, `../../references/` resolves to `.opencode/references/`; from an installed persona or command, `../references/` reaches the same directory.

`.opencode/adapter-overrides.json` records reviewed differences with keys relative to the upstream-facing root, such as `skills/context-engineering/SKILL.md`, and a nonempty reason as the value. Unlisted files must match exactly. A deliberately retained fork-only file uses `{ "reason": "...", "forkOnly": true }`; this exception cannot be used for a file that still exists upstream. Declarations for missing or identical files fail validation.

Commands have host-specific bodies; command validation checks inventory, descriptions, and frontmatter rather than byte equality. Skill/persona/reference validation checks inventories and declared adaptations. Upstream changes must be reviewed and ported; never overwrite `.opencode/` with a bulk copy after adaptations exist.

## Skill discovery and optional project rules

OpenCode discovers project skills under `.opencode/skills/`, `.agents/skills/`, and the Claude-compatible `.claude/skills/`, plus their documented global equivalents. A bare root `skills/` directory is not a native discovery path. Prefer `.opencode/skills/` for this fork's adapted consumer assets.

An existing `AGENTS.md` or configuration `instructions` entry can hold project conventions or stricter workflow requirements. This is optional. Do not copy this repository's contributor rules into another project, and do not preload the entire meta-skill as an additional always-on router.

For example, add this only if you want explicit workflow enforcement:

```markdown
Use the native skill tool for matching engineering workflows. Follow the selected
skill's required spec, plan, testing, and review steps. Read existing project
conventions and CONSTRAINTS.md when relevant.
```

Local maintenance skills under `.agents/skills/` and `.claude/skills/` are ignored by Git and are not included in the consumer pack. Contributors who keep an upstream-sync skill locally can link it into `.claude/skills/` for Claude Code discovery; OpenCode reads it from `.agents/skills/`. A fresh clone does not include this local skill.

OpenCode review workflows in this pack use only on-prem models configured in the host. Configure model routing in each installation; this repository does not pin a model ID or endpoint. An optional second-model review requires another on-prem model that OpenCode can select. Ordinary web-service and development-tool examples are independent of this AI model policy.

## Commands and personas

The pack ships nine optional lifecycle commands:

| Command | Purpose |
|---|---|
| `/spec` | Clarify and specify the work |
| `/plan` | Break the approved spec into verifiable tasks |
| `/build` | Implement the next task |
| `/build auto` | Implement the approved plan with per-task verification |
| `/test` | Test and debug |
| `/review` | Review the change |
| `/constraints` | Define or check the quality bar |
| `/code-simplify` | Simplify existing code |
| `/webperf` | Audit a browser-facing application |
| `/ship` | Merge specialist reports into a launch decision |

Personas in `.opencode/agents/` use `mode: subagent`. Users invoke them with `@code-reviewer`, `@security-auditor`, `@test-engineer`, or `@web-performance-auditor`. The main agent dispatches through the Task tool with the corresponding `subagent_type`; independent review calls can run concurrently.

Personas do not delegate to other personas by pack policy. This is not a claim about OpenCode's maximum supported nesting depth. `/ship` discloses sequential fallback when dispatch is unavailable and returns NO-GO when a required pass cannot be completed. See the installed [orchestration reference](../.opencode/references/orchestration-patterns.md).

## Planning artifacts and permissions

The adapted commands and skills agree on these paths:

- `/spec` writes `.opencode/spec/SPEC.md` for one capability. For multi-module work it becomes the approved capability-map index, with each module spec at `.opencode/spec/SPEC-<module>.md`. The index records spec paths and approval status.
- `/plan` records the approved specification source, selected module, and task list target in `.opencode/tasks/plan.md`. Tasks default to `.opencode/tasks/todo.md`; a designated external tracker replaces that checklist, with item IDs/links indexed in the plan.
- Both `/build` modes consume that recorded handoff. An explicit source/module selection takes precedence, but a mismatch with an incomplete plan must be resolved before continuing. An approved external specification identified by path or artifact id/link is accepted without a duplicate default spec. A capability-map index requires an explicitly selected module; it is not implementation requirements itself. Unreadable, unapproved, or missing sources and unavailable task trackers block the handoff rather than triggering guessed requirements or a silent fallback.

Existing incomplete plans must not be overwritten by unrelated work.

The repository's `.opencode/opencode.json` allows the Plan agent to save the index, module specifications, and designated task/plan artifacts through edit tools:

```json
{
  "agent": {
    "plan": {
      "permission": {
        "edit": {
          "*": "deny",
          ".opencode/spec/SPEC.md": "allow",
          ".opencode/spec/SPEC-*.md": "allow",
          ".opencode/tasks/plan.md": "allow",
          ".opencode/tasks/todo.md": "allow"
        }
      }
    }
  }
}
```

The installer does not apply this configuration to other projects. Merge the narrow exception into existing configuration if you want Plan mode to save artifacts. The module-spec glob does not grant arbitrary project edits; external specification paths remain governed by the host's own permissions. If the active permissions deny an artifact, the command presents its output and explains that Build mode or a permission change is needed to save it. Planning never authorizes implementation edits. Other tool permissions remain governed by the host configuration.

## Verification and compatibility

```bash
node scripts/validate-skills.js
node scripts/validate-skills.js .opencode/skills
node scripts/validate-opencode-mirrors.js
node scripts/validate-reference-links.js
node scripts/validate-artifact-paths.js
node scripts/validate-commands.js
```

Other platform adapters remain supported. Root Tier 3 behavioral evals and Claude plugin installation jobs exercise Claude compatibility; they do not prove OpenCode runtime behavior. See [Claude compatibility guidance](claude-code-compatibility.md).

Official references: [skills](https://opencode.ai/docs/skills/), [agents](https://opencode.ai/docs/agents/), [rules](https://opencode.ai/docs/rules/), and [MCP configuration](https://opencode.ai/docs/mcp-servers/).
