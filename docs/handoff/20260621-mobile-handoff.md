# 모바일 세션 인계 (2026-06-21)

새 노트북에서 이어받기 위한 인계 문서.

## 1. 푸시 완료된 작업 (git으로 따라옴)

브랜치 `develop`, 커밋 `a675049` (origin/develop 동기화됨).

- **앱 내 이미지 크롭**: `components/organisms/ImageCropModal.tsx` (gesture-handler 핀치/팬). Samsung에서 MainActivity 크래시 나던 네이티브 크롭 대체. `app/profile-edit.tsx` 아바타에 연결.
- **리뷰 사진 다중선택**: `app/review-form.tsx`에서 `legacy:true` 제거 → 모던 Android Photo Picker(다중선택+완료). `quality:1` + JS 압축으로 CompressionImageExporter 스톨 회피.
- **아이콘 폰트 임베드**: `assets/fonts/Ionicons.ttf` + `app.config.js`의 `expo-font` 플러그인. 터널 debug 빌드에서 아이콘이 한자로 깨지던 문제 해결.
- **가챠 드롭다운 스크롤**: `components/organisms/GachaProductSearch.view.tsx` Android 클리핑/그림자 수정.
- 루트 `GestureHandlerRootView` 래핑(`app/_layout.tsx`), imageCrop i18n(ko/en/ja/zh), profile/login/shop 잡수정.

## 2. 새 노트북 셋업 순서

```bash
git pull origin develop
pnpm install                      # gesture-handler 등 새 deps
cd apps/mobile
npx expo prebuild --platform android   # 아래 3번 주의 읽고 실행
```

## 3. 로컬 native 변경은 따라오지 않음 (중요)

이전 노트북 working tree에 커밋 안 한 `apps/mobile/android/**`(52개), `apps/mobile/ios/**`가 있었음 — **로컬 prebuild 산물이라 의도적으로 커밋 안 함**. 새 노트북엔 없음. `expo prebuild`로 재생성하면 됨.

재생성 시 자동 해결되는 것:

- **다중선택**: 커밋된 `build.gradle`엔 `androidx.activity` force 없음 → 자연히 1.11.0 해석 → 모던 Photo Picker 정상. (이전 노트북의 1.9.3 force-down 로컬 핵은 불필요해짐.)
- **폰트**: 커밋된 `app.config.js` expo-font + `assets/fonts/Ionicons.ttf` → prebuild가 android assets로 자동 복사.

로컬 dev 빌드(`com.gachamap.app.dev` 번들id, dev 아이콘 등)는 기존 prebuild 설정 따름. EAS production 빌드는 `eas-build-pre-install` 훅이 번들id를 `com.gachamap.app`으로 패치(루트 CLAUDE.md 배포 규칙 참고).

## 4. 검증 완료 / 미검증

- 검증됨(실기기 Galaxy A6): 아이콘 정상, 프로필 아바타 크롭 정상.
- 미검증: 리뷰 사진 **다중선택+완료** UX는 마지막 빌드에서 사용자 최종 확인 직전 상태. 새 빌드 후 한 번 더 확인 권장.

## 5. 빌드 명령 (로컬 실기기)

```bash
cd apps/mobile/android
./gradlew :app:installDebug -PreactNativeArchitectures=arm64-v8a
# Metro는 사용자 본인 터널 프로세스 사용 중. 에디트 반영 안 되면 --clear로 재시작.
```
