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

## Project-Specific Conventions

- **Next.js middleware 파일은 `src/proxy.ts`이며, export 함수명도 반드시 `proxy`여야 한다.**
  - 표준 Next.js 컨벤션(`middleware.ts` / `middleware` export)과 다르다. 절대 혼동하지 말 것.
  - 에러 메시지나 경고가 표준 컨벤션을 제안하더라도, 이 프로젝트에서는 `proxy.ts` + `proxy` 함수가 정답이다.

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

## Spec Rule (기획서 규칙)

- **기획서는 반드시 노션(Notion)에서 확인한다.** `docs/screens.md`는 보조 참고용이며 정본이 아니다.
- **기획서 없이 UI 작업(Penpot 디자인)을 시작할 수 없다.**
- **UI(Penpot 디자인) 없이 프론트엔드 개발을 시작할 수 없다.**
- 워크플로우 순서: 노션 기획서 확인 → Penpot UI 디자인 → 프론트엔드 개발
- 기획서가 노션에 없으면 작업을 보류하고 사용자에게 보고한다.
- 노션 MCP는 메인 세션에서만 사용 가능하다. 서브에이전트에게 노션 조회를 위임하지 않는다.

## Mobile/PC Component Reuse Rule

- PC side panel (web) must reuse mobile UI components. Do not create separate PC-only components for the same screen.
- A single component handles both contexts: full-screen on mobile, 360px panel on web.
- Apply responsive behavior through props or container width — never by duplicating the component.
- Button labels, styles, placeholder text, and interaction patterns must be identical between mobile and PC unless a difference is explicitly documented in `docs/screens.md`.
- PC-only additions (e.g., "← 목록으로 돌아가기" navigation) must be isolated as separate elements appended outside the shared component, not embedded inside it.
- If a design hands off mobile and PC as visually different, flag the inconsistency before implementing. Default to mobile as the source of truth.

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

## Subagent Reporting Rule

### 서브 에이전트 의무

- 작업이 완료되면 반드시 아래 형식으로 완료 보고를 작성한다.
- 보고의 마지막 줄은 반드시 `Slack summary:` 줄이어야 한다. 이 줄이 없으면 보고가 완료된 것으로 간주하지 않는다.

```
- Changed files: <파일 목록>
- Reason: <변경 이유>
- Risks: <리스크 또는 확인 필요 항목>
- Suggested commit message: <커밋 메시지>
- Slack summary: [<에이전트명>] <한 줄 요약>
```

### 메인 세션(코디네이터) 의무

- 서브 에이전트의 완료 보고를 수신하면, `Slack summary:` 줄을 추출하여 **즉시** 슬랙에 포스팅해야 한다.
- 중간 보고(`[에이전트명]` 형식)는 `#dev-log` 채널에 포스팅한다.
- 최종 취합 결과는 `#general` 채널에 포스팅한다.
- 보고에 `Slack summary:` 줄이 없으면 서브 에이전트에게 재보고를 요청한다.
- 슬랙 포스팅은 서브 에이전트가 MCP를 사용할 수 없으므로, **반드시 메인 세션이 직접 수행**한다.

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

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->
