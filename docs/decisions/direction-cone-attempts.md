# 방향 콘 기능 시도 이력

내 위치 마커에 구글 지도 스타일 방향 콘을 추가하려는 시도와 실패 원인 기록.
같은 접근법을 반복하지 않기 위한 참고 문서.

## 시도 1 — NaverMapMarkerOverlay.angle prop

- **방법**: 방향 콘을 View(CSS border triangle)로 만들고 `NaverMapMarkerOverlay`의 `angle` prop으로 회전
- **실패 원인**: `angle` prop이 마커 이미지 자체(네이티브)를 회전시키는데, React View children이 함께 oval 왜곡됨

## 시도 2 — NaverMapMarkerOverlay + Pill View + angle

- **방법**: 시도 1과 동일, 마커 형태만 pill로 변경
- **실패 원인**: 동일 — angle prop + React View children 조합의 구조적 왜곡 문제

## 시도 3 — locationOverlay.bearing (subImage 없음)

- **방법**: SDK `locationOverlay`의 `bearing` prop으로 방향 설정
- **실패 원인**: SDK 기본 subImage가 투명 → 방향 콘이 화면에 표시되지 않음

## 시도 4 — NaverMapMarkerOverlay + Animated.Value (rotation)

- **방법**: `Animated.Value`로 rotation을 네이티브 스레드로 이동, `NaverMapMarkerOverlay`에 콘 View 렌더
- **실패 원인**: rotation만 네이티브로 이동했을 뿐, `NaverMapMarkerOverlay`의 **위치(position)**는 여전히 JS 스레드 계산.
  네이티브 줌 애니메이션(native thread) ↔ JS 위치 계산 desync → zoom 시 마커 jitter.
  `NaverMapMarkerOverlay`를 사용하는 한 이 문제는 구조적으로 해결 불가.

## 시도 5 — locationOverlay.bearing + subImage (커스텀 PNG)

- **방법**: SDK `locationOverlay`에 `bearing` + `subImage`(44×44 PNG 콘) + `subAnchor: { x: 0.5, y: 1.0 }` 설정
- **실패 원인**: 콘(subImage)이 파란 원(main locationOverlay)에서 분리되어 표시됨.
  `subAnchor` 기준점이 예상과 다르게 동작하거나, SDK 내부에서 subImage 위치 계산이
  main image anchor와 다른 기준을 사용하는 것으로 추정. 정확한 SDK 내부 동작 불명확.
  줌 jitter도 여전히 발생.

## 결론

`@mj-studio/react-native-naver-map` SDK에서 방향 콘을 구현하려면:

- `NaverMapMarkerOverlay` 방식은 zoom 중 JS thread desync로 jitter 불가피
- `locationOverlay.subImage` 방식은 위치 분리 문제 발생
- SDK 자체 기본 제공 방향 표시(bearing)는 있으나 커스텀 이미지 위치 정밀 제어가 어려움

## 향후 재시도 시 고려 사항

- SDK 버전 업그레이드 후 `locationOverlay.subImage` 동작 재확인
- 네이티브 모듈 직접 수정 (JSI/TurboModule 레벨)
- Naver Maps 공식 SDK 문서에서 `subAnchor` 정확한 기준점 확인
