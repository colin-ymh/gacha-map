import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  fetchByBounds,
  fetchBySearch,
  exitSearch,
  loadMore,
  refetchCurrentMode,
  setUserLocation,
  setSort,
  setLocationPermission,
} from "@/store/slices/shops.slice";
import { toggleWishAndPersistAsync } from "@/store/slices/wishlist.slice";
import type { ShopSummary, SortOption } from "@gacha-map/shared";
import NaverMap, {
  type NaverMapHandle,
} from "@/components/organisms/map/naver-map";
import ShopBottomSheetView, {
  type SortType,
} from "@/components/organisms/map/shop-bottom-sheet.view";
import LoginModal from "@/components/ui/LoginModal";

function toApiSort(sort: SortType): SortOption | null {
  switch (sort) {
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

const VISIBLE_HEADER_HEIGHT = 120;
const SHEET_RATIO = 0.55;

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
  const status = useAppSelector((s) => s.shops.status);
  const loadingMore = useAppSelector((s) => s.shops.loadingMore);
  const hasMore = useAppSelector((s) =>
    s.shops.mode === "map" ? s.shops.mapHasMore : s.shops.searchHasMore,
  );
  const reduxUserLocation = useAppSelector((s) => s.shops.userLocation);
  const sort = useAppSelector((s) => s.shops.sort);
  const locationPermission = useAppSelector((s) => s.shops.locationPermission);
  const searchQuery = useAppSelector((s) => s.shops.searchQuery);
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const shopError = useAppSelector((s) => s.shops.error);

  // Local state
  const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null);
  const [sortType, setSortType] = useState<SortType>("latest");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLoadButton, setShowLoadButton] = useState(true);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showLoadButtonRef = useRef(true);

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
  const handleLoadShops = useCallback(() => {
    const bounds = mapRef.current?.getCurrentBounds();
    if (!bounds) return;
    showLoadButtonRef.current = false;
    setShowLoadButton(false);
    dispatch(fetchByBounds(bounds));
  }, [dispatch]);

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
            "위치 권한 필요",
            "거리순 정렬을 사용하려면 위치 권한이 필요해요.",
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

    if (!showLoadButtonRef.current) {
      showLoadButtonRef.current = true;
      setShowLoadButton(true);
    }
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

  const handleSearchChange = useCallback(
    (text: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

      if (!text.trim()) {
        dispatch(exitSearch());
        return;
      }

      searchDebounceRef.current = setTimeout(() => {
        dispatch(fetchBySearch(text));
      }, 300);
    },
    [dispatch],
  );

  const handleSearchClear = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
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

  const isLoadingMap = status === "loading" && mode === "map";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <NaverMap
        ref={mapRef}
        shops={mode === "map" ? displayShops : []}
        selectedShopId={selectedShop?.id}
        wishedShopIds={wishedShopIds}
        onShopPress={handleShopPress}
        onMapInteraction={handleMapInteraction}
        onUserLocation={handleUserLocation}
        onLocationPermission={handleLocationPermission}
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
          <TouchableOpacity onPress={handleSearchClear}>
            <Ionicons name="close-circle" size={18} color="#888888" />
          </TouchableOpacity>
        )}
      </View>

      {/* 샵 불러오기 버튼 */}
      {mode !== "search" && (showLoadButton || isLoadingMap) && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 64,
            alignSelf: "center",
          }}
        >
          {isLoadingMap ? (
            <View
              style={{
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
          ) : (
            <TouchableOpacity
              style={{
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
              onPress={handleLoadShops}
            >
              <Ionicons name="add-circle-outline" size={16} color="#e94b8c" />
              <Text
                style={{ fontSize: 13, fontWeight: "600", color: "#e94b8c" }}
              >
                샵 불러오기
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
