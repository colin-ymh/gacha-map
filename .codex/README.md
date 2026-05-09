# Codex Project Setup

This directory ports the Claude Code project setup into Codex-friendly files.

## Files
- `../AGENTS.md`: primary project instructions that Codex should read automatically.
- `agents/*.md`: Claude subagent roles converted into reusable Codex delegation prompts.
- `mcp.md`: MCP usage rules and server inventory. The actual MCP config remains `../.mcp.json`.

## Important Limits
- Codex does not automatically execute Claude Code `.claude/agents/*.md` files.
- When using Codex subagents, the main session should read the matching file in `agents/` and include it in the delegated prompt.
- MCP-dependent work stays in the main session. Do not assume delegated agents can access MCP tools.
- Do not copy secrets from `.mcp.json` into this directory.

## Practical Delegation Flow
1. Read `../AGENTS.md`.
2. Pick the relevant file from `agents/`.
3. Keep Notion, Penpot, Supabase MCP, and Slack work in the main session.
4. Delegate only bounded implementation, review, or planning work.
5. Require the delegated agent to include the required `Slack summary:` line.
6. Main session reviews the result and posts any Slack summary if MCP access is available.
