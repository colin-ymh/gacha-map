# 콜렉터 핸드오프 — 상품 파이프라인 주간 전환

gacha-collector 세션에 그대로 붙여넣어서 사용. `.github/workflows/biweekly-collector.yml` 수정 요청.

---

## 배경

gacha-map 쪽에서 "신상 가챠" 홈 화면 섹션을 만들려고 하는데, 상품 마스터 파이프라인이 지금 샵 후보 파이프라인과 같이 격주(14일)로 묶여 돌고 있어서 "이번 주 신상" 배치가 깔끔하게 안 나옴. 상품 파이프라인만 매주 실행되도록 분리하고 싶음. 샵 후보 파이프라인(카카오/구글 API, OpenAI 비용 있음)은 격주 그대로 유지 — 비용 때문에 같이 주간화하지 않음.

## 현재 구조

`.github/workflows/biweekly-collector.yml`:

- cron은 이미 매주 일요일 17:00 UTC에 트리거됨(`0 17 * * 0`).
- `guard` job이 `days_since_anchor % 14 == 0`일 때만 `should_run=true`를 내보내서, 실질적으로 격주로만 실행됨(39-67행).
- `shop`/`product` job 둘 다 이 하나의 `should_run` output에 의존(73행, 157행).

## 요청 사항

`guard` job의 output을 `should_run_shop`과 `should_run_product` 두 개로 분리해줘.

- **`should_run_shop`**: 기존 로직 그대로 유지.
  - `workflow_dispatch`(수동 실행)면 무조건 `true`.
  - 스케줄 트리거인데 anchor(`2026-06-07 17:00:00 UTC`) 이전이면 `false`.
  - 스케줄 트리거이고 anchor 이후면 `days_since_anchor % 14 == 0`일 때만 `true`.
- **`should_run_product`**: 위와 거의 같지만 모듈로 체크만 제거.
  - `workflow_dispatch`면 무조건 `true`.
  - 스케줄 트리거인데 anchor 이전이면 `false`.
  - 스케줄 트리거이고 anchor 이후면 **항상 `true`**(`%14` 체크 없음) — cron이 이미 매주 실행되니까 이것만으로 상품 파이프라인이 주간화됨.

그리고 `shop`/`product` job의 `if` 조건(73행, 157행)에서 각각 맞는 output을 참조하도록 바꿔줘(`inputs.pipeline` 관련 분기 조건은 그대로 유지).

나머지(secrets, npm 스크립트, `--new-only` 플래그, concurrency group 등)는 안 건드려도 됨 — `--new-only`가 이미 중복 수집을 걸러주니까 주간 실행해도 안전하다고 판단함.

## 확인 요청

- 수정 후 `workflow_dispatch`로 `pipeline=product`, `product_dry_run=true` 넣어서 수동 실행해보고 guard 분리가 의도대로 동작하는지 확인 부탁.
- 워크플로우 이름/파일명이 여전히 "Biweekly Collector"인데, 상품 파이프라인만 주간이 되면 이름이 좀 안 맞음 — 원한다면 이름/주석 정도만 손봐도 되고, 급한 건 아니라서 그냥 둬도 무방.
- GitHub Actions 사용량이 상품 파이프라인 기준 2배로 늘어나는 점 참고(샵 파이프라인은 그대로라 전체 증가폭은 제한적).
