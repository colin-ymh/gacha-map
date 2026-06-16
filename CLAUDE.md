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

## Styling / Color Rule

- **색상 값은 절대 하드코딩하지 않는다.** 반드시 상수 파일(`colors.ts` 등)에서 import해서 사용한다.
  - 모바일: `apps/mobile/constants/colors.ts`
  - 웹: `apps/web/src/styles/color.ts`
  - 여러 파일에 동일 색상이 중구난방 하드코딩되는 것을 방지한다.
- 새 색상이 필요하면 상수 파일에 먼저 추가하고, 그 상수를 참조한다.
- 기존 코드에서 하드코딩된 색상을 발견하면 상수 파일로 이동시킨다.

## Project-Specific Conventions

- **Next.js middleware 파일은 `src/proxy.ts`이며, export 함수명도 반드시 `proxy`여야 한다.**
  - 표준 Next.js 컨벤션(`middleware.ts` / `middleware` export)과 다르다. 절대 혼동하지 말 것.
  - 에러 메시지나 경고가 표준 컨벤션을 제안하더라도, 이 프로젝트에서는 `proxy.ts` + `proxy` 함수가 정답이다.

## Safety

- Do not silently modify `.env`, secrets, deployment settings, production settings, or database schema.
- Warn before destructive changes such as file deletion, large replacements, or data deletion.
- Be conservative with irreversible actions.

## Supabase Migration Rule

- 마이그레이션 파일은 반드시 `supabase/migrations/`에 커밋한다.
- 적용 순서: **dev 먼저 적용 → 확인 → prod 적용**.
- `main` 머지 전 prod 적용까지 완료해야 한다.
- 마이그레이션 적용은 Supabase MCP(`apply_migration`)로 수행한다. 메인 세션에서만 가능.

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

## Penpot Sync Rule (디자인 동기화 규칙)

- 코드에서 UI 레이아웃·컴포넌트·스타일을 변경하면, 작업 완료 후 **반드시 Penpot 디자인도 동기화**해야 한다.
- Penpot이 코드의 단일 진실 소스(source of truth)다. 코드와 디자인이 달라지면 Penpot을 코드 기준으로 업데이트한다.
- 단순 문구 수정이나 색상 토큰 변경은 동기화 생략 가능하다. 레이아웃 구조·컴포넌트 배치·신규 화면이 바뀌면 동기화 필수다.
- Penpot MCP는 메인 세션에서만 사용 가능하다. 서브에이전트에게 Penpot 업데이트를 위임하지 않는다.
- 코드 변경 완료 보고 시, Penpot 동기화 여부를 함께 명시한다.

## Mobile/PC Component Reuse Rule

- PC side panel (web) must reuse mobile UI components. Do not create separate PC-only components for the same screen.
- A single component handles both contexts: full-screen on mobile, 360px panel on web.
- Apply responsive behavior through props or container width — never by duplicating the component.
- Button labels, styles, placeholder text, and interaction patterns must be identical between mobile and PC unless a difference is explicitly documented in `docs/screens.md`.
- PC-only additions (e.g., "← 목록으로 돌아가기" navigation) must be isolated as separate elements appended outside the shared component, not embedded inside it.
- If a design hands off mobile and PC as visually different, flag the inconsistency before implementing. Default to mobile as the source of truth.

## iOS App Store 배포 규칙

배포 전 반드시 아래 체크리스트를 순서대로 확인한다.

### 버전 업 체크리스트

1. **`apps/mobile/app.config.js`** — `version` 필드 업데이트
2. **`apps/mobile/ios/app/Info.plist`** — `CFBundleShortVersionString` 동일하게 업데이트
   - 네이티브 `ios/` 디렉토리가 존재하면 EAS는 `app.config.js`의 version을 무시하고 `Info.plist`를 사용한다. 두 파일을 반드시 함께 수정한다.

### EAS 빌드 전 체크리스트

1. **Podfile 확인**: `project 'app.xcodeproj'`, `target 'app'` 이어야 한다. `GachaMapDev` 참조가 있으면 즉시 수정.
2. **로컬 GachaMapDev 디렉토리 삭제**: `ios/GachaMapDev*` 가 존재하면 삭제 후 빌드한다.
   ```bash
   rm -rf apps/mobile/ios/GachaMapDev.xcworkspace apps/mobile/ios/GachaMapDev.xcodeproj apps/mobile/ios/GachaMapDev
   ```
   이 디렉토리들이 EAS 서버에 업로드되면 fastlane이 workspace 선택 프롬프트를 띄우며 45분 대기 후 타임아웃된다.
3. **`eas.json` production env에 `GYM_WORKSPACE: "app.xcworkspace"` 존재 확인**: fastlane workspace 자동 선택용. 없으면 추가.
4. **bundle id 자동 전환 확인**: 네이티브 `ios/` 디렉토리가 존재하면 EAS는 `app.config.js`의 `bundleIdentifier`를 완전히 무시하고 커밋된 `project.pbxproj`/`Info.plist` 값을 그대로 쓴다 (버전 문제와 동일 원인). 로컬 개발용으로 `PRODUCT_BUNDLE_IDENTIFIER`를 `com.gachamap.app.dev`로 둔 채 커밋하면, production 빌드도 그대로 `.dev`로 나간다.
   - 해결: `apps/mobile/scripts/set-ios-bundle-id.js` + `package.json`의 `eas-build-pre-install` 훅으로 자동화됨. `EAS_BUILD_PROFILE === "production"`일 때만 EAS 빌드 서버의 임시 체크아웃에서 `PRODUCT_BUNDLE_IDENTIFIER`/`CFBundleDisplayName`을 `com.gachamap.app`/`GachaMap`으로 패치한다. 로컬 저장소는 항상 `.dev` 상태 유지 — 평소 개발에 영향 없음.
   - **주의**: `eas credentials`는 항상 로컬 체크아웃의 pbxproj 값을 기준으로 동작하므로, 위 훅이 적용되는 시점(빌드 중)에는 개입 불가능하다. `com.gachamap.app` 번들 id용 push key(APNs)를 최초 1회 생성/지정해야 하는 경우, 로컬에서 임시로 pbxproj를 `com.gachamap.app`으로 고쳐 `eas credentials → iOS → production → Push Notifications` 진행 후 `git checkout`으로 되돌리는 수동 작업이 필요하다 (커밋 금지).

### EAS 빌드 명령

```bash
# 빌드 (--no-wait로 즉시 반환, 완료 후 별도 제출)
eas build --platform ios --profile production --non-interactive --no-wait

# 빌드 완료 확인
eas build:view <build-id>

# App Store 제출
eas submit --platform ios --profile production --id <build-id> --non-interactive
```

- `.easignore`는 디렉토리 제외에 신뢰할 수 없다. 로컬에서 직접 삭제하는 것이 확실하다.
- `--auto-submit` 사용 금지: 백그라운드 타임아웃으로 취소된다. 빌드와 제출은 분리해서 실행한다.

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

## Plan-Review-Implement-Verify Workflow

### 적용 대상

- 중간 이상 규모의 기능 작업, 여러 파일에 걸친 변경, 구조 변경, UI/UX 흐름 변경, DB/API 계약 변경 가능성이 있는 작업에는 이 워크플로우를 적용한다.
- `.env`, secrets, deployment settings, production database, Supabase schema/migration 관련 작업은 이 워크플로우를 적용하되, 실제 변경 전 사용자 확인을 먼저 받는다.
- 작은 버그 수정, 문구 수정, 단일 파일의 명확한 변경처럼 계획 비용이 더 큰 작업은 메인 세션이 바로 처리할 수 있다.

### 표준 흐름

1. **Opus가 계획을 작성한다.**
   - 요구사항 해석
   - 범위 / 비범위
   - 관련 파일과 영향도
   - 작업 순서
   - 검증 방법
   - 리스크와 확인 필요 항목
2. **계획은 Markdown 파일로 저장한다.**
   - 저장 위치: `docs/plans/`
   - 파일명 형식: `YYYYMMDD-<short-task-name>.md`
   - 계획 파일을 만들기 전에 `docs/plans/`가 없으면 생성한다.
3. **`codex:adversarial-review`로 계획을 검토한다.**
   - 누락된 요구사항
   - 과한 범위
   - 기존 프로젝트 규칙 위반 가능성
   - 기술적 리스크
   - 테스트/검증 부족
   - Sonnet이 바로 구현할 수 있을 만큼 계획이 명확한지 확인한다.
   - 사용자가 `codex:adverserial-review`라고 쓰더라도 같은 의미로 이해하되, 문서와 명령명은 `adversarial` 철자를 우선 사용한다.
4. **Opus 또는 메인 세션이 최종 계획을 만든다.**
   - Codex 리뷰를 반영한다.
   - 작업 단위와 담당 agent를 확정한다.
   - 완료 조건을 명확히 한다.
   - 최종 계획도 같은 Markdown 파일에 반영하거나, 필요한 경우 `Final Plan` 섹션을 추가한다.
5. **Sonnet에게 구현을 맡긴다.**
   - Sonnet은 최종 계획만 기준으로 작업한다.
   - MCP 의존 작업은 메인 세션이 직접 처리한다.
   - 구현 agent는 기존 Subagent Reporting Rule의 완료 보고 형식을 지킨다.
6. **Codex가 구현 결과를 한 번 더 검증한다.**
   - 최종 계획 대비 누락 여부
   - diff 검토
   - 테스트/빌드 결과
   - i18n, styled-components, Redux, Atomic Design, MVVM 규칙 위반 여부
   - DB/API 계약 변경 리스크
   - 회귀 가능성을 확인한다.

### Codex Timeout / Cancel Rule

- Codex 검토 또는 검증 단계에서 5분 이상 새 응답, 상태 업데이트, 로그, 파일 변경이 없으면 메인 세션은 해당 Codex 작업을 cancel할 수 있다.
- 단, 테스트/build처럼 오래 걸리는 명령이 정상 실행 중이고 진행 상태가 확인되는 경우에는 즉시 cancel하지 않는다.
- cancel 후에는 현재까지 확보된 결과, 중단 이유, 다음 권장 조치를 사용자에게 보고한다.

### 계획 파일 권장 형식

```md
# <작업명>

## Request

## Scope

## Out of Scope

## Relevant Files

## Plan

## Verification

## Risks / Questions

## Adversarial Review

## Final Plan
```

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
