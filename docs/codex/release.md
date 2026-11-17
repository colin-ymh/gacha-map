# Mobile Release Checklist

Read this only for an authorized release task. Confirm deployment, secret, and production changes under `AGENTS.md` before executing them. Warn before deleting generated native directories.

The following checklist was carried over from `CLAUDE.md`. Recheck actual configuration and tool output before release. Never run the restore commands below over pre-existing user edits: record original contents, preserve version changes, and restore only the temporary bundle-ID patch. If that cannot be done safely, pause the release step.

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
4. **🚨 로컬 pbxproj를 `com.gachamap.app`으로 임시 패치한 뒤 빌드를 제출한다 (필수).** 네이티브 `ios/` 디렉토리가 존재하면 EAS는 `app.config.js`의 `bundleIdentifier`를 완전히 무시하고 `project.pbxproj`/`Info.plist` 값을 쓴다 (버전 문제와 동일 원인). 로컬은 개발 편의상 `com.gachamap.app.dev`로 유지되므로, **그대로 빌드하면 반드시 실패한다.**

   `eas-build-pre-install` 훅(`scripts/set-ios-bundle-id.js`)은 **EAS 빌드 서버의 체크아웃만** 패치한다. 그런데 provisioning profile은 그보다 **먼저 로컬 pbxproj 기준으로 선택돼 업로드**되므로, 서버에서 bundle id가 바뀌면 프로필과 어긋나 Xcode 단계에서 죽는다:

   ```
   Provisioning profile "*[expo] com.gachamap.app.dev AppStore ..." has app ID
   "com.gachamap.app.dev", which does not match the bundle ID "com.gachamap.app".
   ```

   즉 훅만으로는 iOS production 빌드가 **불가능하다.** 반드시 아래 절차를 쓴다.

   같은 이유로 **build number 계열도 갈린다.** 로컬이 `.dev`면 EAS가 App Store Connect를 조회하지 못해 자체 카운터(…10, 11)를 쓰는데, 그 계열 빌드는 전부 ERRORED로 남는다. 패치 후에는 ASC의 실제 최신값을 읽어 39 → 40처럼 올바른 번호를 부여한다. `build:version:get`이 11을 보여주더라도 그것은 죽은 계열의 숫자다.

### EAS 빌드 명령

**iOS는 로컬 패치 → 제출 → 즉시 되돌리기 순서를 지킨다. 패치 상태를 커밋하면 안 된다.**

```bash
cd apps/mobile

# 0. 작업 트리가 clean한지 확인 (되돌릴 때 남의 변경을 날리지 않도록)
git status --short

# 1. 로컬 pbxproj/Info.plist를 production bundle id로 임시 패치
#    (EAS 서버에서 도는 것과 동일한 스크립트를 로컬에서 실행)
EAS_BUILD_PROFILE=production node scripts/set-ios-bundle-id.js

# 2. 빌드 제출. 출력에 "Bundle Identifier com.gachamap.app"가 찍히는지 확인.
#    ".dev"가 보이면 즉시 중단하고 1번을 다시 한다.
eas build --platform ios --profile production --non-interactive --no-wait

# 3. 업로드가 끝나면 곧바로 되돌린다 (빌드 완료를 기다릴 필요 없음)
git checkout -- ios/app.xcodeproj/project.pbxproj ios/app/Info.plist
git status --short   # 비어 있어야 한다

# 4. 빌드 완료 확인
eas build:view <build-id>

# 5. App Store 제출
eas submit --platform ios --profile production --id <build-id> --non-interactive
```

Android는 이 문제가 없다 — provisioning profile이 없고 EAS 원격 keystore로 서명하므로 `set-android-bundle-id.js` 훅만으로 충분하다. versionCode도 단일 계열로 정상 증가한다.

- **주의**: `eas credentials`도 로컬 체크아웃의 pbxproj를 기준으로 동작한다. `com.gachamap.app` 번들 id용 push key(APNs)를 최초 1회 생성/지정해야 하는 경우에도 위와 같이 임시 패치 후 `eas credentials → iOS → production → Push Notifications`를 진행하고 `git checkout`으로 되돌린다 (커밋 금지).

- `.easignore`는 디렉토리 제외에 신뢰할 수 없다. 로컬에서 직접 삭제하는 것이 확실하다.
- `--auto-submit` 사용 금지: 백그라운드 타임아웃으로 취소된다. 빌드와 제출은 분리해서 실행한다.

## Android Play Store 배포 규칙

배포 전 반드시 아래 체크리스트를 순서대로 확인한다.

### 최초 설정 (한 번만)

1. **Google Play Console 앱 등록** — package name: `com.gachamap.app`
2. **Play Console 앱 콘텐츠 완료** — Data safety(위치/앱활동), 개인정보처리방침 URL, Content rating(IARC)
3. **EAS Android 키스토어 설정**:
   ```bash
   cd apps/mobile
   eas credentials --platform android --profile production
   # → "Android Keystore" → "Set up a new keystore" 선택
   ```
   ⚠️ 키스토어는 Play Store 업로드 후 변경 불가. 반드시 EAS managed keystore 사용.
4. **Firebase 프로젝트 + google-services.json**:
   - Firebase Console → Android 앱 추가 (`com.gachamap.app`) → `google-services.json` 다운로드
   - `eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`
   - EAS Dashboard에서 FCM V1 credentials 설정
5. **Play Store 서비스 계정**:
   - Google Play Console → API 액세스 → 서비스 계정 생성 → JSON 키 다운로드
   - `eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY --type file --value ./google-play-service-account.json`

### 버전 업 체크리스트

1. **`apps/mobile/app.config.js`** — `version` 필드 업데이트
2. **`apps/mobile/android/app/build.gradle`** — `versionName` 동일하게 업데이트
   - 네이티브 `android/` 디렉토리가 존재하면 EAS는 build.gradle을 직접 참조한다. 두 파일을 반드시 함께 수정한다.

### EAS 빌드 명령

```bash
cd apps/mobile

# 빌드 (--no-wait로 즉시 반환)
eas build --platform android --profile production --non-interactive --no-wait

# 빌드 완료 확인
eas build:view <build-id>

# Play Store 제출 (두 번째 제출부터)
eas submit --platform android --profile production --id <build-id> --non-interactive
```

- **첫 번째 제출**: `eas submit` 불가. Play Console UI에서 AAB 수동 업로드 (internal test track).
- `android/` 디렉토리가 커밋되어 있으므로 EAS는 app.config.js의 `package`를 무시하고 build.gradle의 `applicationId`를 사용한다.
  - 해결: `scripts/set-android-bundle-id.js` + `eas-build-pre-install` 훅으로 자동화됨. `EAS_BUILD_PROFILE === "production"`일 때만 `com.gachamap.app.dev` → `com.gachamap.app`으로 패치한다.
