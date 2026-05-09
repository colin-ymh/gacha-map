# 모바일 지도 UX 개선

## Request

모바일 지도 화면에서 5가지 UX 문제 개선:

1. 화면에 있는 샵들이 정확히 불러와지지 않음
2. 마커 클릭 → 샵 목록 재로딩으로 선택된 샵이 사라짐
3. 마커 클릭 시 바텀시트에 마커가 가려짐 + 확대 과함
4. 전체 지도 UX 개선
5. 샵을 최대 20개씩 불러오고, 지도 중앙 상단 FAB으로 "샵 더불러오기"

## 분석

### 이슈 1: 샵 로딩 정확도

**현재 동작**:

- `handleCameraChanged` → 600ms 디바운스 → `onBoundsChange(viewportBounds)` 호출
- Redux `fetchShopsByBoundsAsync`에서 정확히 viewport bounds로 API 호출 (`limit: 100`)
- viewport bounds에 padding 없음 → 화면 가장자리 샵이 bounds 경계에 걸려 누락될 수 있음
- API 정렬 파라미터가 전달되지 않음 (클라이언트 정렬만 적용)

**웹 대비**:

- 웹: 30% padding 적용한 fetchBounds로 API 호출 (`limit: 100`)
- 웹: cache hit 시 viewport bounds로 필터링하여 표시

**근본 원인**: viewport에 padding 없음 + API sort 미전달 → 특정 영역에 샵이 쏠려 나옴

### 이슈 2: 마커 클릭 → 샵 목록 변경

**현재 동작**:

1. `handleShopPress` → `centerOnShop(lat, lng)` 호출
2. `animateCameraTo` 실행 (duration: 300ms, zoom: 14)
3. `onCameraChanged` 연속 발화 (reason: "Animation" 추정)
4. 600ms 디바운스 후 `onBoundsChange` → 새 fetch
5. 새 viewport에서 선택된 샵이 경계 밖으로 벗어날 경우 목록에서 사라짐

**근본 원인**: 프로그래매틱 카메라 이동(centerOnShop)도 bounds 변경 이벤트를 발화시켜 재로딩 트리거

**해결 방향**:

- `isProgrammaticMoveRef` 플래그를 naver-map.tsx에 추가
- `centerOnShop` 호출 시 플래그 set, `animation duration + debounce` 이후 reset
- `handleCameraChanged`에서 플래그가 set된 경우 `onBoundsChange` 호출 skip
- 단, 초기 GPS 이동은 suppression 대상 아님 (centerOnShop을 통하지 않기 때문에 자동 제외)

### 이슈 3: 마커 클릭 시 가려짐 + 과한 확대

**현재 동작**:

- `centerOnShop` → `zoom: 14` 강제
- `mapLatOffset`: 바텀시트 위 가시 영역 중앙에 마커를 배치하도록 위도 오프셋 계산

**문제점 A (확대 과함)**:

- 사용자가 넓은 줌(예: zoom 11-13)에서 마커를 탭하면 zoom 14로 강제 이동 → 과한 확대
- 반대로 zoom 15-16에서 탭하면 zoom 14로 이동 → 오히려 축소

**문제점 B (가려짐)**:

- `mapLatOffset` 계산에 상단 SafeAreaInset이 반영되지 않을 수 있음
- `DEG_PER_PX = 0.0000683`는 zoom 14에서의 상수 → zoom 강제 없이 현재 zoom 유지 시 offset 부정확

**해결 방향**:

- `centerOnShop` zoom 강제 제거: 현재 zoom 유지, 최솟값 13 적용
  ```ts
  const currentZoom = mapRef.current?.getCameraPosition()?.zoom ?? 14;
  const targetZoom = Math.max(13, currentZoom);
  ```
- `mapLatOffset`를 zoom에 비례하여 동적으로 계산하거나, zoom 14 고정 유지 (단, 과한 확대는 제거)
- 가장 단순한 fix: zoom 강제 제거, `zoom: undefined` (현재 zoom 유지)
  → DEG_PER_PX를 zoom에 따라 동적 계산 필요

**단순화 방안**: zoom을 14로 유지하되 마커 클릭 시 zoom이 이미 14 이상이면 변경 안 함

### 이슈 4: 전체 지도 UX 개선

구체적인 개선 아이디어:

- 지도 이동 중 로딩 인디케이터 개선 (현재 있음, 위치 조정 필요)
- 선택된 마커 시각적 구분 개선 (크기 차이 있으나 줌 레벨에 따라 작게 보일 수 있음)
- "이 지역 검색" FAB: 사용자가 직접 지도를 이동한 후 원하는 시점에 검색하는 패턴
  → 현재는 지도 이동 후 자동 검색인데, 의도적 상호작용 기반으로 변경 가능

**범위 외**: 이슈 4는 UX 방향 결정이 필요하므로 이번 계획에서는 "이 지역 검색" 버튼 추가 여부만 확인 후 결정

### 이슈 5: 20개 페이지네이션 + 더불러오기 FAB

**현재 동작**: `limit: 100` 한 번에 전량 로딩

**목표**:

- 초기 fetch: `limit: 20`, `sort` 파라미터 전달
- `hasMore` 상태 관리
- 지도 중앙 상단 FAB "샵 더불러오기" 표시 (non-search 모드)
- FAB 클릭 시 `offset + 20`으로 추가 fetch, 기존 shop 목록에 append
- 웹 `LoadMoreFab` 패턴과 동일

**API 지원 확인**:

- `fetchShops` 파라미터: `{ bounds, sort, offset, limit, userLat, userLng }` ✓
- `SortOption` (shared): `"name" | "distance" | "wishlist_count"`
- 모바일 `SortType`: `"latest" | "name" | "distance" | "wish"`
- **매핑 필요**: `"wish"` → `"wishlist_count"`, `"latest"` → undefined(기본 정렬), `"distance"` → `"distance"` + userLat/userLng

**캐시 영향**: 현재 shops.slice의 boundsCache는 전체 결과를 저장. 페이지네이션 도입 시:

- 캐시 전략: `offset: 0` 결과만 캐싱하고, load more는 캐시 미적용 (심플 유지)
- 캐시 구조 변경 최소화

## Scope

1. `naver-map.tsx` (mobile): `isProgrammaticMoveRef` 플래그로 centerOnShop 후 재로딩 방지
2. `naver-map.tsx` (mobile): `centerOnShop` zoom 강제 완화 (현재 zoom ≥ 13 이면 유지)
3. `shops.slice.ts`: limit 20, sort/userLat/userLng 파라미터 추가, `total`/`hasMore` 상태 추가, `loadMoreShopsByBoundsAsync` 추가
4. `index.tsx`: sort → API sort 매핑, 거리순 시 userLocation 전달, "더불러오기" FAB 추가 (지도 상단 중앙), bounds fetch에 padding 추가 처리
5. naver-map.tsx (mobile) bounds padding: dispatch 전 padding 적용 또는 slice 내부에서 처리

## Out of Scope

- 이슈 4 "이 지역 검색" 버튼 (별도 기획 필요)
- distance sort 시 실시간 위치 추적 (현재 static location 사용)
- 웹 변경 (웹은 이미 20+FAB 패턴 보유)
- 캐시 구조 전면 개편

## Relevant Files

| 파일                                                 | 변경 내용                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/mobile/components/organisms/map/naver-map.tsx` | isProgrammaticMoveRef 추가, centerOnShop zoom 완화                          |
| `apps/mobile/store/slices/shops.slice.ts`            | limit 20, total/hasMore, sort/userLat 파라미터, loadMore thunk              |
| `apps/mobile/app/(tabs)/index.tsx`                   | SortType→SortOption 매핑, userLocation 전달, 더불러오기 FAB, bounds padding |

## Plan

### Step 1: `apps/mobile/components/organisms/map/naver-map.tsx`

**1-1. isProgrammaticMoveRef 추가 (이슈 2)**

```ts
const isProgrammaticMoveRef = useRef(false);
const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

`centerOnShop` 내부:

```ts
// 기존 animateCameraTo 호출 전
if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
isProgrammaticMoveRef.current = true;
// animation duration(300) + debounce(600) + 여유(200) = 1100ms
suppressTimerRef.current = setTimeout(() => {
  isProgrammaticMoveRef.current = false;
}, 1100);
```

`handleCameraChanged` 디바운스 콜백 내부:

```ts
boundsTimerRef.current = setTimeout(() => {
  if (isProgrammaticMoveRef.current) return; // suppressed
  // ... 기존 bounds 계산 및 onBoundsChange 호출
}, 600);
```

**1-2. centerOnShop zoom 완화 (이슈 3)**

현재:

```ts
mapRef.current?.animateCameraTo({
  latitude: lat - mapLatOffset,
  longitude: lng,
  zoom: 14,
  duration: 300,
});
```

변경:

```ts
// zoom 파라미터 제거 → SDK가 현재 zoom 유지
// 단, DEG_PER_PX는 zoom 14 기준이므로 mapLatOffset는 zoom 14 근처에서만 정확함
// zoom 14로 고정하되, 현재 zoom이 14 이상이면 그대로 유지
mapRef.current?.animateCameraTo({
  latitude: lat - mapLatOffset,
  longitude: lng,
  duration: 300,
});
```

> 참고: `@mj-studio/react-native-naver-map`의 `animateCameraTo`에서 `zoom` 생략 시 현재 zoom 유지되는지 API 문서 확인 필요. 지원 안 되면 zoom 14 유지 + mapLatOffset DEG_PER_PX를 동적 계산으로 대체.

**1-3. cleanup 추가**

```ts
useEffect(() => {
  return () => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
  };
}, []);
```

### Step 2: `apps/mobile/store/slices/shops.slice.ts`

**State 확장**:

```ts
interface ShopsState {
  shops: ShopSummary[];
  total: number;
  offset: number;
  hasMore: boolean;
  boundsCache: BoundsCacheEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  currentBounds: Bounds | null;
  currentSort: SortOption | undefined;
  userLocation: { lat: number; lng: number } | null;
}
```

**Reducers 추가/수정**:

- `fetchSuccess`: total, offset 저장, hasMore 계산
- `fetchMoreSuccess`: shops에 append, offset 갱신
- `setLoadingMore`, `setUserLocation`, `setCurrentSort` 추가

**Thunk 수정**:

```ts
// fetchShopsByBoundsAsync: limit을 20으로, sort/userLat/userLng 추가
const result = await fetchShops(API_BASE, {
  bounds,
  limit: 20,
  offset: 0,
  sort,
  ...(sort === "distance" && userLat && userLng && { userLat, userLng }),
});
```

**loadMoreShopsByBoundsAsync 추가**:

```ts
export const loadMoreShopsByBoundsAsync = () => async (dispatch, getState) => {
  const { shops: state } = getState();
  if (!state.hasMore || state.loadingMore || !state.currentBounds) return;
  dispatch(shopsSlice.actions.setLoadingMore(true));
  const nextOffset = state.offset + 20;
  try {
    const result = await fetchShops(API_BASE, {
      bounds: state.currentBounds,
      limit: 20,
      offset: nextOffset,
      sort: state.currentSort,
      ...(state.currentSort === "distance" &&
        state.userLocation && {
          userLat: state.userLocation.lat,
          userLng: state.userLocation.lng,
        }),
    });
    dispatch(
      shopsSlice.actions.fetchMoreSuccess({
        shops: result.shops,
        offset: nextOffset,
        total: result.total,
      }),
    );
  } catch (e) {
    dispatch(shopsSlice.actions.setLoadingMore(false));
  }
};
```

### Step 3: `apps/mobile/app/(tabs)/index.tsx`

**SortType → SortOption 매핑**:

```ts
function toApiSort(sortType: SortType): SortOption | undefined {
  switch (sortType) {
    case "name":
      return "name";
    case "distance":
      return "distance";
    case "wish":
      return "wishlist_count";
    default:
      return undefined; // "latest"
  }
}
```

**handleBoundsChange 수정 (bounds padding + sort/userLocation 전달)**:

```ts
const handleBoundsChange = useCallback(
  (bounds: Bounds) => {
    // 20% padding 추가 (이슈 1)
    const latPad = (bounds.neLat - bounds.swLat) * 0.2;
    const lngPad = (bounds.neLng - bounds.swLng) * 0.2;
    const fetchBounds: Bounds = {
      swLat: bounds.swLat - latPad,
      swLng: bounds.swLng - lngPad,
      neLat: bounds.neLat + latPad,
      neLng: bounds.neLng + lngPad,
    };
    dispatch(
      fetchShopsByBoundsAsync(fetchBounds, toApiSort(sortType), userLocation),
    );
  },
  [dispatch, sortType, userLocation],
);
```

**더불러오기 FAB 추가 (이슈 5)**:

- `hasMore`: `useAppSelector((s) => s.shops.hasMore)`
- `isLoadingMore`: `useAppSelector((s) => s.shops.loadingMore)`
- position: 검색창 아래, 지도 상단 중앙
- 비검색 모드에서만 표시

```tsx
{
  hasMore && !isSearchMode && !isLoadingShops && (
    <TouchableOpacity
      style={{
        position: "absolute",
        top: insets.top + 64,
        alignSelf: "center",
        backgroundColor: "#fff",
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: "#e5e5e5",
      }}
      onPress={() => dispatch(loadMoreShopsByBoundsAsync())}
    >
      {isLoadingMore ? (
        <ActivityIndicator size="small" color="#e94b8c" />
      ) : (
        <Text style={{ fontSize: 13, color: "#1a1a1a", fontWeight: "500" }}>
          샵 더 불러오기
        </Text>
      )}
    </TouchableOpacity>
  );
}
```

**distance sort 시 userLocation 관리**:

- `sortType === "distance"` 변경 시 `goToMyLocation` 또는 Expo Location으로 위치 취득
- 취득한 위치를 `userLocation` 로컬 state에 저장 (기존 index.tsx에 없음, 추가 필요)

## Verification

1. 마커 클릭 → bounds 재로딩 억제 확인 (선택된 샵이 목록에 유지됨)
2. 줌아웃 상태에서 마커 클릭 → zoom 14 강제 이동 없이 현재 zoom 유지
3. 화면 가장자리 샵 표시 개선 확인 (padding 적용)
4. "샵 더 불러오기" FAB 표시 및 동작 확인
5. 정렬 변경(이름순/거리순/찜 많은 순) 시 API 정렬 적용 확인
6. TypeScript 오류 없음

## Risks / Questions

| 항목                                  | 리스크                                                                     | 완화                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `animateCameraTo` zoom 생략 지원 여부 | SDK가 zoom 생략 미지원 시 에러                                             | SDK API 확인 후 대안: zoom: current 읽어서 전달                                   |
| bounds padding + limit 20 충돌        | 20개가 padding 영역에 분산되어 viewport 내 샵이 10개 미만 가능             | padding을 20%로 제한 (web의 30% 보다 작게)                                        |
| isProgrammaticMoveRef 타이밍          | 1100ms 후 reset 시 사용자가 이미 제스처 수행 중이면 해당 제스처도 suppress | suppressTimerRef를 clearTimeout으로 취소하고, Gesture 이벤트 시 즉시 플래그 reset |
| loadMore + bounds 변경 경합           | bounds 변경 시 loadMore 결과 덮어쓸 수 있음                                | bounds 변경 시 currentBounds 갱신 → loadMore는 currentBounds 기준으로 동작        |
| SortType → SortOption 매핑            | "latest" sort를 API에 undefined로 전달 시 API 기본 정렬이 다를 수 있음     | API 기본 정렬 확인 후 필요 시 명시적 sort 추가                                    |

## Adversarial Review

Codex가 아래 5가지 Critical 이슈를 지적함.

### Critical 1: bounds padding → cache 의미 파괴

- `index.tsx`에서 padding 후 Redux에 dispatch 시, cache key = padded bounds
- cache hit 시 viewport 밖 샵도 목록에 표시됨 (off-screen 샵)
- **해결**: padding을 `fetchShopsByBoundsAsync` 내부에서 적용. `currentBounds`는 실제 viewport bounds로 저장, API 호출에만 padded bounds 사용.

### Critical 2: isProgrammaticMoveRef가 사용자 제스처도 억제

- 1100ms window 중 사용자가 지도 드래그 → bounds 재로딩이 억제됨
- 계획의 "Gesture 이벤트 즉시 reset" 내용이 구현 코드에 없음
- **해결**: `handleCameraChanged`에서 `reason === "Gesture"` 시 `suppressTimerRef` clear + `isProgrammaticMoveRef = false` 즉시 실행 후 계속 진행.

### Critical 3: zoom 제거 → DEG_PER_PX 오산 확정

- `DEG_PER_PX = 0.0000683`은 zoom 14 기준 상수
- zoom을 제거하면 다른 zoom 레벨에서 offset 계산 오차 발생
- **해결**: `zoom: Math.max(14, currentZoom)` — 이미 zoom 14 이상이면 현재 zoom 유지 (줌아웃 방지), 미만이면 14로 이동. DEG_PER_PX는 zoom 14 기준 유지 (zoom > 14에서 오차가 "마커가 너무 높이 표시" 방향으로 발생하므로 가시성에 문제 없음).

### Critical 4: loadMore + bounds 변경 경합 시 stale 결과 append

- bounds 변경 중 loadMore 응답이 도착하면 새 지역 목록에 이전 지역 샵이 append됨
- **해결**: thunk 시작 시 `currentBounds`를 캡처, 완료 후 현재 `state.currentBounds`와 비교. 다르면 dispatch 없이 discard.

### Critical 5: 정렬 변경 시 API 재요청 없음 + 클라이언트 이중 정렬

- `sortType` 변경 시 새 sort로 API 재요청 없음
- 클라이언트 sort + API sort가 중첩 적용됨
- **해결**: `index.tsx`에 `sortType` 변경 감지 effect 추가 → `currentBounds`로 재요청. API로 처리되는 `name/distance/wishlist_count`에 대한 클라이언트 정렬 제거.

### Medium 1: cache key에 sort 미포함

- 동일 bounds, 다른 sort → cache hit 시 잘못된 순서 반환
- **해결**: `BoundsCacheEntry`에 `sort` 필드 추가, cache 조회 시 sort도 비교.

### Medium 2: userLocation 중복 취득

- `naver-map.tsx`에서 이미 위치를 취득하는데 `index.tsx`에도 별도 취득 필요
- **해결**: `naver-map.tsx`에 `onUserLocation?: (loc: {lat, lng}) => void` 콜백 prop 추가. 위치 취득 시 콜백 호출, `index.tsx`에서 상태 관리.

### Medium 3: FAB + loading indicator UI 위치 겹침

- 로딩 인디케이터와 FAB이 동일 위치 가능
- **해결**: FAB은 `isLoadingShops`가 false일 때만 표시.

## Final Plan

### 확정 범위

| 파일                                                 | 변경                                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/components/organisms/map/naver-map.tsx` | isProgrammaticMoveRef, Gesture 즉시 reset, zoom 완화, onUserLocation 콜백                                                         |
| `apps/mobile/store/slices/shops.slice.ts`            | padding 내부 적용, total/hasMore/offset/loadingMore/currentBounds/currentSort state, sort cache key, loadMore thunk + stale check |
| `apps/mobile/app/(tabs)/index.tsx`                   | SortType→SortOption 매핑, sortType 변경 effect, 클라이언트 정렬 제거(API 담당분), userLocation state, 더불러오기 FAB              |

---

### Step 1: `apps/mobile/components/organisms/map/naver-map.tsx`

**1-1. 새 ref 추가**

```ts
const isProgrammaticMoveRef = useRef(false);
const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**1-2. handleCameraChanged 수정**

```ts
const handleCameraChanged = useCallback(
  (params) => {
    if (params.reason === "Gesture") {
      // 사용자 제스처: 프로그래매틱 억제 즉시 해제
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      isProgrammaticMoveRef.current = false;
      onMapInteraction?.();
    }

    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    const { region } = params;
    boundsTimerRef.current = setTimeout(() => {
      if (isProgrammaticMoveRef.current) return; // 프로그래매틱 이동 중 → skip
      // ... 기존 bounds 계산 및 onBoundsChange 호출
    }, 600);
  },
  [onBoundsChange, onMapInteraction],
);
```

**1-3. centerOnShop 수정**

```ts
const centerOnShop = useCallback(
  (lat: number, lng: number) => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    isProgrammaticMoveRef.current = true;
    suppressTimerRef.current = setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 1100); // 300ms animation + 600ms debounce + 200ms buffer

    const currentZoom = mapRef.current?.getCameraPosition?.()?.zoom ?? 14;
    mapRef.current?.animateCameraTo({
      latitude: lat - mapLatOffset,
      longitude: lng,
      zoom: Math.max(14, currentZoom), // 현재 zoom이 14 이상이면 유지, 미만이면 14
      duration: 300,
    });
  },
  [mapLatOffset],
);
```

> `getCameraPosition`이 SDK에서 지원되지 않으면 fallback으로 `zoom: 14` 사용.

**1-4. onUserLocation 콜백 prop 추가**

```ts
interface NaverMapProps {
  // ... 기존 props
  onUserLocation?: (loc: { lat: number; lng: number }) => void;
}
```

- 위치 취득 시(`getCurrentPositionAsync` 완료) `onUserLocation?.({ lat, lng })` 호출

**1-5. cleanup**

```ts
useEffect(() => {
  return () => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
  };
}, []);
```

---

### Step 2: `apps/mobile/store/slices/shops.slice.ts`

**State 확장**

```ts
interface ShopsState {
  shops: ShopSummary[];
  total: number;
  offset: number;
  hasMore: boolean;
  boundsCache: BoundsCacheEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  currentBounds: Bounds | null;
  currentSort: SortOption | undefined;
}

interface BoundsCacheEntry {
  bounds: Bounds;
  sort: SortOption | undefined; // sort 포함
  shops: ShopSummary[];
  timestamp: number;
}
```

**fetchShopsByBoundsAsync 수정**

- 파라미터: `(viewportBounds: Bounds, sort?: SortOption, userLocation?: {lat, lng} | null)`
- 내부에서 20% padding 적용 후 API 호출:
  ```ts
  const latPad = (viewportBounds.neLat - viewportBounds.swLat) * 0.2;
  const lngPad = (viewportBounds.neLng - viewportBounds.swLng) * 0.2;
  const fetchBounds = {
    swLat: viewportBounds.swLat - latPad,
    swLng: viewportBounds.swLng - lngPad,
    neLat: viewportBounds.neLat + latPad,
    neLng: viewportBounds.neLng + lngPad,
  };
  ```
- cache 조회 시 `bounds` + `sort` 모두 비교
- 성공 시: `state.shops = result.shops`, `total`, `offset: 0`, `hasMore = result.total > 20`, `currentBounds = viewportBounds`, `currentSort = sort`

**loadMoreShopsByBoundsAsync 추가**

```ts
export const loadMoreShopsByBoundsAsync =
  () => async (dispatch: AppDispatch, getState: AppGetState) => {
    const { shops: state } = getState();
    if (!state.hasMore || state.loadingMore || !state.currentBounds) return;

    const boundsSnapshot = state.currentBounds;
    const sortSnapshot = state.currentSort;
    dispatch(shopsSlice.actions.setLoadingMore(true));
    const nextOffset = state.offset + 20;

    try {
      const latPad = (boundsSnapshot.neLat - boundsSnapshot.swLat) * 0.2;
      const lngPad = (boundsSnapshot.neLng - boundsSnapshot.swLng) * 0.2;
      const fetchBounds = {
        /* padded */
      };
      const result = await fetchShops(API_BASE, {
        bounds: fetchBounds,
        limit: 20,
        offset: nextOffset,
        sort: sortSnapshot,
        ...(sortSnapshot === "distance" &&
          state.userLocation && {
            userLat: state.userLocation.lat,
            userLng: state.userLocation.lng,
          }),
      });

      // stale 체크
      const currentState = getState().shops;
      if (currentState.currentBounds !== boundsSnapshot) return;

      dispatch(
        shopsSlice.actions.fetchMoreSuccess({
          shops: result.shops,
          offset: nextOffset,
          total: result.total,
        }),
      );
    } catch {
      dispatch(shopsSlice.actions.setLoadingMore(false));
    }
  };
```

---

### Step 3: `apps/mobile/app/(tabs)/index.tsx`

**SortType → SortOption 매핑**

```ts
function toApiSort(sortType: SortType): SortOption | undefined {
  switch (sortType) {
    case "name":
      return "name";
    case "distance":
      return "distance";
    case "wish":
      return "wishlist_count";
    default:
      return undefined; // "latest" → API 기본 정렬
  }
}
```

**userLocation state 추가**

```ts
const [userLocation, setUserLocation] = useState<{
  lat: number;
  lng: number;
} | null>(null);
```

- `<NaverMap onUserLocation={setUserLocation} ... />` 로 연결

**handleBoundsChange 수정** (padding 제거 — slice 내부에서 처리)

```ts
const handleBoundsChange = useCallback(
  (bounds: Bounds) => {
    dispatch(
      fetchShopsByBoundsAsync(bounds, toApiSort(sortType), userLocation),
    );
  },
  [dispatch, sortType, userLocation],
);
```

**sortType 변경 시 재요청 effect 추가**

```ts
const currentBounds = useAppSelector((s) => s.shops.currentBounds);
useEffect(() => {
  if (currentBounds) {
    dispatch(
      fetchShopsByBoundsAsync(currentBounds, toApiSort(sortType), userLocation),
    );
  }
}, [sortType]); // eslint-disable-line react-hooks/exhaustive-deps
```

**클라이언트 정렬 수정**

- API가 담당하는 `name`, `distance`, `wishlist_count`에 대해 클라이언트 sort 제거
- `"latest"` 에 대한 클라이언트 sort도 제거 (API 기본 정렬 사용)
- `sortedShops = shops` (정렬 없이 API 반환 순서 그대로)

**더불러오기 FAB**

```tsx
const hasMore = useAppSelector((s) => s.shops.hasMore);
const isLoadingMore = useAppSelector((s) => s.shops.loadingMore);

{
  hasMore && !isSearchMode && !isLoadingShops && (
    <TouchableOpacity
      style={{
        position: "absolute",
        top: insets.top + 64,
        alignSelf: "center",
        backgroundColor: "#fff",
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: "#e5e5e5",
      }}
      onPress={() => dispatch(loadMoreShopsByBoundsAsync())}
    >
      {isLoadingMore ? (
        <ActivityIndicator size="small" color="#e94b8c" />
      ) : (
        <Text style={{ fontSize: 13, color: "#1a1a1a", fontWeight: "500" }}>
          샵 더 불러오기
        </Text>
      )}
    </TouchableOpacity>
  );
}
```

---

### 완료 조건

1. 마커 클릭 → bounds 재로딩 억제 (선택된 샵이 목록에 유지)
2. 사용자 드래그 중 isProgrammaticMoveRef가 즉시 해제 → 정상 재로딩
3. 줌아웃 상태에서 마커 클릭 → 현재 zoom 유지 (14 미만이면 14로)
4. "샵 더 불러오기" FAB 표시 및 append 동작 확인
5. 정렬 변경 → API 재요청 확인
6. bounds 변경 중 loadMore 완료 → stale 결과 discard 확인
7. TypeScript 오류 없음
