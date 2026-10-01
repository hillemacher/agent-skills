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

## Copy into an existing artifact folder

Use the interactive copier when the target is the folder containing `agents/`, `commands/`, `references/`, and `skills/` directly, for example an existing OpenCode configuration folder:

```bash
node scripts/copy-opencode-assets.js /path/to/artifact-folder --dry-run
node scripts/copy-opencode-assets.js /path/to/artifact-folder
```

The copier creates missing folders and does not require Git. It copies only this repository's adapted `.opencode/` assets; it does not append `.opencode/` to the target or copy configuration, contributor instructions, planning artifacts, or installer manifests. `--source /path/to/another/agent-skills-checkout` selects another source repository root. `--help` prints usage.

Missing artifacts are added automatically. Identical artifacts are left unchanged. When an existing artifact's source-matching files differ in content or permissions, the copier asks for:

| Answer | Behavior |
|---|---|
| `r` or `replace` | Replace this artifact's matching files and add missing source files |
| `s` or `skip` | Leave this artifact untouched; pressing Enter also skips |
| `ra` or `replace all` | Replace this and all remaining conflicting artifacts of the current type |
| `sa` or `skip all` | Skip this and all remaining conflicting artifacts of the current type |
| `q` | Cancel without writing any files |

Types are processed in order: agents, commands, references, skills. A bulk answer applies only to conflicts within that type; missing artifacts are still added. Agents, commands, and shared references receive individual file decisions. Each skill receives one decision for its complete directory, including supporting scripts and local references.

Replacing a skill merges its source files into the existing directory: matching files are updated, missing files are added, and destination-only files remain. For example, replacing `skills/example/` updates its `SKILL.md`, adds an incoming `scripts/run.sh`, and retains a local `notes.md`. Skipping that skill leaves every file untouched and adds no supporting files to it. No artifact directory is deleted, and obsolete or unrelated artifacts remain in place.

All answers are collected before copying. Invalid answers repeat the prompt; Ctrl+C or exhausted input with unresolved conflicts aborts without writing. Newline-delimited stdin answers are supported. The copier rejects symlinks along asset paths, file/directory mismatches, and overlapping source and destination roots. It rechecks selected destination files after prompting to detect intervening changes. Writes use temporary files and atomic renames; a write failure restores original files and removes new files and directories, reporting any rollback failures.

`--dry-run` lists additions, unchanged artifacts, and conflicts without prompting or writing. The final summary reports created, replaced, skipped, and unchanged artifact counts by type; an existing skill that only gains missing resources counts as one created/additive artifact. On Windows, permission differences alone do not cause a conflict because POSIX file permissions are not fully supported.

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

The fork-maintenance skill at `.agents/skills/upstream-sync/SKILL.md` and its `.claude/skills/upstream-sync` symlink are tracked and available in fresh clones. Claude Code discovers it through the symlink; OpenCode reads it from `.agents/skills/`. It is not included in the consumer pack. Other local skills under these directories remain ignored by Git.

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
