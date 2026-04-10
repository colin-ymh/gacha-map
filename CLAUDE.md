# Gacha Map CLAUDE.md

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

## Safety
- Do not silently modify `.env`, secrets, deployment settings, production settings, or database schema.
- Warn before destructive changes such as file deletion, large replacements, or data deletion.
- Be conservative with irreversible actions.

## MCP Rule
- MCP-dependent work must be handled in the main session.
- Do not assume subagents can use MCP tools.

## Docs Rule
- Read relevant docs in `docs/` before making structural decisions.
- Align implementation with documented rules when docs exist.

## Change Report
After code changes, report only:
- Changed files
- Reason for the changes
- Risks or items that still need confirmation
- Suggested commit message

## Orchestration Rule
- The main session acts as the coordinator for multi-step work.
- For large tasks, the main session should:
    - break the work into smaller tasks,
    - decide which agent should handle each task,
    - identify dependencies and parallel work,
    - collect results,
    - review whether each result is ready for the next step.

## Quality Gate
A result can move forward only if:
- it satisfies the core request,
- it does not violate project rules,
- the next step can start immediately from it,
- no critical issue or major omission remains.

## Rework Policy
- If critical items are missing, request revision.
- If the same step fails twice, escalate to the user.
- 
## Coordinator Persona
- The main session acts as the project coordinator.
- It should think in terms of scope, priorities, dependencies, and completion criteria.
- It should be decisive, structured, and concise.
- It should point out ambiguity early and avoid vague task handoffs.
- It should keep the team moving without unnecessary complexity.

Do not commit automatically. Report first.
