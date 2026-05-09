import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchShopsByBoundsAsync,
  loadMoreShopsByBoundsAsync,
  setUserLocation,
} from "@/store/slices/shops.slice";
import { toggleWishAndPersistAsync } from "@/store/slices/wishlist.slice";
import { fetchShops } from "@gacha-map/shared";
import type { Bounds, ShopSummary, SortOption } from "@gacha-map/shared";
import NaverMap, {
  type NaverMapHandle,
} from "@/components/organisms/map/naver-map";
import ShopBottomSheetView, {
  type SortType,
} from "@/components/organisms/map/shop-bottom-sheet.view";
import LoginModal from "@/components/ui/LoginModal";

function toApiSort(sort: SortType): SortOption | undefined {
  switch (sort) {
    case "name":
      return "name";
    case "distance":
      return "distance";
    case "wish":
      return "wishlist_count";
    default:
      return undefined;
  }
}

const VISIBLE_HEADER_HEIGHT = 120;
const SHEET_RATIO = 0.55;
const SEARCH_LIMIT = 20;
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function MapScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const mapRef = useRef<NaverMapHandle>(null);
  const shops = useAppSelector((s) => s.shops.shops);
  const isLoadingShops = useAppSelector((s) => s.shops.loading);
  const hasMoreShops = useAppSelector((s) => s.shops.hasMore);
  const isLoadingMoreShops = useAppSelector((s) => s.shops.loadingMore);
  const currentBounds = useAppSelector((s) => s.shops.currentBounds);
  const reduxUserLocation = useAppSelector((s) => s.shops.userLocation);
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null);
  const [sortType, setSortType] = useState<SortType>("latest");
  const [showLoginModal, setShowLoginModal] = useState(false);

  // ── Search state ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ShopSummary[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchMode = searchQuery.trim().length > 0;

  // ── Bottom sheet animation ──────────────────────────────────────────────
  const sheetHeight = Math.round(screenHeight * SHEET_RATIO);
  const snapCollapsed = sheetHeight - VISIBLE_HEADER_HEIGHT;

  // zoom 14, Seoul lat 기준: 마커를 바텀시트 위 가시 영역 중앙에 배치하기 위한 카메라 오프셋
  const DEG_PER_PX = 0.0000683;
  const mapLatOffset =
    (screenHeight / 2 - (screenHeight - sheetHeight) / 2) * DEG_PER_PX;

  const translateY = useRef(new Animated.Value(snapCollapsed)).current;
  const currentTranslateYRef = useRef(snapCollapsed);
  const panStartYRef = useRef(snapCollapsed);
  const snapCollapsedRef = useRef(snapCollapsed);
  snapCollapsedRef.current = snapCollapsed;

  useEffect(() => {
    const id = translateY.addListener(({ value }) => {
      currentTranslateYRef.current = value;
    });
    return () => translateY.removeListener(id);
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,
      onPanResponderGrant: () => {
        panStartYRef.current = currentTranslateYRef.current;
      },
      onPanResponderMove: (_, { dy }) => {
        const sc = snapCollapsedRef.current;
        const newY = Math.max(0, Math.min(sc, panStartYRef.current + dy));
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, { vy }) => {
        const sc = snapCollapsedRef.current;
        const curr = currentTranslateYRef.current;
        const toValue = vy > 0.3 || curr > sc / 2 ? sc : 0;
        Animated.spring(translateY, {
          toValue,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    }),
  ).current;

  // FAB: 시트가 올라올수록 함께 올라가고 fade out
  const fabTranslateY = useRef(
    translateY.interpolate({
      inputRange: [0, snapCollapsed],
      outputRange: [-snapCollapsed, 0],
    }),
  ).current;

  const fabOpacity = useRef(
    translateY.interpolate({
      inputRange: [0, snapCollapsed * 0.5, snapCollapsed],
      outputRange: [0, 0, 1],
    }),
  ).current;

  // 검색 모드 진입 시 시트 자동 확장
  useEffect(() => {
    if (isSearchMode) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }
  }, [isSearchMode, translateY]);

  // API가 정렬된 결과를 반환하므로 클라이언트 정렬 불필요
  const displayShops = isSearchMode ? searchResults : shops;

  // ── Sheet open/close helpers ────────────────────────────────────────────
  const collapsingRef = useRef(false);

  const isSheetOpen = () =>
    currentTranslateYRef.current < snapCollapsedRef.current - 20;

  const expandSheet = useCallback(() => {
    collapsingRef.current = false;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [translateY]);

  const collapseSheet = useCallback(() => {
    if (collapsingRef.current) return;
    if (currentTranslateYRef.current >= snapCollapsedRef.current - 5) return;
    collapsingRef.current = true;
    Animated.timing(translateY, {
      toValue: snapCollapsedRef.current,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      collapsingRef.current = false;
    });
  }, [translateY]);

  // ── Event handlers ──────────────────────────────────────────────────────
  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      dispatch(
        fetchShopsByBoundsAsync(bounds, toApiSort(sortType), reduxUserLocation),
      );
    },
    [dispatch, sortType, reduxUserLocation],
  );

  const handleUserLocation = useCallback(
    (loc: { lat: number; lng: number }) => {
      dispatch(setUserLocation(loc));
    },
    [dispatch],
  );

  // 정렬 변경 시 현재 bounds로 재요청
  useEffect(() => {
    if (!currentBounds) return;
    dispatch(
      fetchShopsByBoundsAsync(
        currentBounds,
        toApiSort(sortType),
        reduxUserLocation,
      ),
    );
    // sortType 변경 시만 실행, 다른 의존성 변화는 무시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortType]);

  const handleShopPress = useCallback(
    (shop: ShopSummary) => {
      if (!isSheetOpen()) {
        setSelectedShop(shop);
        expandSheet();
        mapRef.current?.centerOnShop(shop.lat, shop.lng);
      } else if (selectedShop?.id === shop.id) {
        router.push(`/shop/${shop.id}` as never);
      } else {
        setSelectedShop(shop);
        mapRef.current?.centerOnShop(shop.lat, shop.lng);
      }
    },
    [router, expandSheet, selectedShop],
  );

  const handleMapInteraction = useCallback(() => {
    collapseSheet();
    setSelectedShop(null);
  }, [collapseSheet]);

  const handleWishToggle = useCallback(
    (shopId: string) => {
      if (isLoggedIn === false) {
        setShowLoginModal(true);
        return;
      }
      dispatch(toggleWishAndPersistAsync(shopId));
    },
    [dispatch, isLoggedIn],
  );

  const handleReportPress = useCallback(() => {
    router.push("/report" as never);
  }, [router]);

  const handleMyLocation = useCallback(() => {
    mapRef.current?.goToMyLocation();
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!text.trim()) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchOffset(0);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const result = await fetchShops(API_BASE, {
          q: text.trim(),
          limit: SEARCH_LIMIT,
          offset: 0,
        });
        setSearchResults(result.shops);
        setSearchTotal(result.total);
        setSearchOffset(result.shops.length);
      } finally {
        setIsSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!isSearchMode || isLoadingMore || searchOffset >= searchTotal) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchShops(API_BASE, {
        q: searchQuery.trim(),
        limit: SEARCH_LIMIT,
        offset: searchOffset,
      });
      setSearchResults((prev) => [...prev, ...result.shops]);
      setSearchOffset((prev) => prev + result.shops.length);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isSearchMode, isLoadingMore, searchOffset, searchTotal, searchQuery]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <NaverMap
        ref={mapRef}
        shops={shops}
        selectedShopId={selectedShop?.id}
        wishedShopIds={wishedShopIds}
        onShopPress={handleShopPress}
        onBoundsChange={handleBoundsChange}
        onMapInteraction={handleMapInteraction}
        onUserLocation={handleUserLocation}
        mapLatOffset={mapLatOffset}
      />

      {/* 플로팅 검색창 */}
      <View
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          top: insets.top + 12,
          height: 44,
          backgroundColor: "#fff",
          borderRadius: 22,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          gap: 8,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        <Ionicons name="search" size={18} color="#888888" />
        <TextInput
          style={{
            flex: 1,
            fontSize: 14,
            color: "#1a1a1a",
            paddingVertical: 0,
          }}
          placeholder="가챠샵 검색"
          placeholderTextColor="#888888"
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange("")}>
            <Ionicons name="close-circle" size={18} color="#888888" />
          </TouchableOpacity>
        )}
      </View>

      {/* 지도 데이터 로딩 인디케이터 */}
      {isLoadingShops && !isSearchMode && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 64,
            alignSelf: "center",
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 16,
            paddingVertical: 6,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <ActivityIndicator size="small" color="#e94b8c" />
        </View>
      )}

      {/* 샵 더 불러오기 FAB */}
      {hasMoreShops && !isSearchMode && !isLoadingShops && (
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
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 4,
          }}
          onPress={() => dispatch(loadMoreShopsByBoundsAsync())}
          disabled={isLoadingMoreShops}
        >
          {isLoadingMoreShops ? (
            <ActivityIndicator size="small" color="#e94b8c" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={16} color="#e94b8c" />
              <Text
                style={{ fontSize: 13, fontWeight: "600", color: "#e94b8c" }}
              >
                샵 더 불러오기
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* FAB */}
      <Animated.View
        style={{
          position: "absolute",
          right: 14,
          bottom: VISIBLE_HEADER_HEIGHT + 16,
          gap: 12,
          transform: [{ translateY: fabTranslateY }],
          opacity: fabOpacity,
        }}
      >
        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#e94b8c",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 4,
          }}
          onPress={handleReportPress}
          accessibilityLabel="제보"
        >
          <Ionicons name="megaphone" size={20} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}
          onPress={handleMyLocation}
          accessibilityLabel="내 위치"
        >
          <Ionicons name="locate" size={22} color="#e94b8c" />
        </TouchableOpacity>
      </Animated.View>

      <ShopBottomSheetView
        shops={displayShops}
        sortType={sortType}
        wishedShopIds={wishedShopIds}
        onSortChange={setSortType}
        onShopPress={handleShopPress}
        onWishToggle={handleWishToggle}
        sheetHeight={sheetHeight}
        translateY={translateY}
        panHandlers={panResponder.panHandlers}
        isSearchMode={isSearchMode}
        isSearchLoading={isSearchLoading}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        hasMore={isSearchMode && searchOffset < searchTotal}
      />

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginPress={() => {
          setShowLoginModal(false);
          router.push("/login" as never);
        }}
      />
    </SafeAreaView>
  );
}
