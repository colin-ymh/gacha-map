# Workflow

## Main Session as Coordinator

The main session acts as the coordinator for multi-step work.

For large tasks, the main session should:
1. read relevant docs and project rules,
2. summarize the request,
3. define goal, scope, and completion criteria,
4. break the work into smaller tasks,
5. assign each task to the most suitable agent,
6. identify dependencies and parallel work,
7. collect outputs from all agents,
8. review whether each output is ready for the next step,
9. request revision when needed,
10. post each agent's Slack summary to #general,
11. return the consolidated result to the user.

## Slack Reporting Rule

- After each agent completes their work, the main session must post their Slack summary to the **#general** channel.
- Each summary is formatted as `[이름] <one-line summary>` as defined in each agent's Completion Report.
- The main session uses the Slack MCP tool to post. Agents do not post directly.
- Post immediately after the agent's output is accepted — do not batch or delay.

## Agent Selection Guide

- `product-agent`: feature definition, scope, priorities, user flow, MVP boundaries
- `uiux-agent`: layout, information hierarchy, usability, UI draft
- `frontend-agent`: frontend implementation, component structure, state flow
- `backend-agent`: Supabase, API routes, DB flow, data contracts
- `map-agent`: map SDK, markers, map/list synchronization
- `qa-agent`: validation, regressions, rule violations, missing states

## Product to UI Flow

1. Product requirements are written first.
2. UI/UX draft is created from the approved requirements.
3. The requirements are reviewed again against the draft.
4. Frontend implementation starts from the reviewed draft.
5. QA reviews the result before completion.

## Penpot Rule

- Penpot-related work must start from a written UI spec.
- The main session handles MCP-dependent Penpot actions.
- Product review should happen before finalizing the draft.
- Agents should return structured inputs for Penpot work instead of assuming direct MCP access.

## Quality Gate

Each output must be reviewed as one of the following:

- Pass
- Revise
- Fail

### Review Criteria

- Does it satisfy the core request?
- Does it follow project rules?
- Can the next step start immediately from it?
- Are there any critical missing items or conflicts?
- If it is a text artifact, are there typos, naming errors, or grammar issues?

## Rework Policy

- `Revise`: improve and review again
- `Fail`: fix critical issues before retry
- If the same step fails twice, escalate to the user instead of looping indefinitely

## MCP Rule

- MCP-dependent work must be handled in the main session.
- Agents should return structured summaries, inputs, or instructions for MCP work.
- Agents should not assume direct access to Notion, Penpot, Slack, or other MCP tools.
