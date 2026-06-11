import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
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
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  WHITE,
  BLACK,
  BORDER,
  GRAY_100,
  GRAY_400,
  THUMBNAIL_PLACEHOLDER,
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
} from "@/store/slices/shops.slice";
import type {
  Bounds,
  ShopSummary,
  SortOption,
  GachaProductWithShops,
} from "@gacha-map/shared";
import {
  parseBusinessHours,
  formatBusinessHoursDisplay,
} from "@gacha-map/shared";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import NaverMap, {
  type NaverMapHandle,
} from "@/components/organisms/map/naver-map";
// [LIST_BOTTOMSHEET_DISABLED] ShopBottomSheetView — 재활성화 시 주석 해제
// import ShopBottomSheetView from "@/components/organisms/map/shop-bottom-sheet.view";
import type { SortType } from "@/components/organisms/map/shop-bottom-sheet.view";
import LoginModal from "@/components/ui/LoginModal";

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
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const shopError = useAppSelector((s) => s.shops.error);

  // Local state
  const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null);
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
      dispatch(fetchByBounds(bounds));
    },
    [dispatch],
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
        mapRef.current?.centerOnShop(shop.lat, shop.lng);
        collapseSheet();
      }
    },
    [router, selectedShop, collapseSheet],
  );

  const handleMapInteraction = useCallback(() => {
    collapseSheet();
    setSelectedShop(null);
  }, [collapseSheet]);

  const { handleWishToggle: wishDebounce } = useWishDebounce();
  const handleWishToggle = useCallback(
    (shopId: string) => {
      wishDebounce(shopId, () => setShowLoginModal(true));
    },
    [wishDebounce],
  );

  const handleMyLocation = useCallback(() => {
    mapRef.current?.goToMyLocation();
  }, []);

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
      gachaCache.current.set(key, products);
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

  const handleLoadMore = useCallback(() => {
    dispatch(loadMore());
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

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

  const { t } = useTranslation();
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
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: insets.top + 12,
            height: 44,
            backgroundColor: WHITE,
            borderRadius: 22,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            gap: 8,
            shadowColor: BLACK,
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <Ionicons name="search" size={18} color={TEXT_GRAY} />
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: TEXT_DARK,
              paddingVertical: 0,
            }}
            placeholder={t("map.searchPlaceholder")}
            placeholderTextColor={TEXT_GRAY}
            value={inputText}
            onChangeText={handleSearchChange}
            onFocus={() => setSearchOpen(true)}
            returnKeyType="search"
          />
          {inputText.length > 0 && (
            <TouchableOpacity onPress={handleSearchClose}>
              <Ionicons name="close-circle" size={18} color={TEXT_GRAY} />
            </TouchableOpacity>
          )}
        </View>
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
            <View
              style={{
                backgroundColor: WHITE,
                borderRadius: 20,
                paddingVertical: 8,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                shadowColor: BLACK,
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <ActivityIndicator size="small" color={PRIMARY} />
              <Text
                style={{ fontSize: 13, fontWeight: "600", color: TEXT_GRAY }}
              >
                {t("map.searching")}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleLoadMore}
              style={{
                backgroundColor: WHITE,
                borderRadius: 20,
                paddingVertical: 8,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                shadowColor: BLACK,
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Ionicons name="add-circle-outline" size={15} color={PRIMARY} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: PRIMARY }}>
                {t("map.loadMore")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* FAB */}
      <Animated.View
        style={{
          position: "absolute",
          right: 14,
          bottom: selectedShop ? 240 : insets.bottom + 16,
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
            backgroundColor: WHITE,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: BLACK,
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}
          onPress={() => router.push("/report" as never)}
          accessibilityLabel={t("map.reportFab")}
        >
          <Ionicons name="megaphone-outline" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: WHITE,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: BLACK,
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}
          onPress={handleMyLocation}
          accessibilityLabel={t("map.myLocation")}
        >
          <Ionicons name="locate" size={22} color={PRIMARY} />
        </TouchableOpacity>
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
      {searchOpen && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: WHITE,
            zIndex: 50,
          }}
        >
          {/* 헤더 */}
          <View
            style={{
              paddingTop: insets.top,
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: 44,
                gap: 8,
              }}
            >
              <TouchableOpacity
                onPress={handleSearchClose}
                style={{ padding: 4 }}
              >
                <Ionicons name="arrow-back" size={24} color={TEXT_DARK} />
              </TouchableOpacity>
              <Text
                style={{
                  flex: 1,
                  fontSize: 17,
                  fontWeight: "700",
                  color: TEXT_DARK,
                }}
              >
                {t("map.searchTitle")}
              </Text>
            </View>
            {/* 검색 입력창 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 8,
                height: 40,
                backgroundColor: GRAY_100,
                borderRadius: 20,
                paddingHorizontal: 14,
                gap: 8,
              }}
            >
              <Ionicons name="search" size={16} color={TEXT_GRAY} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: TEXT_DARK,
                  paddingVertical: 0,
                }}
                placeholder={
                  activeTab === "shop"
                    ? t("map.searchShopPlaceholder")
                    : t("map.searchGachaPlaceholder")
                }
                placeholderTextColor={TEXT_GRAY}
                value={inputText}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                autoFocus
              />
              {inputText.length > 0 && (
                <TouchableOpacity onPress={handleSearchTextClear}>
                  <Ionicons name="close-circle" size={16} color={TEXT_GRAY} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 탭 */}
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
          >
            {(["shop", "gacha"] as TabType[]).map((tab) => {
              const isActive = activeTab === tab;
              const label =
                tab === "shop" ? t("map.tabShop") : t("map.tabGacha");
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 2,
                    borderBottomColor: isActive ? PRIMARY : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isActive ? "700" : "400",
                      color: isActive ? PRIMARY : TEXT_GRAY,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 결과 카운트 */}
          {inputText.trim().length > 0 &&
            (activeTab === "shop"
              ? status !== "loading" && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                      {t("map.shopSearchCount", { count: searchShops.length })}
                    </Text>
                  </View>
                )
              : !gachaLoading && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
                      {t("map.gachaSearchCount", {
                        count: gachaResults.length,
                      })}
                    </Text>
                  </View>
                ))}

          {/* 로딩 or 결과 목록 */}
          {activeTab === "shop" ? (
            status === "loading" ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator color={PRIMARY} />
              </View>
            ) : (
              <FlatList
                data={searchShops}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      gap: 12,
                    }}
                  >
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/shop/${item.id}` as never)}
                    >
                      <View style={{ gap: 4 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: TEXT_DARK,
                          }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={{ fontSize: 11, color: TEXT_GRAY }}
                          numberOfLines={1}
                        >
                          {item.address ?? t("map.noAddress")}
                        </Text>
                      </View>
                    </Pressable>
                    <TouchableOpacity
                      onPress={() => handleWishToggle(item.id)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={
                          wishedShopIds.includes(item.id)
                            ? "heart"
                            : "heart-outline"
                        }
                        size={22}
                        color={PRIMARY}
                      />
                    </TouchableOpacity>
                  </View>
                )}
                ItemSeparatorComponent={() => (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: GRAY_100,
                      marginHorizontal: 16,
                    }}
                  />
                )}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 60 }}>
                    <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                      {t("map.searchEmpty")}
                    </Text>
                  </View>
                }
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              />
            )
          ) : gachaLoading ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              data={gachaResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => router.push(`/gacha/${item.id}` as never)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      backgroundColor: THUMBNAIL_PLACEHOLDER,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {item.official_image_url ? (
                      <Image
                        source={{ uri: item.official_image_url }}
                        style={{ width: 56, height: 56 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="cube-outline"
                        size={24}
                        color={GRAY_400}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: TEXT_DARK,
                      }}
                      numberOfLines={1}
                    >
                      {item.name_ko ?? item.name}
                    </Text>
                    <Text
                      style={{ fontSize: 11, color: TEXT_GRAY }}
                      numberOfLines={1}
                    >
                      {item.manufacturer}
                      {item.available_shop_count > 0
                        ? ` · ${t("map.shopAvail", { count: item.available_shop_count })}`
                        : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height: 1,
                    backgroundColor: GRAY_100,
                    marginHorizontal: 16,
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 60 }}>
                  <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
                    검색 결과가 없어요
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}

      {/* 미니 상세 카드 */}
      {selectedShop && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: WHITE,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            shadowColor: BLACK,
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 8,
            paddingBottom: insets.bottom,
          }}
        >
          {/* 드래그 핸들 */}
          <View
            style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: BORDER,
              }}
            />
          </View>
          {/* 헤더: 이름 + 찜 버튼 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingBottom: 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: "700",
                color: TEXT_DARK,
              }}
            >
              {selectedShop.name}
            </Text>
            <TouchableOpacity
              onPress={() => handleWishToggle(selectedShop.id)}
              style={{ padding: 4 }}
            >
              <Ionicons
                name={
                  wishedShopIds.includes(selectedShop.id)
                    ? "heart"
                    : "heart-outline"
                }
                size={24}
                color={PRIMARY}
              />
            </TouchableOpacity>
          </View>
          {/* 주소 */}
          {selectedShop.address && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 3,
                gap: 6,
              }}
            >
              <Ionicons name="location-outline" size={15} color={TEXT_GRAY} />
              <Text
                numberOfLines={1}
                style={{ fontSize: 13, color: TEXT_GRAY, flex: 1 }}
              >
                {selectedShop.address}
              </Text>
            </View>
          )}
          {/* 운영시간 */}
          {(() => {
            const hours = formatBusinessHoursDisplay(
              parseBusinessHours(selectedShop.opening_hours),
            );
            if (!hours) return null;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  paddingHorizontal: 16,
                  paddingVertical: 3,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={TEXT_GRAY}
                  style={{ marginTop: 1 }}
                />
                <Text style={{ fontSize: 13, color: TEXT_GRAY, flex: 1 }}>
                  {hours}
                </Text>
              </View>
            );
          })()}
          {/* 하단 버튼 행: 닫기 + 상세 보기 */}
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 4,
              gap: 10,
            }}
          >
            <TouchableOpacity
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: BORDER,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => setSelectedShop(null)}
            >
              <Ionicons name="close" size={22} color={TEXT_GRAY} />
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                height: 48,
                backgroundColor: PRIMARY,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => router.push(`/shop/${selectedShop.id}` as never)}
            >
              <Text style={{ color: WHITE, fontWeight: "700", fontSize: 15 }}>
                {t("map.shopDetail")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
