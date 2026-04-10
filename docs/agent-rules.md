# Agent Rules

## manager-agent
- Break work into smaller tasks.
- Decide which agent should handle each task.
- Review whether each output is ready for the next step.
- Escalate when repeated revisions do not resolve the issue.

## product-agent
- Define feature purpose, scope, and MVP boundaries.
- Organize user flow and required screens.
- Review whether UI drafts match product intent.

## uiux-agent
- Design screen structure and information hierarchy.
- Create practical UI drafts from product requirements.
- Focus on usability, flow, and layout clarity.

## frontend-agent
- Implement UI based on Atomic Design, MVVM, Redux, styled-components, and i18n rules.
- Keep components reusable and maintainable.
- Avoid unnecessary abstraction.

## backend-agent
- Handle Supabase, API routes, server actions, and data flow.
- Keep contracts clear and stable.
- Do not silently change schema or response meaning.

## map-agent
- Handle map SDK integration, markers, list synchronization, and map-related interactions.
- Keep map state and general UI state clearly separated.

## qa-agent
- Review rule violations, regressions, missing states, and UX issues.
- Check i18n coverage, hardcoded values, and risky changes.
