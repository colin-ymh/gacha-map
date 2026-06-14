# 릴리즈 프로세스

## 환경 매트릭스

| 환경 | Git 브랜치 | Web URL | Supabase | 모바일 빌드 |
|------|-----------|---------|----------|------------|
| Local | 로컬 | http://localhost:3000 (시뮬레이터) | dev | EAS development |
| Staging | develop | https://gacha-map-git-develop-gachamap.vercel.app | dev | EAS preview |
| Production | main | https://the-gacha-map.vercel.app | prod | EAS production |

**불변 규칙**: EAS preview + staging 웹은 반드시 동일한 dev Supabase 프로젝트를 참조한다.

---

## Git 브랜치 전략

```
feature/* ──→ develop ──→ main
hotfix/*  ──→ main (+ develop 역머지)
```

| 브랜치 | 역할 |
|--------|------|
| `feature/*` | 작업 브랜치. PR로 develop 머지. |
| `develop` | staging 환경. push 시 Vercel Preview 자동 배포 + dev DB. |
| `main` | production 환경. PR만 허용. push 시 Vercel Production 자동 배포. |
| `hotfix/*` | 긴급 수정. main에서 분기 → main + develop 동시 머지. |

**GitHub branch protection**: `main` PR 필수, 직접 push 금지.

---

## 일반 릴리즈 (Non-Breaking API 변경)

1. `feature/*` → `develop` PR 머지 → staging 자동 배포
2. staging 웹 + EAS preview 앱으로 QA
3. `develop` → `main` PR 머지 → production 웹 자동 배포
4. iOS 버전 업 체크리스트 (CLAUDE.md 참고):
   - `apps/mobile/app.config.js` version 업데이트
   - `apps/mobile/ios/app/Info.plist` CFBundleShortVersionString 동일하게 업데이트
   - `ios/GachaMapDev*` 디렉토리 삭제 확인
   - Podfile: `project 'app.xcodeproj'`, `target 'app'` 확인
5. EAS production 빌드:
   ```bash
   eas build --platform ios --profile production --non-interactive --no-wait
   eas build:view <build-id>
   ```
6. App Store 제출:
   ```bash
   eas submit --platform ios --profile production --id <build-id> --non-interactive
   ```

---

## Breaking API 변경 릴리즈

> Breaking Change 정의: `docs/api-contracts.md` 하위 호환 정책 참고

1. `feature/*` → `develop` 머지
2. EAS preview 빌드로 staging에서 반드시 검증 (실기기)
3. `develop` → `main` 머지는 앱 버전도 함께 올릴 때만
4. web 배포 + 앱 배포 동시 진행
5. 구버전 앱 지원 최소 2~4주 유지

---

## EAS 환경변수 관리

Supabase 자격증명은 `eas.json`이 아닌 EAS 환경변수로 관리:

```bash
eas env:list --environment production
eas env:list --environment preview
eas env:list --environment development
```

`eas.json`에는 API URL(`EXPO_PUBLIC_API_URL`)만 선언한다.
