# 비로그인 기능 게이트 로그인 모달 통일

## Request
비로그인 상태에서 기능 사용 시 뜨는 로그인 유도 팝업이 기능마다 문구/형태가 제각각이고 일부 누락. 하나로 통일.

## Scope
- 기능 게이트(비로그인 상태에서 기능 실행 시) 로그인 유도 팝업을 단일 `LoginModal` + 단일 문구로 통일.
- 대상 호출부: 찜(home `index.tsx`, `shop/[id]`), 리뷰(`shop/[id]`), 샵신청(`shop-application`, `shop-applications`), 가챠 제보(`GachaSection` → `shop/[id]` 위임).

## Out of Scope
- 세션 만료/인증 에러 Alert는 유지 (성격 다름): `profile.tsx`(withdraw), `profile-edit.tsx`(save), `report-history.tsx`(load). 사용자 결정: "기능 게이트만 통일".
- `report.tsx` 익명 제보 — 비로그인 의도적 허용. 게이트 추가 안 함.
- 로그인 화면(`login.tsx`) 자체 카피 변경 없음.

## Decisions (사용자 확정)
- 방식: 기존 `LoginModal` 단일화 (feature 분기 제거).
- 문구: 타이틀 "로그인이 필요해요" / 설명 "로그인하면 더 많은 기능을 이용할 수 있어요".

## Relevant Files
- `components/ui/LoginModal.tsx` — `feature` prop + `FEATURE_KEYS` 제거, 단일 아이콘/문구.
- `app/shop/[id].tsx` — `loginModalFeature` state + `setLoginModalFeature` 호출 제거(109-148, 544-547, 612-617), `<LoginModal>` feature prop 제거.
- `app/shop-application.tsx`, `app/shop-applications.tsx` — `feature="application"` 제거.
- `app/(tabs)/index.tsx` — 이미 default 사용. 변경 없음(확인만).
- `components/organisms/gacha/GachaSection.tsx` — `onLoginRequired`로 위임만, 변경 없음(확인만).
- `messages/{ko,en,ja,zh}.json` — `login` 네임스페이스 키 통합.

## Plan
1. **LoginModal.tsx**: `feature` prop/`FEATURE_KEYS` 삭제. 고정 아이콘(`log-in-outline`), `t("login.required")` / `t("login.requiredDesc")`, 버튼 `t("login.loginBtn")`, 취소 `t("login.cancel")`.
2. **i18n (4개 언어)**: `login`에 `required`, `requiredDesc`, `loginBtn`, `cancel` 추가. 미사용된 `wishRequired/wishRequiredDesc/reviewRequired/reviewRequiredDesc/applicationRequired/applicationRequiredDesc/wishLoginBtn/wishCancel` 제거.
   - ko: required="로그인이 필요해요", requiredDesc="로그인하면 더 많은 기능을\n이용할 수 있어요", loginBtn="로그인하기", cancel="취소".
   - en/ja/zh 동일 의미 번역.
3. **호출부 정리**: shop/[id]에서 feature state 제거(단순 `setShowLoginModal(true)`). shop-application(s)에서 `feature` prop 제거.
4. **누락 점검**: 비로그인 write 액션 전수 확인 — 게이트 없이 무반응/에러로 빠지는 곳 없는지. (report 익명 제외)

## Verification
- 에뮬(비로그인 상태)에서: 홈 찜, 샵상세 찜, 샵상세 리뷰쓰기, 가챠 있었어요/없었어요, 샵신청 → 모두 동일 모달(동일 문구) 뜨는지 스크린샷 확인.
- "로그인하기" → 로그인 화면 이동 확인.
- `tsc --noEmit` 통과, 미사용 i18n 키 참조 0건(`rg`로 확인).

## Risks / Questions
- i18n 키 삭제 시 다른 참조처 잔존 가능 → 삭제 전 `rg`로 전 참조 확인 필수.
- shop-application.tsx는 마운트 시 `showLoginModal(!isLoggedIn)` — 진입 즉시 모달. 동작 유지.

## Adversarial Review
(codex 검토 결과 반영 예정)
