# Claude Code Compatibility

This fork defaults to OpenCode adaptations under `.opencode/`. Claude Code continues to use the root `skills/`, `agents/`, `references/`, `.claude/commands/`, and `.claude-plugin/` assets. Do not copy OpenCode configuration into Claude settings.

For fork maintenance, the tracked `.claude/skills/upstream-sync` symlink points to `.agents/skills/upstream-sync/`. Claude Code discovers the symlink as a project skill; OpenCode reads the same instructions through `.agents/skills/`. Both are available in fresh clones and are not included in the consumer pack. Other local skills in these directories remain ignored by Git.

The root [orchestration reference](../references/orchestration-patterns.md#claude-code-compatibility) retains Claude plugin discovery, Agent tool, and Agent Teams examples for that adapter. Those mechanisms are not prerequisites for OpenCode dispatch.

For Chrome DevTools MCP in Claude Code, merge the following into `.mcp.json` or the appropriate Claude settings:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--isolated"]
    }
  }
}
```

OpenCode uses `mcp` with `type: local` and a command array instead; see its adapted browser-testing skill.

`node scripts/run-evals.js --behavioral <skill>` runs the root skills through headless Claude. The Claude plugin validation/installation and hook jobs likewise validate that compatibility adapter. Deterministic routing evals are structural approximations, not evidence that OpenCode invoked a skill at runtime. No OpenCode behavioral-evaluation backend is included.
