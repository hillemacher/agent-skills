---
name: upstream-sync
description: Review or sync this OpenCode-focused fork against addyosmani/agent-skills upstream. Use when the user requests an upstream check or synchronization of this fork. Report upstream changes separately from fork adaptations, propose a merge and porting plan, and wait for explicit approval before merging. Do not use for consumer-project maintenance.
---

# Upstream Sync

## Overview

Root `skills/`, `agents/`, and `references/` remain upstream-facing. `.opencode/skills/`, `.opencode/agents/`, and `.opencode/references/` are checked-in adaptations. `.opencode/commands/` contains host-specific command wrappers. Nothing propagates automatically into these copies.

This is the single tracked maintenance skill, outside the installed consumer pack. Read `docs/opencode-setup.md` for the layout and adaptation-declaration format. Never bulk-copy over adaptations. An approval to review or update this skill is not an approval to merge upstream or push.

## When to Use

- The user asks to check this fork against upstream.
- The user requests an upstream synchronization or update.
- An approved merge needs OpenCode assets ported and verified.

## Process

### 1. Establish the comparison

Read `git status --short`, the current branch, and remotes. Use the local branch the user requested, otherwise the current branch; do not assume `main`. Confirm the upstream remote points to addyosmani/agent-skills before fetching it. Fetch only for an actual upstream check/sync request, not when reviewing these instructions.

Resolve the local and upstream commit IDs and compute their merge base. For example, with `LOCAL` set to the selected local commit and `UPSTREAM` set to the fetched upstream commit:

```bash
git merge-base "$LOCAL" "$UPSTREAM"
git rev-list --left-right --count "$LOCAL...$UPSTREAM"
git log --oneline "$LOCAL..$UPSTREAM"
```

Set `BASE` to that merge-base commit. If there is no common ancestor, stop and explain the history mismatch instead of merging unrelated histories.

### 2. Separate upstream and fork changes

```bash
git diff --name-status --find-renames "$BASE" "$UPSTREAM" -- skills/ agents/ references/ .claude/commands/ .gemini/commands/ commands/ scripts/ docs/ README.md AGENTS.md CONTRIBUTING.md .github/
git diff --name-status --find-renames "$BASE" "$LOCAL" -- skills/ agents/ references/ .opencode/ scripts/ docs/ README.md AGENTS.md CONTRIBUTING.md .github/
```

Report upstream additions, modifications, renames, and deletions separately from fork changes. Inspect content where commit subjects are insufficient. Paths changed on both sides are overlap candidates, not proven merge conflicts. Include renamed source/destination paths when checking overlap.

For each upstream asset, identify its OpenCode counterpart and any entry in `.opencode/adapter-overrides.json`. Command bodies need host-specific porting, not copying Claude namespaces or configuration. Include installer, validator, workflow, and documentation changes that affect the fork.

### 3. Present the merge and porting plan

Report:

- Selected branch and commit IDs, merge base, ahead/behind counts, and upstream commits.
- Upstream asset changes with concise OpenCode impact and proposed actions.
- Fork adaptations to preserve and overlap candidates requiring inspection.
- Required inventory, declaration, documentation, and verification updates.

Recommend a merge, not a rebase or history rewrite. Stop for explicit merge approval unless the user has already explicitly authorized this specific upstream merge. Do not alter adapted assets during a review-only request. Do not infer push authorization from merge approval.

### 4. Merge only from a clean worktree

Before merging, require `git status --porcelain` to be empty, including untracked files. If it is not, report the outstanding work and wait for the user to resolve it or specify how to preserve it. Never automatically stash, discard, or absorb unrelated changes.

Verify the approved commit IDs still match the comparison. Merge the approved upstream commit into the selected local branch. Resolve conflicts while preserving fork-specific tooling and user-approved adaptations.

### 5. Port changes deliberately

- **Added assets:** copy the complete skill/persona/reference, including supporting files and executable permissions; adapt OpenCode instructions and paths before declaring differences.
- **Modified assets:** apply upstream changes to the adapted counterpart, preserving OpenCode behavior. For file-level text merging, use the pre-merge root file as the base, the adapted file as the local side, and the merged root file as the incoming side. Inspect the result; never treat a clean textual merge as proof of semantic correctness.
- **Renames:** rename the corresponding adapted asset and supporting directory, preserve adaptations, update skill frontmatter names where appropriate, links, and declaration keys.
- **Deletions:** remove the adapted counterpart and stale declarations. If the user explicitly chooses to retain it, declare each retained file as fork-only with a reason and verify its remaining dependencies.
- **Commands:** port behavior through OpenCode syntax; keep command inventory and descriptions aligned without copying host-specific bodies verbatim.

Use `git show "$LOCAL:skills/<name>/SKILL.md"` for the pre-merge source, not the newly merged root file, when constructing a three-way adaptation merge. Apply the same principle to personas, references, and supporting files. Binary files require deliberate replacement or retention; do not run text merge tools on them.

### 6. Verify and report

```bash
node scripts/validate-skills.js
node scripts/validate-skills.js .opencode/skills
node scripts/validate-commands.js
node scripts/validate-opencode-mirrors.js
node scripts/validate-reference-links.js
node scripts/validate-artifact-paths.js
node --test scripts/validate-opencode-mirrors-test.js scripts/install-opencode-assets-test.js scripts/validate-reference-links-test.js scripts/validate-artifact-paths-test.js
```

Run any additional checks required by changed tooling or skill descriptions. Review the final diff for lost adaptations, incomplete supporting resources, and accidental consumer inclusion of this maintenance skill. Report merge status, conflicts resolved, ported changes, retained assets, tests, and remaining issues. Stop without pushing; obtain separate authorization before a push.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Skills still propagate automatically" | OpenCode consumes adapted copies; each upstream change needs deliberate porting. |
| "The mirror must be byte-identical" | Declared adaptations are intentional; undeclared differences and stale declarations fail validation. |
| "A branch-tip diff shows upstream changes" | Compare each branch to the merge base to separate fork work from incoming changes. |
| "Approval to merge also means push" | Publishing requires separate authorization. |

## Red Flags

- Bulk-copying over adapted assets.
- Merging with outstanding user changes or an unapproved upstream commit.
- Treating every shared-file difference as a conflict.
- Leaving deleted, renamed, or unsupported references in the pack.
- Using the merged source as the base of an adaptation merge.

## Verification

- [ ] Upstream changes are reported independently of fork changes.
- [ ] The approved merge started with a clean worktree.
- [ ] OpenCode adaptations and complete supporting resources are preserved.
- [ ] Inventory changes and adaptation declarations agree.
- [ ] Root and adapted validation pass; no consumer maintenance skill is installed.
- [ ] No push occurred without separate authorization.
