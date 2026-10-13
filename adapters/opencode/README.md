# OpenCode pack source

This folder is the source of the OpenCode pack: adapted `skills/`, `commands/`, `agents/`, and `references/`. It is not this repository's own OpenCode configuration. OpenCode does not discover it from here.

Install the pack into a project's `.opencode/` with `node scripts/install-opencode-assets.js <target-repo>`, or merge it into an existing folder with `node scripts/copy-opencode-assets.js <folder>`. Paths such as `.opencode/tasks/plan.md` inside the pack refer to the installed project layout and must stay as they are.

See [OpenCode setup](../../docs/opencode-setup.md) for installation, the adaptation rules, and `adapter-overrides.json`.
