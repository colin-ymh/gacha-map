# MCP Rules for Codex

## Source of Truth
- The project MCP configuration is `../.mcp.json`.
- Do not duplicate MCP credentials or tokens in `.codex/`.
- Do not commit new secret-bearing MCP config files.

## Configured Servers
- `notion`: HTTP MCP server for product specs and planning references.
- `supabase`: HTTP MCP server for Supabase project/database work.
- `slack`: stdio MCP server for posting summaries and coordination updates.
- `penpot`: stdio MCP server for UI design references.
- `android-debug-bridge-mcp`: stdio MCP server for Android device/debug workflows.

## Operating Rules
- MCP-dependent work must be handled by the main Codex session.
- Subagents must not be asked to fetch Notion specs, inspect Penpot files, post Slack updates, or perform Supabase MCP operations directly.
- If a task requires Notion or Penpot, complete that lookup in the main session before delegating.
- If a subagent returns a `Slack summary:` line, the main session posts it to the appropriate Slack channel when Slack MCP is available.
- If MCP access is unavailable, report the missing MCP step as a risk or confirmation item.

## Channels
- Intermediate agent summaries: `#dev-log`.
- Final consolidated result: `#general`.
