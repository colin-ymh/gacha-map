# 검색 결과 "지도에서 보기"

## Request

검색 오버레이(샵 검색 결과 리스트)에서 "지도에서 보기" 버튼 추가.
버튼 탭 시 오버레이를 닫고 검색 결과 핀을 지도에 유지한 채 카메라를 결과 범위에 맞게 이동.

## Scope

- 샵 검색 탭(`activeTab === "shop"`)에만 적용
- 결과가 1개 이상일 때만 버튼 노출
- 가챠 탭은 좌표 없으므로 미적용

## Out of Scope

- 가챠 상품 탭 "지도에서 보기"
- 찜 목록(search.tsx) 탭의 지도 연동

## Relevant Files

- `apps/mobile/components/organisms/map/naver-map.tsx` — NaverMapHandle, fitToShops 추가
- `apps/mobile/app/(tabs)/index.tsx` — handleAutoLoad 가드, handleViewOnMap, UI 버튼
- `apps/mobile/messages/ko.json` — viewOnMap 키
- `apps/mobile/messages/en.json` — viewOnMap 키

## Plan

### 1. `naver-map.tsx` — `fitToShops` 추가

`NaverMapHandle` interface에 추가:
```ts
fitToShops: (shops: Array<{ lat: number; lng: number }>) => void;
```

구현 (`centerOnShop` 바로 아래):
```ts
const fitToShops = useCallback((shops: Array<{ lat: number; lng: number }>) => {
  if (shops.length === 0) return;
  if (shops.length === 1) {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    isProgrammaticMoveRef.current = true;
    suppressTimerRef.current = setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 1100);
    mapRef.current?.animateCameraTo({
      latitude: shops[0].lat,
      longitude: shops[0].lng,
      zoom: 15,
      duration: 300,
    });
    return;
  }
  const lats = shops.map((s) => s.lat);
  const lngs = shops.map((s) => s.lng);
  const swLat = Math.min(...lats);
  const neLat = Math.max(...lats);
  const swLng = Math.min(...lngs);
  const neLng = Math.max(...lngs);
  const minDelta = 0.01; // 약 1km, 같은 위치 결과 대비
  const dLat = Math.max((neLat - swLat) * 0.1, minDelta);
  const dLng = Math.max((neLng - swLng) * 0.1, minDelta);
  if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
  isProgrammaticMoveRef.current = true;
  suppressTimerRef.current = setTimeout(() => {
    isProgrammaticMoveRef.current = false;
  }, 1100);
  mapRef.current?.animateCameraWithTwoCoords({
    coord1: { latitude: swLat - dLat, longitude: swLng - dLng },
    coord2: { latitude: neLat + dLat, longitude: neLng + dLng },
    duration: 300,
  });
}, []);
```

`useImperativeHandle`에 `fitToShops` 추가.

### 2. `index.tsx` — handleAutoLoad 가드

```ts
// 기존
const handleAutoLoad = useCallback((bounds: Bounds) => {
  if (searchOpen) return;
  dispatch(fetchByBounds(bounds));
}, [dispatch, searchOpen]);

// 변경
const handleAutoLoad = useCallback((bounds: Bounds) => {
  if (searchOpen || mode === "search") return;
  dispatch(fetchByBounds(bounds));
}, [dispatch, searchOpen, mode]);
```

### 3. `index.tsx` — handleViewOnMap 신규

```ts
const handleViewOnMap = useCallback(() => {
  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  gachaAbort.current?.abort();
  setGachaResults([]);
  setSearchOpen(false);
  // exitSearch() 호출 안 함 → mode==="search" 유지 → displayShops = searchShops
  if (searchShops.length > 0) {
    setTimeout(() => {
      mapRef.current?.fitToShops(searchShops);
    }, 50);
  }
}, [searchShops]);
```

### 4. `index.tsx` — UI 버튼

결과 카운트 `<View>` 교체 (shop 탭, `inputText.trim().length > 0 && status !== "loading"` 조건 블록):

```tsx
<View style={{ flexDirection: "row", alignItems: "center",
               paddingHorizontal: 16, paddingVertical: 10 }}>
  <Text style={{ flex: 1, fontSize: 13, color: TEXT_GRAY }}>
    {t("map.shopSearchCount", { count: searchShops.length })}
  </Text>
  {searchShops.length > 0 && (
    <TouchableOpacity
      onPress={handleViewOnMap}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <Ionicons name="map-outline" size={14} color={PRIMARY} />
      <Text style={{ fontSize: 13, color: PRIMARY, fontWeight: "600" }}>
        {t("map.viewOnMap")}
      </Text>
    </TouchableOpacity>
  )}
</View>
```

### 5. i18n

`ko.json` `"map"` 섹션에 추가:
```json
"viewOnMap": "지도에서 보기"
```

`en.json` `"map"` 섹션에 추가:
```json
"viewOnMap": "View on map"
```

## Verification

- 샵 검색 → 결과 있음 → "지도에서 보기" 버튼 노출 확인
- 버튼 탭 → 오버레이 닫힘, 지도에 핀 유지, 카메라 fit 확인
- 지도 탐색(pan/zoom) 후에도 핀 유지 확인
- 플로팅 검색바에 쿼리 텍스트 남아있음 확인
- X 버튼 탭 → 핀 제거 및 bounds 재로드 재개 확인
- 결과 0개일 때 버튼 미노출 확인
- 결과 1개일 때 단일 샵 중심으로 카메라 이동 확인
- 결과 여러 개이고 모두 같은 좌표일 때 크래시 없음 확인

## Risks / Questions

- `animateCameraWithTwoCoords`에 coord1 == coord2 전달 시 최대 줌 → `minDelta`로 완화
- `setTimeout(50)` 지연은 경험치 기반. 느린 기기에서 더 길어야 할 수 있음
- `mode === "search"` 가드로 인해 검색 결과 보는 중 지도 이동해도 bounds 재로드 안 됨 — 의도된 동작

## Adversarial Review 반영 사항

1. `fitToShops`에 `suppressTimerRef` + `isProgrammaticMoveRef` 추가 — 카메라 이동 후 idle suppress
2. `setTimeout(50)` — 오버레이 닫힌 후 지도 복원 타이밍 대기
3. `minDelta = 0.01` — 동일 좌표 결과 시 최대 줌 방지
