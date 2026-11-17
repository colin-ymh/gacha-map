import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchBySearch, exitSearch } from "@/store/slices/shops.slice";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { useGachaProductSearch } from "@/hooks/useGachaProductSearch";
import { useRecentHistory } from "@/hooks/useRecentHistory";

type TabType = "shop" | "gacha";

const SEARCH_DEBOUNCE_MS = 300;

interface Options {
  /**
   * 검색을 닫을 때 화면별로 더 정리할 것이 있으면 여기서 한다.
   * 지도 탭은 선택된 샵 핀을 함께 해제한다.
   */
  onCloseExtra?: () => void;
  /** 비로그인 상태로 찜을 누르면 호출된다. 로그인 유도 모달을 띄우는 쪽에서 처리한다. */
  onRequireLogin?: () => void;
}

/**
 * 검색 오버레이에 필요한 상태·핸들러를 한곳에 모은다.
 *
 * `SearchOverlay` 는 prop 을 27개 받는데, 홈·지도 탭이 그 배선을 각자 복사해서
 * 갖고 있었다. 둘러보기 탭에도 검색을 붙이려니 세 번째 복사본이 필요해져서
 * 공용 훅으로 뺐다. 복사본이 셋이 되면 셋이 조금씩 갈라진다.
 *
 * 화면마다 다른 부분은 두 가지뿐이라 옵션으로 받는다.
 *   - 닫을 때의 추가 정리 (`onCloseExtra`)
 *   - 로그인 유도 (`onRequireLogin`)
 *
 * `onViewOnMap` 은 화면마다 동작이 달라(홈은 지도 탭으로 이동, 지도는 오버레이만
 * 닫음) 여기서 만들지 않는다. 호출부가 직접 넘긴다.
 */
export function useSearchOverlay(options: Options = {}) {
  const { onCloseExtra, onRequireLogin } = options;
  const dispatch = useAppDispatch();

  const [searchOpen, setSearchOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("shop");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchShops = useAppSelector((s) => s.shops.searchShops);
  const shopSearchStatus = useAppSelector((s) => s.shops.status);
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const wishedProductIds = useAppSelector((s) => s.productWishlist.productIds);

  const {
    results: gachaResults,
    loading: gachaLoading,
    loadingMore: gachaLoadingMore,
    search: searchGacha,
    loadMore: loadMoreGacha,
    clear: clearGachaSearch,
  } = useGachaProductSearch();

  const {
    items: recentItems,
    addQuery,
    remove: removeRecent,
    clearAll: clearRecent,
    reload: reloadRecent,
  } = useRecentHistory();

  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const { handleProductWishToggle: productWishDebounce } =
    useProductWishDebounce();

  const handleWishToggle = useCallback(
    (shopId: string) => {
      wishDebounce(shopId, () => onRequireLogin?.());
    },
    [wishDebounce, onRequireLogin],
  );

  const handleProductWishToggle = useCallback(
    (productId: string) => {
      productWishDebounce(productId, () => onRequireLogin?.());
    },
    [productWishDebounce, onRequireLogin],
  );

  const openSearch = useCallback((tab: TabType = "shop") => {
    setActiveTab(tab);
    setSearchOpen(true);
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        dispatch(exitSearch());
        clearGachaSearch();
        return;
      }
      debounceRef.current = setTimeout(() => {
        dispatch(fetchBySearch(text));
      }, SEARCH_DEBOUNCE_MS);
    },
    [dispatch, clearGachaSearch],
  );

  const handleSearchTextClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputText("");
    clearGachaSearch();
    dispatch(exitSearch());
  }, [dispatch, clearGachaSearch]);

  const handleSearchClose = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInputText("");
    setActiveTab("shop");
    clearGachaSearch();
    setSearchOpen(false);
    dispatch(exitSearch());
    onCloseExtra?.();
  }, [dispatch, clearGachaSearch, onCloseExtra]);

  const handleRecentQueryPress = useCallback(
    (q: string) => {
      setInputText(q);
      dispatch(fetchBySearch(q));
    },
    [dispatch],
  );

  /** 오버레이를 닫지 않고 검색 상태만 정리한다. "지도에서 보기" 처럼 화면을 옮길 때 쓴다. */
  const cancelPendingSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    clearGachaSearch();
  }, [clearGachaSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // 가챠 탭은 입력이 멈춘 뒤 검색한다. 샵 탭은 위 handleSearchChange 가 처리한다.
  useEffect(() => {
    if (activeTab !== "gacha") return;
    const trimmed = inputText.trim();
    if (!trimmed) {
      clearGachaSearch();
      return;
    }
    const timer = setTimeout(() => searchGacha(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputText, activeTab, searchGacha, clearGachaSearch]);

  // 다른 화면에서 검색 기록이 바뀌었을 수 있어 포커스마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      reloadRecent();
    }, [reloadRecent]),
  );

  return {
    // 상태
    searchOpen,
    setSearchOpen,
    activeTab,
    setActiveTab,
    inputText,
    setInputText,
    // 데이터
    searchShops,
    shopSearchStatus,
    wishedShopIds,
    wishedProductIds,
    gachaResults,
    gachaLoading,
    gachaLoadingMore,
    recentItems,
    // 동작
    openSearch,
    handleSearchChange,
    handleSearchTextClear,
    handleSearchClose,
    handleWishToggle,
    handleProductWishToggle,
    handleRecentQueryPress,
    loadMoreGacha,
    addQuery,
    removeRecent,
    clearRecent,
    cancelPendingSearch,
  };
}
