# Supplements to Codex Agent Roles

Read alongside the selected `.codex/agents/<role>.md`. The main session includes applicable constraints in each delegated prompt. `AGENTS.md` and the current task/spec override old MVP priorities. All roles report dependencies, downstream impacts, and unresolved decisions to the main session; MCP stays with that session.

- **frontend-agent**: Keep each component focused, avoid magic values and unmanaged user-facing strings, and preserve existing state/styling libraries. No arbitrary refactor. Use platform-specific color constants from `AGENTS.md`. Check Notion/Penpot inputs and backend/map dependencies before implementation.
- **backend-agent**: Inspect `apps/web/src/lib/supabase/`, `docs/database.md`, and `docs/api-contracts.md`. Keep data access traceable and expose stable normalized contracts to consumers. Report downstream effects; follow migration approval/dev/prod rules. Do not use missing legacy `docs/db-schema.md` as a source.
- **map-agent**: Do not replace the SDK without an explained need. Map and list must use consistent source data and selection logic. Do not overload one state value with location, selected item, and search range. Report API/UI/state dependencies.
- **product-agent**: Before handoff, include the user problem, flow, screens, core features, MVP/non-scope, and unanswered questions. Do not decide implementation details outside the role. The main session supplies Notion requirements.
- **uiux-agent**: Review the whole relevant flow, not isolated appearance. Ground findings in usability and feasible implementation rather than personal taste. Describe frontend/map/product impacts. Main session handles Penpot synchronization.
- **qa-agent**: Review before editing code. Give evidence for findings and pass decisions; do not dismiss structural violations as taste. Check changed flows and regressions, then return Pass / Revise / Fail with severity and actionable fixes.
- **manager-agent**: Keep delegation bounded and handoffs explicit. Review each result before advancing; request revision for critical omissions, and escalate after the same step fails twice. The main session remains the coordinator.

Every role retains its existing completion report and final `Slack summary:` line. Preparing that line does not itself authorize sending a message. Follow the session's explicit messaging authorization and channel rules.
