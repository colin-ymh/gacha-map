import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurViewCompat as BlurView } from "@/components/ui/BlurViewCompat";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  BLACK,
  GRAY_100,
  GRAY_200,
  GRAY_400,
  THUMBNAIL_PLACEHOLDER,
  GLASS_BORDER,
} from "@/constants/colors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchByBounds,
  fetchBySearch,
  exitSearch,
  loadMore,
  refetchCurrentMode,
  setUserLocation,
  setSort,
  setLocationPermission,
  setSelectedShop as setSelectedShopRedux,
} from "@/store/slices/shops.slice";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { setBounded } from "@/lib/bounded-cache";
import type {
  Bounds,
  ShopSummary,
  SortOption,
  GachaProductWithShops,
} from "@gacha-map/shared";
import {
  formatOpeningHoursDisplay,
  getTodayHoursText,
  formatPhoneForDisplay,
  getPhoneTelUri,
} from "@gacha-map/shared";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import NaverMap, {
  type NaverMapHandle,
} from "@/components/organisms/map/naver-map";
// [LIST_BOTTOMSHEET_DISABLED] ShopBottomSheetView — 재활성화 시 주석 해제
// import ShopBottomSheetView from "@/components/organisms/map/shop-bottom-sheet.view";
import type { SortType } from "@/components/organisms/map/shop-bottom-sheet.view";
import LoginModal from "@/components/ui/LoginModal";
import { useRecentHistory } from "@/hooks/useRecentHistory";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import SearchOverlay from "@/components/organisms/search/SearchOverlay";
import SearchBar from "@/components/molecules/SearchBar";


function toApiSort(sort: SortType): SortOption | null {
  switch (sort) {
    case "recommended":
      return "recommended";
    case "name":
      return "name";
    case "distance":
      return "distance";
    case "wish":
      return "wishlist_count";
    default:
      return null;
  }
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const VISIBLE_HEADER_HEIGHT = 120;
const SHEET_RATIO = 0.55;

type TabType = "shop" | "gacha";

export default function MapScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { focusLat, focusLng, focusTs } = useLocalSearchParams<{
    focusLat?: string;
    focusLng?: string;
    focusTs?: string;
  }>();
  const lastFocusTsRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const mapRef = useRef<NaverMapHandle>(null);

  // Redux state
  const mode = useAppSelector((s) => s.shops.mode);
  const displayShops = useAppSelector((s) =>
    s.shops.mode === "search" ? s.shops.searchShops : s.shops.mapShops,
  );
  const searchShops = useAppSelector((s) => s.shops.searchShops);
  const status = useAppSelector((s) => s.shops.status);
  const loadingMore = useAppSelector((s) => s.shops.loadingMore);
  const hasMore = useAppSelector((s) =>
    s.shops.mode === "map" ? s.shops.mapHasMore : s.shops.searchHasMore,
  );
  const reduxUserLocation = useAppSelector((s) => s.shops.userLocation);
  const sort = useAppSelector((s) => s.shops.sort);
  const locationPermission = useAppSelector((s) => s.shops.locationPermission);
  const { t } = useTranslation();
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const wishedProductIds = useAppSelector((s) => s.productWishlist.productIds);
  const shopError = useAppSelector((s) => s.shops.error);

  // Local state
  const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null);
  const [displayedShop, setDisplayedShop] = useState<ShopSummary | null>(null);
  const miniCardAnim = useRef(new Animated.Value(300)).current;
  const miniCardDrag = useRef(new Animated.Value(0)).current;
  const miniCardTranslateY = useRef(Animated.add(miniCardAnim, miniCardDrag)).current;
  const fabMiniCardOffset = useRef(new Animated.Value(0)).current;
  const miniCardHeightRef = useRef(0);
  const displayedShopRef = useRef<ShopSummary | null>(null);
  const fabGlass = useLiquidGlassPress();
  const miniCardCloseGlass = useLiquidGlassPress();
  const miniCardActionGlass = useLiquidGlassPress();
  const loadMoreGlass = useLiquidGlassPress();
  const [sortType, setSortType] = useState<SortType>("recommended");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [inputText, setInputText] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search overlay state
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("shop");
  const [gachaResults, setGachaResults] = useState<GachaProductWithShops[]>([]);
  const [gachaLoading, setGachaLoading] = useState(false);
  const gachaCache = useRef<Map<string, GachaProductWithShops[]>>(new Map());
  const gachaAbort = useRef<AbortController | null>(null);

  // History hook
  const {
    items: recentItems,
    addQuery,
    remove: removeRecent,
    clearAll: clearRecent,
  } = useRecentHistory();

  // Sheet animation
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

  const fabTranslateY = useRef(
    translateY.interpolate({
      inputRange: [0, snapCollapsed],
      outputRange: [-snapCollapsed, 0],
    }),
  ).current;

  const fabCombinedY = useRef(Animated.add(fabTranslateY, fabMiniCardOffset)).current;

  const fabOpacity = useRef(
    translateY.interpolate({
      inputRange: [0, snapCollapsed * 0.5, snapCollapsed],
      outputRange: [0, 0, 1],
    }),
  ).current;

  useEffect(() => {
    if (mode === "search") {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }
  }, [mode, translateY]);

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

  // Event handlers
  const handleAutoLoad = useCallback(
    (bounds: Bounds) => {
      // 검색 오버레이가 열려 있거나, 검색 결과를 지도에서 보는 중에는
      // bounds 재로드를 막아 검색 결과 핀이 사라지지 않도록 한다.
      if (searchOpen || mode === "search") return;
      dispatch(fetchByBounds(bounds));
    },
    [dispatch, searchOpen, mode],
  );

  const handleUserLocation = useCallback(
    (loc: { lat: number; lng: number }) => {
      dispatch(setUserLocation(loc));
    },
    [dispatch],
  );

  const handleLocationPermission = useCallback(
    (permission: "granted" | "denied") => {
      dispatch(setLocationPermission(permission));
    },
    [dispatch],
  );

  const handleSortChange = useCallback(
    async (newSortType: SortType) => {
      if (newSortType === "distance") {
        if (locationPermission === "denied") {
          Alert.alert(
            t("map.locationPermissionTitle"),
            t("map.locationPermissionDesc"),
          );
          return;
        }
        if (locationPermission === "unknown") {
          const result = await mapRef.current?.goToMyLocation();
          if (result !== "granted") return;
        }
      }
      setSortType(newSortType);
      const apiSort = toApiSort(newSortType);
      dispatch(setSort(apiSort));
      dispatch(refetchCurrentMode());
    },
    [dispatch, locationPermission],
  );

  const handleShopPress = useCallback(
    (shop: ShopSummary) => {
      if (selectedShop?.id === shop.id) {
        router.push(`/shop/${shop.id}` as never);
      } else {
        setSelectedShop(shop);
        dispatch(setSelectedShopRedux(shop.id));
        mapRef.current?.centerOnShop(shop.lat, shop.lng);
        collapseSheet();
      }
    },
    [router, selectedShop, collapseSheet],
  );

  const handleMapInteraction = useCallback(() => {
    collapseSheet();
    setSelectedShop(null);
    dispatch(setSelectedShopRedux(null));
  }, [collapseSheet, dispatch]);

  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const handleWishToggle = useCallback(
    (shopId: string) => {
      wishDebounce(shopId, () => setShowLoginModal(true));
    },
    [wishDebounce],
  );

  const { handleProductWishToggle: productWishDebounce } =
    useProductWishDebounce();
  const handleProductWishToggle = useCallback(
    (productId: string) => {
      productWishDebounce(productId, () => setShowLoginModal(true));
    },
    [productWishDebounce],
  );

  const handleMyLocation = useCallback(() => {
    if (locationPermission === "denied") {
      Alert.alert(
        t("common.locationPermissionTitle"),
        t("common.locationPermissionDesc"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.goToSettings"), onPress: () => Linking.openSettings() },
        ],
      );
    } else {
      mapRef.current?.goToMyLocation();
    }
  }, [locationPermission, t]);

  const searchGacha = useCallback(async (q: string) => {
    const key = q.trim().toLowerCase();
    if (gachaCache.current.has(key)) {
      setGachaResults(gachaCache.current.get(key)!);
      setGachaLoading(false);
      return;
    }
    gachaAbort.current?.abort();
    gachaAbort.current = new AbortController();
    setGachaLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/gacha-products?q=${encodeURIComponent(q.trim())}&include_shops=true&limit=20`,
        { signal: gachaAbort.current.signal },
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const products: GachaProductWithShops[] = data.products ?? [];
      setBounded(gachaCache.current, key, products, 30);
      setGachaResults(products);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setGachaResults([]);
    } finally {
      setGachaLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

      if (!text.trim()) {
        dispatch(exitSearch());
        setGachaResults([]);
        return;
      }

      searchDebounceRef.current = setTimeout(() => {
        dispatch(fetchBySearch(text));
      }, 300);
    },
    [dispatch],
  );

  const handleSearchClose = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    gachaAbort.current?.abort();
    setInputText("");
    setActiveTab("shop");
    setGachaResults([]);
    setSearchOpen(false);
    dispatch(exitSearch());
  }, [dispatch]);

  const handleSearchTextClear = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    gachaAbort.current?.abort();
    setInputText("");
    setGachaResults([]);
    dispatch(exitSearch());
  }, [dispatch]);

  const handleViewOnMap = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    gachaAbort.current?.abort();
    setGachaResults([]);
    setSelectedShop(null);
    dispatch(setSelectedShopRedux(null));
    setSearchOpen(false);
    if (searchShops.length > 0) {
      setTimeout(() => {
        mapRef.current?.fitToShops(searchShops);
      }, 50);
    }
  }, [searchShops]);

  const handleLoadMore = useCallback(() => {
    dispatch(loadMore());
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedShop) {
      setDisplayedShop(selectedShop);
      miniCardAnim.setValue(300);
      Animated.spring(miniCardAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    } else {
      Animated.timing(miniCardAnim, {
        toValue: 300,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setDisplayedShop(null);
      });
      Animated.spring(fabMiniCardOffset, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    }
  }, [selectedShop, miniCardAnim, fabMiniCardOffset]);

  useEffect(() => { displayedShopRef.current = displayedShop; }, [displayedShop]);

  const miniCardPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) miniCardDrag.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 0.5) {
          const startY = dy > 0 ? dy : 0;
          miniCardDrag.setValue(0);
          miniCardAnim.setValue(startY);
          setSelectedShop(null);
          dispatch(setSelectedShopRedux(null));
        } else {
          Animated.spring(miniCardDrag, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (activeTab !== "gacha") return;
    const trimmed = inputText.trim();
    if (!trimmed) {
      setGachaResults([]);
      return;
    }
    const timer = setTimeout(() => searchGacha(trimmed), 300);
    return () => clearTimeout(timer);
  }, [inputText, activeTab, searchGacha]);

  useEffect(() => {
    return () => {
      gachaAbort.current?.abort();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (
        focusTs &&
        focusLat &&
        focusLng &&
        focusTs !== lastFocusTsRef.current
      ) {
        lastFocusTsRef.current = focusTs;
        const lat = parseFloat(focusLat);
        const lng = parseFloat(focusLng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        setSearchOpen(false);
        if (mode === "search") {
          dispatch(exitSearch());
        }

        setTimeout(() => {
          if (!mapRef.current) return;
          mapRef.current.centerOnShop(lat, lng);
          // centerOnShop이 isProgrammaticMoveRef를 1100ms 억제해
          // onCameraIdle이 차단되므로 억제 해제 후 수동으로 bounds 재fetch
          setTimeout(() => {
            const bounds = mapRef.current?.getCurrentBounds();
            if (bounds) dispatch(fetchByBounds(bounds));
          }, 1200);
        }, 100);
      }
    }, [focusTs, focusLat, focusLng, mode, dispatch]),
  );


  const isLoadingMap = status === "loading" && mode === "map";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <NaverMap
        ref={mapRef}
        shops={displayShops}
        selectedShopId={selectedShop?.id}
        wishedShopIds={wishedShopIds}
        onShopPress={handleShopPress}
        onMapInteraction={handleMapInteraction}
        onCameraIdle={handleAutoLoad}
        onUserLocation={handleUserLocation}
        onLocationPermission={handleLocationPermission}
      />

      {/* 플로팅 검색창 — 검색 오버레이 표시 중에는 숨김 */}
      {!searchOpen && (
        <SearchBar
          glass
          placeholder={t("map.searchPlaceholder")}
          onPress={() => setSearchOpen(true)}
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            top: insets.top + 12,
          }}
        />
      )}

      {/* 로딩 인디케이터 / 더 보기 버튼 */}
      {mode !== "search" && (isLoadingMap || loadingMore || hasMore) && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 64,
            alignSelf: "center",
          }}
        >
          {isLoadingMap || loadingMore ? (
            <View style={{ borderRadius: 20, shadowColor: BLACK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 8 }}>
              <View style={{ borderRadius: 20, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_BORDER }}>
                <BlurView intensity={55} tint="systemMaterialLight">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.06)" }}>
                    <ActivityIndicator size="small" color={TEXT_GRAY} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: TEXT_GRAY }}>{t("map.searching")}</Text>
                  </View>
                </BlurView>
              </View>
            </View>
          ) : (
            <Animated.View style={[{ borderRadius: 20, shadowColor: BLACK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 8 }, loadMoreGlass.animatedStyle]}>
              <View style={{ borderRadius: 20, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_BORDER }}>
                <BlurView intensity={55} tint="systemMaterialLight">
                  <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "white", borderRadius: 20 }, loadMoreGlass.brightnessStyle]} pointerEvents="none" />
                  <TouchableOpacity
                    onPress={handleLoadMore}
                    onPressIn={loadMoreGlass.onPressIn}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.06)" }}
                  >
                    <Ionicons name="add" size={22} color={PRIMARY} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>{t("map.loadMore")}</Text>
                  </TouchableOpacity>
                </BlurView>
              </View>
            </Animated.View>
          )}
        </View>
      )}

      {/* FAB */}
      <Animated.View
        style={{
          position: "absolute",
          right: 14,
          bottom: insets.bottom + 74,
          gap: 12,
          transform: [{ translateY: fabCombinedY }],
          opacity: fabOpacity,
        }}
      >
        <Animated.View
          style={[{
            borderRadius: 28,
            shadowColor: BLACK,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.14,
            shadowRadius: 16,
            elevation: 8,
          }, fabGlass.animatedStyle]}
        >
          <View style={{ borderRadius: 28, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_BORDER }}>
            <BlurView intensity={40} tint="systemUltraThinMaterialLight">
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "white", borderRadius: 28 }, fabGlass.brightnessStyle]} pointerEvents="none" />
              <TouchableOpacity
                style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
                onPress={() => router.push("/report" as never)}
                onPressIn={fabGlass.onPressIn}
                accessibilityLabel={t("map.reportFab")}
              >
                <Ionicons name="megaphone" size={24} color={PRIMARY} />
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: GRAY_200 }} />
              <TouchableOpacity
                style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
                onPress={handleMyLocation}
                onPressIn={fabGlass.onPressIn}
                accessibilityLabel={t("map.myLocation")}
              >
                <Ionicons name="locate" size={24} color={BLACK} />
              </TouchableOpacity>
            </BlurView>
          </View>
        </Animated.View>
      </Animated.View>

      {/* [LIST_BOTTOMSHEET_DISABLED] 목록 바텀시트 — 재활성화 시 주석 해제
      <ShopBottomSheetView
        shops={displayShops}
        sortType={sortType}
        wishedShopIds={wishedShopIds}
        onSortChange={handleSortChange}
        onShopPress={handleShopPress}
        onWishToggle={handleWishToggle}
        sheetHeight={sheetHeight}
        translateY={translateY}
        panHandlers={panResponder.panHandlers}
        isSearchMode={mode === "search"}
        isSearchLoading={status === "loading" && mode === "search"}
        onLoadMore={handleLoadMore}
        isLoadingMore={loadingMore}
        hasMore={hasMore}
        error={shopError}
        onRetry={() => dispatch(refetchCurrentMode())}
      />
      */}

      {/* 검색 결과 오버레이 */}
      <SearchOverlay
        visible={searchOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        inputText={inputText}
        onSearchChange={handleSearchChange}
        onSearchClear={handleSearchTextClear}
        onSubmit={addQuery}
        onClose={handleSearchClose}
        shopSearchStatus={status}
        searchShops={searchShops}
        wishedShopIds={wishedShopIds}
        onShopPress={(shopId) => router.push(`/shop/${shopId}` as never)}
        onShopWishToggle={handleWishToggle}
        onViewOnMap={handleViewOnMap}
        gachaLoading={gachaLoading}
        gachaResults={gachaResults}
        wishedProductIds={wishedProductIds}
        onGachaPress={(gachaId) => router.push(`/gacha/${gachaId}` as never)}
        onGachaWishToggle={handleProductWishToggle}
        recentItems={recentItems}
        onRecentQueryPress={(q) => {
          setInputText(q);
          dispatch(fetchBySearch(q));
        }}
        onRemoveRecent={removeRecent}
        onClearRecent={clearRecent}
      />

      {/* 미니 상세 카드 */}
      {displayedShop && (
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            elevation: 20,
            shadowColor: BLACK,
            shadowOpacity: 0.14,
            shadowRadius: 16,
            transform: [{ translateY: miniCardTranslateY }],
          }}
          {...miniCardPanResponder.panHandlers}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            miniCardHeightRef.current = h;
            if (selectedShop) {
              const moveUp = -(h - insets.bottom - 54);
              Animated.spring(fabMiniCardOffset, {
                toValue: moveUp,
                useNativeDriver: true,
                bounciness: 4,
                speed: 14,
              }).start();
            }
          }}
        >
          <View
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
              borderTopWidth: StyleSheet.hairlineWidth,
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderRightWidth: StyleSheet.hairlineWidth,
              borderColor: GLASS_BORDER,
            }}
          >
            <BlurView intensity={40} tint="systemUltraThinMaterialLight">
              {/* 닫기 버튼 — Liquid Glass, 우측 상단 고정 */}
              <Animated.View
                style={[{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  zIndex: 1,
                  borderRadius: 18,
                  shadowColor: BLACK,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.10,
                  shadowRadius: 8,
                  elevation: 4,
                }, miniCardCloseGlass.animatedStyle]}
              >
                <View style={{ borderRadius: 18, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_BORDER }}>
                  <BlurView intensity={40} tint="systemUltraThinMaterialLight">
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "white", borderRadius: 18 }, miniCardCloseGlass.brightnessStyle]} pointerEvents="none" />
                    <TouchableOpacity
                      style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
                      onPress={() => { setSelectedShop(null); dispatch(setSelectedShopRedux(null)); }}
                      onPressIn={miniCardCloseGlass.onPressIn}
                    >
                      <Ionicons name="close" size={20} color={TEXT_DARK} />
                    </TouchableOpacity>
                  </BlurView>
                </View>
              </Animated.View>

              {/* 드래그 핸들 */}
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)" }} />
              </View>

              {/* 샵 이름 */}
              <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, paddingRight: 60 }}>
                <Text numberOfLines={1} style={{ fontSize: 22, fontWeight: "700", color: TEXT_DARK }}>
                  {displayedShop.name}
                </Text>
              </View>

              {/* 주소 */}
              {displayedShop.address && (
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 7, gap: 10 }}>
                  <Ionicons name="location-outline" size={18} color={TEXT_GRAY} />
                  <Text numberOfLines={1} style={{ fontSize: 15, color: TEXT_GRAY, flex: 1 }}>
                    {displayedShop.address}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setStringAsync(displayedShop.address!);
                      Alert.alert(t("shop.copiedTitle"), t("shop.copiedMessage"));
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="copy-outline" size={18} color={TEXT_GRAY} />
                  </TouchableOpacity>
                </View>
              )}

              {/* 전화번호 */}
              {displayedShop.phone && (
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 7, gap: 10 }}>
                  <Ionicons name="call-outline" size={18} color={TEXT_GRAY} />
                  <Text style={{ fontSize: 15, color: TEXT_GRAY, flex: 1 }}>
                    {formatPhoneForDisplay(displayedShop.phone)}
                  </Text>
                  {getPhoneTelUri(displayedShop.phone) && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(getPhoneTelUri(displayedShop.phone)!)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="call" size={18} color={TEXT_GRAY} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setStringAsync(displayedShop.phone!);
                      Alert.alert(t("shop.copiedTitle"), t("shop.phoneCopiedMessage"));
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="copy-outline" size={18} color={TEXT_GRAY} />
                  </TouchableOpacity>
                </View>
              )}

              {/* 운영시간 */}
              {(() => {
                const todayHours = getTodayHoursText(displayedShop.opening_hours);
                const hours = todayHours || formatOpeningHoursDisplay(displayedShop.opening_hours);
                if (!hours) return null;
                return (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 7, gap: 10 }}>
                    <Ionicons name="time-outline" size={18} color={TEXT_GRAY} style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 15, color: TEXT_GRAY, flex: 1 }}>{hours}</Text>
                  </View>
                );
              })()}

              {/* 하단 버튼: 상세 보기 + 찜 — Liquid Glass 묶음 */}
              <Animated.View
                style={[{
                  alignSelf: "center",
                  marginTop: 16,
                  marginBottom: insets.bottom + 6,
                  borderRadius: 28,
                  shadowColor: BLACK,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  elevation: 6,
                }, miniCardActionGlass.animatedStyle]}
              >
                <View style={{ borderRadius: 28, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_BORDER }}>
                  <BlurView intensity={40} tint="systemUltraThinMaterialLight">
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "white", borderRadius: 28 }, miniCardActionGlass.brightnessStyle]} pointerEvents="none" />
                    <View style={{ flexDirection: "row" }}>
                      <TouchableOpacity
                        style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
                        onPressIn={miniCardActionGlass.onPressIn}
                        onPress={() => router.push(`/shop/${displayedShop.id}` as never)}
                      >
                        <Ionicons name="storefront" size={22} color={BLACK} />
                      </TouchableOpacity>
                      <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: GLASS_BORDER }} />
                      <TouchableOpacity
                        style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
                        onPressIn={miniCardActionGlass.onPressIn}
                        onPress={() => handleWishToggle(displayedShop.id)}
                      >
                        <Ionicons
                          name={wishedShopIds.includes(displayedShop.id) ? "heart" : "heart-outline"}
                          size={22}
                          color={wishedShopIds.includes(displayedShop.id) ? PRIMARY : TEXT_GRAY}
                        />
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                </View>
              </Animated.View>
            </BlurView>
          </View>
        </Animated.View>
      )}

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
