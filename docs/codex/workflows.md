# Codex Workflows

These are repository instructions, not registered slash commands or executable hooks. The main session reads the relevant section when the user requests the equivalent task. `AGENTS.md` takes precedence over legacy Claude commands and conflicting workflow docs.

## Checks after a meaningful change

- Inspect the diff and existing user changes; restrict edits and formatting to task-owned files.
- Do not read/search `.env`, `.env.*`, or `secrets/`, or print MCP tokens. Avoid broad searches of dependencies, build output, coverage, logs, and lockfiles; use bounded `rg`, file ranges, and RTK when available.
- Use the installed formatter and repository configuration on changed supported files when available; do not download a formatter implicitly or suppress failures. If unavailable, report that limitation.
- Web: `pnpm --filter @gacha-map/web typecheck`, `pnpm --filter @gacha-map/web lint`, and `pnpm --filter @gacha-map/web test:run`. Use targeted Vitest arguments for focused regression checks; use non-watch execution.
- Mobile: `pnpm --filter @gacha-map/mobile typecheck` and `pnpm --filter @gacha-map/mobile lint`. Confirm tools are installed before running; there is currently no mobile test script. Report that gap and perform relevant manual/device checks when available.
- Shared logic: check affected consumers. Changes confined to instructions/docs need diff, link/path, and consistency checks rather than unrelated application builds.
- For changes to API routes under `apps/web/src/app/api/`, inspect and update `docs/api-contracts.md` when behavior/contracts change. Prepare a `#dev-log` summary; send only when the current task explicitly authorizes messaging and the tool is available.
- Review test gaps for changed features, state flows, map/list synchronization, and backend contracts. Add meaningful regression tests where needed, not tests that merely mirror trivial edits. The old `flag-test-gap.js` exists but was not enabled in Claude settings.
- Failed required checks block shipping. Report the command, failure, and pre-existing issues separately.

## plan-feature

Read `AGENTS.md`, `docs/workflow.md`, `docs/architecture.md`, and relevant domain docs. `docs/features.md` is absent; do not treat it as a source. UI requirements come from Notion and designs from Penpot. Stay in planning scope until implementation is requested. Record goal, scope/non-scope, relevant files, steps, risks, success criteria, adversarial review, and final plan in `docs/plans/` as specified in `AGENTS.md`.

## write-tests

Inspect target code and existing tests first. Describe the targeted behavior and intended cases, then update existing suites where possible. Prioritize happy paths, loading/empty/error states, regressions, and selection/data consistency between map and list. Use the existing runner and non-watch checks. Report coverage and remaining gaps in the normal change report.

## prepare-commit

Review branch, status, and task-owned diff. Summarize files, reasons, validation, and risks. Suggest three concise commit messages in the project's style. Do not stage, commit, or push.

## ship-pr

Use only when explicitly asked to commit/push/open a PR. A request to install these instructions does not authorize shipping. Review branch/status/diff; stop on `main`/`master` or when no meaningful task changes exist. Run required checks for all affected packages, including web tests when applicable. Report first, select the commit message, stage only task-owned files, commit, push the feature branch, and create the PR with Summary, What changed, Validation, and Risks / follow-up. Never use `git add -A` over unrelated user work. A request merely to prepare a PR is not permission to commit/push. Do not merge or deploy implicitly.

## fresh-dev

Inspect which workspace and server are affected. Prefer the smallest cache reset (web `apps/web/.next`; mobile Expo cache via `pnpm --filter @gacha-map/mobile exec expo start --clear`). Warn before deleting caches/dependencies and stop affected servers gracefully. Reinstall only if necessary using the existing pnpm lockfile (`pnpm install --frozen-lockfile`); do not clear global npm cache or switch package managers. Start web with `pnpm --filter @gacha-map/web dev` or mobile with `pnpm --filter @gacha-map/mobile start`.
