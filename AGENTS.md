# Gacha Map Codex Instructions

## Language
- Respond in Korean by default.
- Use another language only when explicitly requested.

## Project
- This project is a service for discovering gacha shops and related shop information.
- Prioritize real user flows such as map, shop detail, search, and report.

## Core Rules
- Use TypeScript.
- Use Next.js unless the existing codebase clearly requires otherwise.
- Use Atomic Design and MVVM.
- Use Redux for global state.
- Use styled-components for styling.
- Follow the existing Supabase/Postgres structure for data-related work.

## Project-Specific Conventions
- The Next.js middleware file is `src/proxy.ts`, and the exported function name must be `proxy`.
- Do not rename it to `middleware.ts` or export `middleware`, even if a generic Next.js warning suggests that convention.

## Safety
- Do not silently modify `.env`, secrets, deployment settings, production settings, or database schema.
- Explain and ask for confirmation before changing `.env`, secrets, deployment settings, production database-related settings, migrations, or schema.
- Warn before destructive changes such as file deletion, large replacements, or data deletion.
- Do not commit automatically. Report first.

## Docs Rule
- Read relevant docs in `docs/` before making structural decisions.
- Align implementation with documented rules when docs exist.
- Use `docs/agent-rules.md` for a short overview of project agent responsibilities.

## Spec Rule
- Product specs must be checked in Notion. `docs/screens.md` is only a supporting reference, not the source of truth.
- UI work requires the Notion spec first.
- Frontend implementation requires the Penpot UI first.
- Workflow order: Notion spec check -> Penpot UI design check -> frontend implementation.
- If the spec is not available in Notion, pause the UI task and report it to the user.

## MCP Rule
- MCP-dependent work must be handled in the main Codex session.
- Do not assume subagents can use MCP tools.
- The project MCP server source of truth is `.mcp.json`.
- Do not duplicate MCP tokens or secrets into additional files.
- Notion, Penpot, Supabase, Slack, and Android Debug Bridge MCP work must be coordinated by the main session.
- If a subagent produces a `Slack summary:` line, the main session is responsible for posting it to Slack.

## Codex Subagent Rule
- Claude Code agent definitions were ported to `.codex/agents/`.
- Codex subagents do not automatically inherit those files. When delegating, the main session should read the relevant `.codex/agents/<agent>.md` file and include its role, scope, constraints, and completion report format in the subagent prompt.
- Delegate only bounded work with clear ownership. Keep MCP-dependent, secret-dependent, schema-risky, or coordination-heavy work in the main session.
- Recommended mapping:
  - `product-agent`: feature purpose, MVP scope, user flow, screen-level planning.
  - `uiux-agent`: screen structure, information hierarchy, usability, Penpot-oriented UX review.
  - `frontend-agent`: UI implementation, Atomic Design, MVVM, Redux, styled-components, i18n.
  - `backend-agent`: Supabase, API routes, server actions, response contracts, safe data flow.
  - `map-agent`: map SDK, markers, map/list synchronization, map state flow.
  - `qa-agent`: post-implementation review, regressions, i18n, state, styling, missing states.
  - `manager-agent`: task decomposition and result consolidation; use sparingly because the main Codex session is already the coordinator.

## Orchestration Rule
- The main session acts as the coordinator for multi-step work.
- For large tasks, the main session should:
  - break the work into smaller tasks,
  - decide which agent should handle each task,
  - identify dependencies and parallel work,
  - collect results,
  - review whether each result is ready for the next step.

## Subagent Reporting Rule
- Every delegated implementation agent must finish with:

```text
- Changed files: <file list>
- Reason: <reason>
- Risks: <risks or confirmation needed>
- Suggested commit message: <commit message>
- Slack summary: [<agent name>] <one-line summary>
```

- Every delegated planning or review agent must include a final `Slack summary:` line.
- If the report does not include `Slack summary:`, ask the subagent to report again.
- Intermediate summaries using `[agent-name]` are intended for `#dev-log`.
- Final consolidated summaries are intended for `#general`.

## Mobile/PC Component Reuse Rule
- PC side panels on web must reuse mobile UI components.
- Do not create separate PC-only components for the same screen.
- One component should handle both contexts: full-screen on mobile and 360px panel on web.
- Apply responsive behavior through props or container width, not duplicated components.
- Button labels, styles, placeholder text, and interaction patterns must be identical between mobile and PC unless a difference is explicitly documented.
- PC-only additions must be isolated as appended elements outside the shared component.
- If mobile and PC designs conflict, flag the inconsistency before implementation. Default to mobile as the source of truth.

## Quality Gate
- A result can move forward only if:
  - it satisfies the core request,
  - it does not violate project rules,
  - the next step can start immediately from it,
  - no critical issue or major omission remains.

## Rework Policy
- If critical items are missing, request revision.
- If the same step fails twice, escalate to the user.

## Change Report
After code changes, report only:
- Changed files
- Reason for the changes
- Risks or items that still need confirmation
- Suggested commit message

## RTK
- Prefer `rtk` prefixes for high-output commands when available, especially tests, builds, git diff/status, and package tooling.
- If `rtk` is unavailable, use the normal command and summarize long output.
