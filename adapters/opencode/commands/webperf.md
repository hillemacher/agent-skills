---
description: Run a web performance audit via the web-performance-auditor persona
---

`/webperf` targets web applications specifically. Do not use it for utility libraries, CLIs, or server-only code with no browser-facing output.

## Determine the mode

**Deep mode** — activate when any of these is available:
- A Lighthouse JSON report file (e.g. `npx lighthouse <url> --output json --output-path ./report.json`, or `npx -p chrome-devtools-mcp chrome-devtools lighthouse_audit --output-format=json` from the Chrome DevTools MCP CLI)
- A PageSpeed Insights JSON response (includes Lighthouse + CrUX)
- A CrUX API response (requires `CRUX_API_KEY` or `GOOGLE_API_KEY`)
- A DevTools performance trace
- A live URL plus the `chrome-devtools` MCP server configured in the harness (the agent can capture metrics directly via `lighthouse_audit` and `performance_*` tools)
- The Chrome DevTools MCP CLI invoked locally (via `npx -p chrome-devtools-mcp chrome-devtools <tool>` or after `npm i -g chrome-devtools-mcp`) — the user runs commands like `chrome-devtools lighthouse_audit --output-format=json` and passes the JSON output to the agent

**Quick mode** — default when none of the above are available. The agent scans source code for structural anti-patterns and labels every finding as `potential impact`.

## Run the audit

OpenCode discovers subagents from `.opencode/agents/` (or the global `~/.config/opencode/agents/`). The main agent dispatches the installed persona through the Task tool with `subagent_type: "web-performance-auditor"`. Users may also invoke it directly with `@web-performance-auditor`. If Task dispatch is unavailable or denied, disclose the limitation and adopt available persona instructions in the main context; report an incomplete audit if those instructions are missing.

Run the audit — via the Task tool when the persona and dispatch permissions are available, otherwise using the stated main-context fallback — passing it explicitly:

- The files, components, or diff under review
- Any artifact paths (Lighthouse JSON, PSI JSON, CrUX response, trace) or pasted JSON content
- The target URL or page name when known
- A note on which mode you expect (Quick or Deep), so missing inputs surface if Deep was intended

The result should be a scorecard (only populated with sourced values), a ranked list of findings, positive observations, and proactive recommendations.

## Output

Return the full audit report to the user. No synthesis or merge step is needed — this is a single-persona command.
