# 상품 찜 UI 명세서 (Penpot 대체)

> Penpot 미연결 상태. 기존 코드 패턴 기반 텍스트 명세로 대체.

## 변경 대상 파일

| 파일                                                                                | 변경 유형                            |
| ----------------------------------------------------------------------------------- | ------------------------------------ |
| `apps/mobile/app/(tabs)/search.tsx`                                                 | 상품 찜 탭 추가                      |
| `apps/mobile/app/(tabs)/search.view.tsx`                                            | 세그먼트 탭 + 상품 카드 추가         |
| `apps/mobile/app/gacha/[id].tsx`                                                    | 하트 버튼 추가                       |
| `apps/mobile/app/notification-settings.tsx`                                         | `product_wishlist_restock` 토글 추가 |
| `apps/mobile/messages/ko.json` (+ en/ja/zh)                                         | 신규 i18n 키                         |
| `apps/web/src/app/[locale]/wishlist/page.tsx`                                       | 세그먼트 탭 Client wrapper           |
| `apps/web/src/components/organisms/product-wishlist/product-wishlist-list.tsx`      | 신규 컨테이너                        |
| `apps/web/src/components/organisms/product-wishlist/product-wishlist-list.view.tsx` | 신규 뷰                              |
| `apps/web/src/components/atoms/gacha-wish-button.tsx`                               | 신규 클라이언트 컴포넌트             |
| `apps/web/src/app/[locale]/gacha/[id]/page.tsx`                                     | 하트 버튼 삽입                       |
| `apps/web/messages/ko.json` (+ en/ja/zh)                                            | 신규 i18n 키                         |

---

## 1. 모바일 — 찜 탭 세그먼트 (`search.tsx` / `search.view.tsx`)

### 레이아웃

```
┌─────────────────────────────────────┐
│          내 찜 목록            (title) │
├──────────────┬──────────────────────┤
│    샵   ●    │       상품            │  ← 세그먼트 탭
├─────────────────────────────────────┤
│  [기존 샵 찜 목록 / 상품 찜 목록]   │
└─────────────────────────────────────┘
```

### 세그먼트 탭 스타일

- 헤더 아래 height 44 영역
- 탭 2개: "샵" / "상품"
- 선택된 탭: 하단 2px 라인 `PRIMARY` + 텍스트 `PRIMARY` fontWeight "700"
- 미선택 탭: 텍스트 `TEXT_GRAY`
- 배경: `WHITE`, 하단 border 1px `GRAY_200`

### search.tsx 변경

- `productWishlist` Redux 상태 추가 (fetch + ids + products)
- `fetchProductWishlistAsync` dispatch (isLoggedIn 시)
- `activeTab: 'shop' | 'product'` state 추가
- SearchView에 props 전달: `activeTab`, `onTabChange`, `products`, `wishedProductIds`, `pendingProductIds`, `onProductPress`, `onProductWishToggle`

### 상품 카드 (`ProductWishCard`)

```
┌─────────────────────────────────────┐
│  [이미지 48x48]  상품명 (1줄 truncate) │
│  (borderRadius 8)  제조사            │
│                   N개 샵에 있어요     │  ← available_shop_count
│                              [♥/♡]  │
└─────────────────────────────────────┘
```

- 탭하면 `router.push("/gacha/${product.id}")`
- 하트 버튼: `optimisticToggleProductWish` + `toggleProductWishAndPersistAsync` 패턴 (wishlist.slice의 `optimisticToggleWish` + `toggleWishAndPersistAsync` 동일)
- 이미지 없으면: 🎰 placeholder (THUMBNAIL_PLACEHOLDER 배경)
- `available_shop_count === 0`: "판매 중인 샵 없음" (TEXT_GRAY)
- `available_shop_count > 0`: "N개 샵에서 판매 중" (PRIMARY)

### 빈 상태 (상품 탭)

- 아이콘: `heart-outline` 48 BORDER
- 텍스트: `t("wishlistView.productEmpty")`

---

## 2. 모바일 — gacha/[id].tsx 하트 버튼

### 위치

헤더 우측에 하트 버튼 추가. 기존 구조:

```tsx
// 변경 전
<TouchableOpacity onPress={() => router.back()}>...</TouchableOpacity>
<Text numberOfLines={1}>displayName</Text>

// 변경 후
<TouchableOpacity onPress={() => router.back()}>...</TouchableOpacity>
<Text numberOfLines={1} style={{ flex: 1 }}>displayName</Text>
<TouchableOpacity onPress={handleWishToggle} hitSlop={8} style={{ padding: 4 }}>
  <Ionicons name={isWished ? "heart" : "heart-outline"} size={22}
    color={isWished ? PRIMARY : TEXT_GRAY} />
</TouchableOpacity>
```

### 동작

- `useAppSelector((s) => s.productWishlist.productIds)` → `isWished = productIds.includes(id)`
- 탭: `dispatch(optimisticToggleProductWish({ productId: id, wasWished: isWished }))` → `dispatch(toggleProductWishAndPersistAsync({ productId: id, isWished }))`
- debounce 불필요 (단일 버튼, 중복 탭만 방지하면 됨 — pending 상태로 충분)
- pending 중 하트 버튼 비활성: `pendingProductIds.includes(id)`일 때 onPress 무시

### 로그인 미로그인

- `isLoggedIn === false`: 탭 시 `router.push("/login")` (기존 wishlist와 동일 패턴)

### `fetchProductWishlistAsync` 호출

- `useFocusEffect` 내부에서 `if (isLoggedIn && !hasFetched) dispatch(fetchProductWishlistAsync())` 추가

---

## 3. 모바일 — notification-settings.tsx

`NotificationPreferences` 타입에 `product_wishlist_restock: boolean` 추가.

`CATEGORIES` 배열에 추가:

```ts
{
  key: "product_wishlist_restock",
  labelKey: "notificationSettings.productWishlistRestock",
  descKey: "notificationSettings.productWishlistRestockDesc",
}
```

기존 `wishlist_product_update` 항목 바로 아래에 삽입.

---

## 4. 웹 — 찜 페이지 세그먼트 탭

### 구조 변경

`wishlist/page.tsx` → Server Component 유지, 하위에 Client wrapper 추가.

```
wishlist/
  page.tsx          → PageShell + <WishlistPageClient />
  wishlist-page-client.tsx  (신규, "use client")
```

`WishlistPageClient`:

- `activeTab: 'shop' | 'product'` state
- 세그먼트 탭 UI (styled-components)
- tab === 'shop': `<WishlistList />` (기존 그대로)
- tab === 'product': `<ProductWishlistList />`

### 세그먼트 탭 스타일 (styled-components, theme 사용)

```
height: 44px
border-bottom: 1px solid gray100
탭 버튼: flex 1, font-size sm, font-weight 700 if active
active: color primary, border-bottom 2px primary
inactive: color gray500
```

---

## 5. 웹 — ProductWishlistList 컴포넌트

위치: `apps/web/src/components/organisms/product-wishlist/`

### product-wishlist-list.tsx (Container)

- `fetchProductWishlistAsync` dispatch (isLoggedIn + !hasFetched)
- `toggleProductWishlistAsync` dispatch (기존 web slice)
- props → `ProductWishlistListView`

### product-wishlist-list.view.tsx (View)

구조: `wishlist-list.view.tsx` 패턴 동일.

```
BackBar + BackButton (기존 동일 스타일)
CountBar: "찜한 상품 N개"
List:
  └ ProductCard per product
```

### ProductCard (view 내부)

```
┌──────────────────────────────────────┐
│  [이미지 64x64]  상품명 (truncate)    │
│  borderRadius 10  제조사              │
│                  N개 샵에서 판매 중   │
│                              [♥]    │
└──────────────────────────────────────┘
padding: 12px 16px, gap 12px, flex-row
하트: Ionicons heart/heart-outline or SVG
이미지 없으면: 🎰 placeholder (THUMBNAIL_PLACEHOLDER 배경)
```

탭하면 `/gacha/{id}` 이동 (router.push).
하트 버튼: `toggleProductWishlistAsync({ productId: p.id, product: p })` dispatch.

---

## 6. 웹 — gacha/[id] 하트 버튼

`gacha/[id]/page.tsx`는 Server Component. 클라이언트 island 추가.

신규 파일: `apps/web/src/components/atoms/gacha-wish-button.tsx` (`"use client"`)

```tsx
// props: productId: string, productName: string
// Redux: selectProductWishlistedSet → isWished = wishSet.has(productId)
// dispatch: toggleProductWishlistAsync
// fetch hasFetched: hasFetched가 false면 fetchProductWishlistAsync dispatch
// 렌더: <button> with Ionicons heart / heart-outline
```

`page.tsx`에서 `<ProductSection>` 우측에 삽입:

```tsx
// ProductInfo 아래 또는 ProductSection 내부 우상단
import GachaWishButton from "@/components/atoms/gacha-wish-button";
// ...
<GachaWishButton productId={id} productName={displayName} />;
```

**주의**: 웹은 `next/navigation` `useRouter` 없이 직접 Redux dispatch만 사용. 비로그인 시 `LoginPopup` 트리거 또는 `/login` 이동 (기존 wishlist 패턴 확인 후 동일 처리).

---

## 7. i18n 신규 키

### Mobile `messages/ko.json`

`wishlistView` 에 추가:

```json
"productEmpty": "아직 찜한 상품이 없어요",
"productWishCount": "찜한 상품 {{count}}개",
"shopTab": "샵",
"productTab": "상품",
"availableShops": "{{count}}개 샵에서 판매 중",
"noAvailableShops": "현재 판매 중인 샵 없음"
```

`notificationSettings`에 추가:

```json
"productWishlistRestock": "찜한 상품 입고 알림",
"productWishlistRestockDesc": "찜한 상품이 새로 입고되면 알려드려요"
```

### Web `messages/ko.json`

`wishlist`에 추가:

```json
"shopTab": "샵",
"productTab": "상품",
"productCount": "찜한 상품 {count}개",
"productEmpty": "아직 찜한 상품이 없어요",
"productEmptyAction": "가챠 상품 탐색하기",
"productAvailableShops": "{count}개 샵에서 판매 중",
"productNoAvailableShops": "판매 중인 샵 없음"
```

---

## 구현 순서

1. **i18n 키 추가** (ko/en/ja/zh, 웹+모바일)
2. **모바일 notification-settings.tsx** — 타입 + CATEGORIES 추가
3. **모바일 gacha/[id].tsx** — 하트 버튼
4. **모바일 search.tsx + search.view.tsx** — 세그먼트 탭 + 상품 카드
5. **웹 GachaWishButton 컴포넌트** — 신규
6. **웹 gacha/[id]/page.tsx** — 버튼 삽입
7. **웹 ProductWishlistList** — 컨테이너 + 뷰
8. **웹 WishlistPageClient** — 신규
9. **웹 wishlist/page.tsx** — 교체

## 리스크

- 웹 `gacha/[id]/page.tsx` Server Component에서 Client island 삽입 시 hydration 주의. Redux store가 클라이언트에만 있으므로 SSR에서 wishlist 상태 없음 → 첫 렌더 heart-outline, hydration 후 상태 반영. 허용 가능.
- 모바일 search.view.tsx에 ProductWishCard 추가 시 파일 길이 증가. 파일 분리 검토 가능하나 기존 패턴 유지 우선.
