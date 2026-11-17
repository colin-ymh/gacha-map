# Codex Setup Audit

Audited 2026-11-15 against `CLAUDE.md`, `.claude/settings.json`, `.claude/commands/`, `.claude/hooks/`, and both agent directories. Local Codex CLI: 0.160.1.

| Claude setup | Codex treatment |
| --- | --- |
| Project instructions | Missing color, design synchronization, migration, platform scope, review workflow, and release rules added to `AGENTS.md` |
| Seven agent definitions | Existing `.codex/agents/` retained; omitted constraints supplied by `docs/codex/agent-additions.md` |
| Five custom commands | Task-triggered procedures in `docs/codex/workflows.md`; not registered slash commands |
| Sensitive-read and noisy-output hooks | Instruction-level checks in the workflow; no claim of automatic enforcement |
| Quality gate, formatting, API route hooks | Workspace-aware checks in the workflow; no executable hook registration performed |
| Test-gap hook | File exists but is not enabled in `.claude/settings.json`; carried over as review guidance |
| Sonnet/Haiku model, thinking/compaction variables | Claude-specific values not copied; use the active Codex session configuration |
| Claude allow/deny lists | Not copied as Codex permissions; preserve current host sandbox and approval controls |
| MCP | Connection audit below; not migrated by copying credentials |

## MCP status

The project documentation refers to `.mcp.json`, but the file is absent from this checkout. The user-level Codex config contains entries named `node_repl`, `supabase`, `supabase_dev`, and `computer-use`. Presence in a config does not establish authentication, server health, or availability in this Work session. No endpoints, tokens, or secret values were printed or copied.

Notion, Penpot, Slack, and Android Debug Bridge project tools are not exposed in this session. Supabase entries also do not establish usable Supabase tools in this session. UI work requiring Notion/Penpot remains blocked until those tools are actually available. Main-session coordination remains mandatory.

No user-level config or MCP credentials were changed. Connection setup needs the intended missing server configuration and the host's supported connection mechanism; do not invent endpoints or copy secrets into repository files.

## Files and execution limits

The host marks `.codex/` read-only for this task, so additions live in `docs/codex/` and are linked from the automatically read root `AGENTS.md`. Existing `.codex/README.md` and `.codex/mcp.md` describe the older partial setup; this audit records current differences.

Claude hook JSON and commands were not installed as native Codex hooks. The new checks are agent instructions, not a security boundary or an enforced event pipeline. A future native-hook setup must first verify the installed runtime's hook schema and trust mechanism. Do not bypass host hook trust or weaken approval settings.

`docs/workflow.md` still refers to per-agent Slack messages in `#general`; use `AGENTS.md` channel routing (`#dev-log` intermediate, `#general` final), and send only when explicitly authorized in the current task. No Slack message is sent as part of this setup migration.
