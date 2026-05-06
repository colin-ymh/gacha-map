import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
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
import { fetchShopsByBoundsAsync } from "@/store/slices/shops.slice";
import { toggleWishAndPersistAsync } from "@/store/slices/wishlist.slice";
import { fetchShops } from "@gacha-map/shared";
import type { Bounds, ShopSummary } from "@gacha-map/shared";
import NaverMap, {
  type NaverMapHandle,
} from "@/components/organisms/map/naver-map";
import ShopBottomSheetView, {
  type SortType,
} from "@/components/organisms/map/shop-bottom-sheet.view";
import LoginModal from "@/components/ui/LoginModal";

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

  // ── Sorted shops ────────────────────────────────────────────────────────
  const sortedShops = useMemo(() => {
    const list = [...shops];
    switch (sortType) {
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      case "wish":
        return list.sort(
          (a, b) => (b.wishlist_count ?? 0) - (a.wishlist_count ?? 0),
        );
      default:
        return list;
    }
  }, [shops, sortType]);

  const displayShops = isSearchMode ? searchResults : sortedShops;

  // ── Event handlers ──────────────────────────────────────────────────────
  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      dispatch(fetchShopsByBoundsAsync(bounds));
    },
    [dispatch],
  );

  const handleShopPress = useCallback(
    (shop: ShopSummary) => {
      setSelectedShop((prev) => (prev?.id === shop.id ? null : shop));
      router.push(`/shop/${shop.id}` as never);
    },
    [router],
  );

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
