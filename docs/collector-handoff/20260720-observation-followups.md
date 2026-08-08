# 콜렉터 핸드오프 — 2026-07-20 관측 2건 후속 요청

gacha-map admin `제보&수집큐`에서 발견된 2건. `gacha_product_discovery_requests`에 `admin_note`로도 동일 내용 남겨둠(각 row id 참고). 아래 내용 그대로 콜렉터 프로젝트 세션에 붙여넣어도 됨.

---

## Case 1 — 자동매칭 신뢰도 개선 요청 (장송의 프리렌 카타즌)

- observation_id: `573b09b3-192d-4b4c-885c-f2cf441675ba`
- discovery_request_id: `60c3ee2e-dc1a-47e6-9da4-ea615747af23`
- 이미지: `https://llawvidldrjjqwdbgfxh.supabase.co/storage/v1/object/public/scan-images/82bbebd7-88c1-412d-a993-75ea18ee8719/1784445043168.jpg`
- 추출 데이터: 제목(KO) "장송의 프리렌 카타즌", 제조사 힌트 "TAKARA TOMY"
- 결과: 유저가 후보 목록에서 직접 선택해서 매칭 완료 → 공식 카탈로그 상품 `2ed470db-4c5a-48f9-a0d4-b8f188933edf` ("肩ズンFig. 葬送のフリーレン", 제조사 takara_tomy_arts, status=active)에 연결됨.

**요청:** 이미지/추출 정보만으로도 이 상품은 카탈로그에 이미 존재하는 상품과 충분히 높은 신뢰도로 매칭 가능해 보임. 왜 자동으로 확정되지 않고 유저가 직접 골라야 했는지 확인 부탁 — 매칭 스코어링/임계값 로직 검토해서, 신뢰도 높은 케이스는 유저 개입 없이 자동 확정되도록 개선 요청.

---

## Case 2 — 신상품 조사 요청 (닥터 스톤 카타즌)

- observation_id: `3c6f2204-63a4-4019-b72d-880e62b16d4d`
- discovery_request_id (원본 스캔): `e2dabcc7-5ac5-4dda-9396-4e33ad4b8bf5`
- discovery_request_id (유저 직접입력 파생, 중복): `92a8f916-9ebb-40bd-a913-ac24031abffe`
- 이미지: `https://llawvidldrjjqwdbgfxh.supabase.co/storage/v1/object/public/scan-images/fd76af06-8acc-41e5-a6a7-31b035379a3d/1784445142357.jpg`
- 추출 데이터: 제목(KO) "닥터 스톤 카타즌", 제조사 힌트 "TAKARA TOMY", 시리즈 추정 "肩ズン"(카타즌)
- 결과: 카탈로그에 매칭되는 official 상품이 없어서, 유저가 "닥터스톤 꾸벅꾸벅 마스코트"라는 이름으로 직접 입력 → `gacha_products` 신규 row(`9fba187c-adf5-4d0c-aa77-3bf1f5428aa7`, status=**hidden**, manufacturer="직접입력") 생성 + 해당 샵(`83e0fbc6-a38c-4f5d-94a4-1a9549a26c97`, 캑티가챠샵 신중동점)에 등록됨.
- **주의:** status=hidden이라 전역 검색/카탈로그엔 안 뜨고, 이 샵 상세 화면에만 노출되는 임시 상태.

**요청:** 이 상품(TAKARA TOMY, 肩ズン 시리즈, 닥터 스톤 IP)의 공식 정보(정식 상품명, 발매월, 공식 이미지, JAN 코드)를 조사해서 `gacha_products`에 official 상품으로 새로 추가 요청. 추가되면 gacha-map 쪽에서 기존 hidden 상품(`9fba187c`)을 official 상품으로 병합/대체하는 작업이 별도로 필요함(이 문서 스코프 밖, gacha-map 쪽 후속 작업).

---

## 참고 — gacha-map 쪽 변경사항

이번에 `gacha_product_discovery_requests`에 `admin_note text` 컬럼을 추가함. 관리자가 admin UI(`제보&수집큐` → 콜렉터 큐 탭)에서 특정 row에 노트를 남기고, 필요시 status를 `pending`으로 되돌려서 콜렉터가 다시 조사하도록 재큐잉할 수 있음. **콜렉터가 이 컬럼을 폴링/조사 로직에서 실제로 읽어서 활용하려면 콜렉터 프로젝트 쪽에 별도 작업이 필요함** — 현재는 컬럼/데이터 전달 구조만 준비된 상태.
