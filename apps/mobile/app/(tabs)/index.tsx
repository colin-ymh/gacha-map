import { useState, useCallback, useRef, useEffect } from "react";
import {
  Alert,
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  ScrollView,
  Pressable,
  TextInput,
  TouchableOpacity,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Carousel from "react-native-reanimated-carousel";
import { useRouter, useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SkeletonBone } from "@/components/ui/Skeleton";
import { useFeaturedGacha } from "@/hooks/useFeaturedGacha";
import { useNewArrivalGacha } from "@/hooks/useNewArrivalGacha";
import { getReleaseLabelSpec } from "@/lib/releaseLabel";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchBySearch, exitSearch } from "@/store/slices/shops.slice";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { setBounded } from "@/lib/bounded-cache";
import { useRecentHistory } from "@/hooks/useRecentHistory";
import SearchOverlay from "@/components/organisms/search/SearchOverlay";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import SearchBar from "@/components/molecules/SearchBar";
import LoginModal from "@/components/ui/LoginModal";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { useLiquidGlassPress } from "@/hooks/useLiquidGlassPress";
import GachaRollCard, {
  CARD_HEIGHT,
} from "@/components/molecules/gacha/GachaRollCard";
import { useNearbyShops } from "@/hooks/useNearbyShops";
import { usePinnedGacha } from "@/hooks/usePinnedGacha";
import type { GachaProductWithShops, ShopSummary } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_100,
  GRAY_200,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
  GRAY_300,
} from "@/constants/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 20;
const CARD_GAP = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - H_PADDING * 2) / 2.2);
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const AUTO_ADVANCE_MS = 3500;
const SHOP_CARD_HEIGHT = 110;

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

type TabType = "shop" | "gacha";

const GRID_ACTIONS: {
  key: string;
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  onPress: (
    router: ReturnType<typeof useRouter>,
    openSearch: (tab?: "shop" | "gacha") => void,
  ) => void;
}[] = [
  {
    key: "shop-search",
    labelKey: "quick.shopSearch",
    icon: "storefront",
    iconColor: "#E94B8C",
    onPress: (_, openSearch) => openSearch("shop"),
  },
  {
    key: "product-search",
    labelKey: "quick.productSearch",
    icon: "search",
    iconColor: "#6366F1",
    onPress: (_, openSearch) => openSearch("gacha"),
  },
  {
    key: "report",
    labelKey: "quick.report",
    icon: "megaphone",
    iconColor: "#22C55E",
    onPress: (router) => router.push("/report" as never),
  },
  {
    key: "badge",
    labelKey: "quick.badge",
    icon: "ribbon",
    iconColor: "#EAB308",
    onPress: (router) => router.push("/badges" as never),
  },
];

function NearbyShopCard({
  item,
  distLabel,
  onPress,
}: {
  item: ShopSummary;
  distLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.shopCard}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.shopCardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.shopCardAddress} numberOfLines={2}>
          {item.address ?? ""}
        </Text>
      </View>
      <View style={styles.shopCardMeta}>
        <View style={styles.shopCardWish}>
          <Ionicons name="heart" size={11} color={PRIMARY} />
          <Text style={styles.shopCardWishText}>
            {item.wishlist_count ?? 0}
          </Text>
        </View>
        {distLabel !== "" && (
          <Text style={styles.shopCardDist}>{distLabel}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function RollScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  // Auth / wishlist
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const wishedShopIds = useAppSelector((s) => s.wishlist.shopIds);
  const wishedProductIds = useAppSelector((s) => s.productWishlist.productIds);

  // Shop search Redux state
  const searchShops = useAppSelector((s) => s.shops.searchShops);
  const status = useAppSelector((s) => s.shops.status);

  // Featured gacha carousel
  const { items, loading, error } = useFeaturedGacha();
  const { items: newArrivalItems, loading: newArrivalLoading } =
    useNewArrivalGacha();
  const [erroredIds, setErroredIds] = useState<Set<string>>(new Set());
  const [dotIndex, setDotIndex] = useState(0);
  const [newArrivalDotIndex, setNewArrivalDotIndex] = useState(0);
  const [shopDotIndex, setShopDotIndex] = useState(0);

  // Pin search state
  const [pinSearchOpen, setPinSearchOpen] = useState(false);
  const [pinQuery, setPinQuery] = useState("");
  const [pinResults, setPinResults] = useState<GachaProductWithShops[]>([]);
  const [pinLoading, setPinLoading] = useState(false);
  const {
    onPressIn: unpinPressIn,
    animatedStyle: unpinAnimStyle,
    brightnessValue: unpinBrightness,
  } = useLiquidGlassPress();

  // Search state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [inputText, setInputText] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    reload: reloadRecent,
  } = useRecentHistory();

  // Wish handlers
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

  // Search handlers
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
    setSearchOpen(false);
    // 검색 결과(mode/searchShops)는 Redux에 유지 — map 탭에서 그대로 이어받아
    // 검색 결과 핀을 보여주고 카메라를 fit한다. exitSearch() 호출 금지.
    router.navigate("/(tabs)/map" as never);
  }, [router]);

  const handleImageError = useCallback((id: string) => {
    setErroredIds((prev) => new Set([...prev, id]));
  }, []);

  // Effects
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      gachaAbort.current?.abort();
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
    if (!pinSearchOpen) return;
    const trimmed = pinQuery.trim();
    if (!trimmed) {
      setPinResults([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setPinLoading(true);
      fetch(
        `${API_BASE}/api/gacha-products?q=${encodeURIComponent(trimmed)}&has_variants=true&include_shops=true&limit=20`,
        { signal: ctrl.signal },
      )
        .then((r) => r.json())
        .then((data) =>
          setPinResults((data.products ?? []) as GachaProductWithShops[]),
        )
        .catch(() => {})
        .finally(() => setPinLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [pinQuery, pinSearchOpen]);

  useFocusEffect(
    useCallback(() => {
      reloadRecent();
    }, [reloadRecent]),
  );

  const {
    shops: nearbyShops,
    loading: nearbyLoading,
    locationDenied,
    userLat,
    userLng,
    locationName,
    refresh: refreshNearby,
  } = useNearbyShops(10);

  function distanceLabel(shopLat: number, shopLng: number): string {
    if (userLat == null || userLng == null) return "";
    const R = 6371000;
    const dLat = ((shopLat - userLat) * Math.PI) / 180;
    const dLng = ((shopLng - userLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLat * Math.PI) / 180) *
        Math.cos((shopLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const m = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
  }

  const filteredItems = items.filter((item) => !erroredIds.has(item.id));
  const filteredNewArrivalItems = newArrivalItems.filter(
    (item) => !erroredIds.has(item.id),
  );
  const { pinned, pin, unpin } = usePinnedGacha();

  const SEARCH_BAR_H = 68; // paddingVertical 12*2 + SearchBar 44

  const openSearch = useCallback((tab: "shop" | "gacha" = "shop") => {
    setActiveTab(tab);
    setSearchOpen(true);
  }, []);

  const handleRollPress = useCallback(() => {
    const target =
      pinned ??
      (filteredItems.length > 0
        ? filteredItems[Math.floor(Math.random() * filteredItems.length)]
        : null);
    if (target) {
      const img =
        (target as { imageUrl?: string | null }).imageUrl ??
        (target as { official_image_url?: string | null }).official_image_url ??
        null;
      router.push(
        `/roll/${target.id}${img ? `?imageUrl=${encodeURIComponent(img)}` : ""}` as never,
      );
    }
  }, [pinned, filteredItems, router]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: SEARCH_BAR_H, paddingBottom: 120 }}
      >
        {/* 퀵액션 */}
        <View
          style={{
            paddingHorizontal: H_PADDING,
            paddingTop: 16,
            paddingBottom: 4,
            gap: 10,
          }}
        >
          {/* 가챠 돌려보기 풀와이드 */}
          <TouchableOpacity
            style={styles.rollCard}
            activeOpacity={0.82}
            onPress={handleRollPress}
          >
            <Ionicons name="dice" size={28} color={WHITE} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rollCardTitle}>{t("quick.roll")}</Text>
              <Text style={styles.rollCardSub} numberOfLines={1}>
                {pinned ? pinned.name : t("quick.rollSub")}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>

          {/* 핀 변경 링크 */}
          <TouchableOpacity
            onPress={() => setPinSearchOpen(true)}
            hitSlop={8}
            style={styles.pinChangeRow}
          >
            <Ionicons name="pin-outline" size={13} color={TEXT_GRAY} />
            <Text style={styles.pinChangeText}>
              {pinned
                ? t("pin.change", { defaultValue: "최애가챠 변경" })
                : t("pin.set", { defaultValue: "최애가챠 설정" })}
            </Text>
          </TouchableOpacity>

          {/* 2×2 그리드 */}
          <View style={styles.quickGrid}>
            {GRID_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.key}
                onPress={() => action.onPress(router, openSearch)}
                activeOpacity={0.75}
                style={styles.quickCard}
              >
                <View style={styles.quickIcon}>
                  <Ionicons
                    name={action.icon}
                    size={28}
                    color={action.iconColor}
                  />
                </View>
                <Text style={styles.quickLabel}>{t(action.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 가챠 캐러셀 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("roll.featuredTitle")}</Text>
        </View>

        {loading && (
          <View style={styles.carouselSkeleton}>
            <View style={styles.cardRow}>
              <SkeletonBone
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                borderRadius={12}
              />
              <SkeletonBone
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                borderRadius={12}
              />
            </View>
            <View style={styles.dotRow}>
              {[0, 1, 2].map((i) => (
                <SkeletonBone
                  key={i}
                  width={6}
                  height={6}
                  borderRadius={3}
                  style={{ marginHorizontal: 3 }}
                />
              ))}
            </View>
          </View>
        )}

        {!loading && error && (
          <View style={styles.center}>
            <Text style={styles.statusText}>{t("roll.error")}</Text>
          </View>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.statusText}>{t("roll.empty")}</Text>
          </View>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <View>
            <View style={styles.carouselContainer}>
              <Carousel
                data={filteredItems}
                width={SNAP_INTERVAL}
                height={CARD_HEIGHT}
                loop
                autoPlay
                autoPlayInterval={AUTO_ADVANCE_MS}
                scrollAnimationDuration={400}
                onSnapToItem={setDotIndex}
                style={{ width: SCREEN_WIDTH }}
                renderItem={({ item }: { item: GachaProductWithShops }) => (
                  <View style={styles.cardSlot}>
                    <GachaRollCard
                      item={item}
                      width={CARD_WIDTH}
                      onPress={() => router.push(`/gacha/${item.id}`)}
                      onRollPress={() => {
                        const img = item.official_image_url;
                        router.push(
                          `/roll/${item.id}${img ? `?imageUrl=${encodeURIComponent(img)}` : ""}` as never,
                        );
                      }}
                      onImageError={() => handleImageError(item.id)}
                    />
                  </View>
                )}
              />
            </View>
            <View style={styles.dots}>
              {filteredItems.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === dotIndex && styles.dotActive]}
                />
              ))}
            </View>
          </View>
        )}

        {/* 신상 가챠 캐러셀 */}
        {(newArrivalLoading || filteredNewArrivalItems.length > 0) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("roll.newArrivalTitle")}
              </Text>
            </View>

            {newArrivalLoading && (
              <View style={styles.carouselSkeleton}>
                <View style={styles.cardRow}>
                  <SkeletonBone
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    borderRadius={12}
                  />
                  <SkeletonBone
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    borderRadius={12}
                  />
                </View>
                <View style={styles.dotRow}>
                  {[0, 1, 2].map((i) => (
                    <SkeletonBone
                      key={i}
                      width={6}
                      height={6}
                      borderRadius={3}
                      style={{ marginHorizontal: 3 }}
                    />
                  ))}
                </View>
              </View>
            )}

            {!newArrivalLoading && filteredNewArrivalItems.length > 0 && (
              <View>
                <View style={styles.carouselContainer}>
                  <Carousel
                    data={filteredNewArrivalItems}
                    width={SNAP_INTERVAL}
                    height={CARD_HEIGHT}
                    loop
                    autoPlay
                    autoPlayInterval={AUTO_ADVANCE_MS}
                    scrollAnimationDuration={400}
                    onSnapToItem={setNewArrivalDotIndex}
                    style={{ width: SCREEN_WIDTH }}
                    renderItem={({ item }: { item: GachaProductWithShops }) => {
                      const labelSpec = getReleaseLabelSpec(item);
                      return (
                        <View style={styles.cardSlot}>
                          <GachaRollCard
                            item={item}
                            width={CARD_WIDTH}
                            releaseLabel={
                              labelSpec
                                ? t(labelSpec.key, labelSpec.params)
                                : undefined
                            }
                            onPress={() => router.push(`/gacha/${item.id}`)}
                            onRollPress={() => {
                              const img = item.official_image_url;
                              router.push(
                                `/roll/${item.id}${img ? `?imageUrl=${encodeURIComponent(img)}` : ""}` as never,
                              );
                            }}
                            onImageError={() => handleImageError(item.id)}
                          />
                        </View>
                      );
                    }}
                  />
                </View>
                <View style={styles.dots}>
                  {filteredNewArrivalItems.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === newArrivalDotIndex && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* 근처 샵 섹션 */}
        <View style={styles.nearbySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("roll.nearbyShops")}</Text>
            <View style={styles.sectionLocationRow}>
              {!nearbyLoading &&
                (locationDenied ? (
                  <Text style={styles.sectionLocation}>
                    {t("roll.locationDenied")}
                  </Text>
                ) : locationName ? (
                  <Text style={styles.sectionLocation}>{locationName}</Text>
                ) : null)}
              <TouchableOpacity
                onPress={
                  locationDenied
                    ? () =>
                        Alert.alert(
                          t("common.locationPermissionTitle"),
                          t("common.locationPermissionDesc"),
                          [
                            { text: t("common.cancel"), style: "cancel" },
                            {
                              text: t("common.goToSettings"),
                              onPress: () => Linking.openSettings(),
                            },
                          ],
                        )
                    : refreshNearby
                }
                style={styles.reloadBtn}
                hitSlop={8}
              >
                <Ionicons name="refresh" size={14} color={TEXT_GRAY} />
              </TouchableOpacity>
            </View>
          </View>

          {nearbyLoading ? (
            <View
              style={[
                styles.carouselContainer,
                { flexDirection: "row", gap: CARD_GAP },
              ]}
            >
              {[0, 1].map((i) => (
                <View key={i} style={styles.shopCard}>
                  <View style={{ gap: 4 }}>
                    <SkeletonBone width="60%" height={14} borderRadius={6} />
                    <SkeletonBone
                      width="80%"
                      height={12}
                      borderRadius={5}
                      style={{ marginTop: 4 } as any}
                    />
                    <SkeletonBone width="55%" height={12} borderRadius={5} />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <SkeletonBone width={11} height={11} borderRadius={6} />
                      <SkeletonBone width={24} height={11} borderRadius={5} />
                    </View>
                    <SkeletonBone width={40} height={11} borderRadius={5} />
                  </View>
                </View>
              ))}
            </View>
          ) : locationDenied ? (
            <View style={styles.nearbyEmpty}>
              <Text style={styles.statusText}>
                {t("roll.locationDeniedDesc")}
              </Text>
            </View>
          ) : nearbyShops.length === 0 ? (
            <View style={styles.nearbyEmpty}>
              <Text style={styles.statusText}>{t("roll.nearbyEmpty")}</Text>
            </View>
          ) : (
            <View>
              <View style={styles.carouselContainer}>
                <Carousel
                  data={nearbyShops.slice(0, 10)}
                  width={SNAP_INTERVAL}
                  height={SHOP_CARD_HEIGHT}
                  loop
                  autoPlay
                  autoPlayInterval={AUTO_ADVANCE_MS}
                  scrollAnimationDuration={400}
                  onSnapToItem={setShopDotIndex}
                  style={{ width: SCREEN_WIDTH }}
                  renderItem={({ item }: { item: ShopSummary }) => (
                    <View style={styles.cardSlot}>
                      <NearbyShopCard
                        item={item}
                        distLabel={distanceLabel(item.lat, item.lng)}
                        onPress={() => router.push(`/shop/${item.id}` as never)}
                      />
                    </View>
                  )}
                />
              </View>
              <View style={styles.dots}>
                {nearbyShops.slice(0, 10).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === shopDotIndex && styles.dotActive]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 플로팅 검색바 */}
      {!searchOpen && (
        <View style={[styles.floatingSearchBar, { top: insets.top }]}>
          <SearchBar
            glass
            placeholder={t("map.searchPlaceholder")}
            onPress={() => openSearch()}
          />
        </View>
      )}

      {/* 검색 오버레이 */}
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

      {/* 핀 고정 상품 선택 모달 */}
      <Modal
        visible={pinSearchOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setPinSearchOpen(false);
          setPinQuery("");
          setPinResults([]);
        }}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.pinModalBackdrop]}
          onPress={() => {
            setPinSearchOpen(false);
            setPinQuery("");
            setPinResults([]);
          }}
        />
        <View style={styles.pinModalCenter}>
          <View style={styles.pinModalSheet}>
            {/* 헤더 */}
            <View style={styles.pinModalHeader}>
              <Text style={styles.pinModalTitle}>
                {t("pin.selectTitle", { defaultValue: "최애가챠" })}
              </Text>
              {pinned && (
                <LiquidGlass
                  borderRadius={14}
                  style={unpinAnimStyle}
                  brightnessOpacity={unpinBrightness}
                >
                  <TouchableOpacity
                    onPress={() => {
                      unpin();
                      setPinSearchOpen(false);
                      setPinQuery("");
                      setPinResults([]);
                    }}
                    onPressIn={unpinPressIn}
                    activeOpacity={1}
                    hitSlop={4}
                    style={styles.unpinBtn}
                  >
                    <Text style={styles.unpinBtnText}>
                      {t("pin.unpin", { defaultValue: "해제" })}
                    </Text>
                  </TouchableOpacity>
                </LiquidGlass>
              )}
            </View>

            {/* 검색 입력 */}
            <View
              style={[
                styles.overlayInput,
                { marginHorizontal: 16, marginBottom: 4 },
              ]}
            >
              <Ionicons name="search" size={16} color={TEXT_GRAY} />
              <TextInput
                style={styles.overlayTextInput}
                placeholder={t("pin.searchPlaceholder", {
                  defaultValue: "상품 이름 검색...",
                })}
                placeholderTextColor={TEXT_GRAY}
                value={pinQuery}
                onChangeText={setPinQuery}
                returnKeyType="search"
                autoFocus
              />
              {pinQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setPinQuery("");
                    setPinResults([]);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={TEXT_GRAY} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.pinSearchHint}>
              {t("pin.hint", {
                defaultValue: "상세 상품 정보가 있는 가챠만 표시돼요",
              })}
            </Text>

            {/* 현재 고정 상품 */}
            {pinned && pinQuery.trim() === "" && (
              <View style={styles.pinCurrentWrap}>
                <Text style={styles.pinCurrentLabel}>
                  {t("pin.current", { defaultValue: "현재 최애가챠" })}
                </Text>
                <View style={styles.pinCurrentRow}>
                  <GachaItemThumb url={pinned.imageUrl} />
                  <Text style={styles.pinCurrentName} numberOfLines={1}>
                    {pinned.name}
                  </Text>
                  <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                </View>
              </View>
            )}

            {/* 결과 */}
            {pinLoading ? (
              <View style={{ padding: 16, gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonGachaRow}>
                    <SkeletonBone
                      width={56}
                      height={56}
                      borderRadius={8}
                      style={{ flexShrink: 0 } as any}
                    />
                    <View style={{ flex: 1, gap: 6 }}>
                      <SkeletonBone width="60%" height={14} />
                      <SkeletonBone width="40%" height={12} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <FlatList
                data={pinResults}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gachaRow}
                    onPress={() => {
                      pin({
                        id: item.id,
                        name: item.name_ko ?? item.name,
                        imageUrl: item.official_image_url,
                      });
                      setPinSearchOpen(false);
                      setPinQuery("");
                      setPinResults([]);
                    }}
                  >
                    <GachaItemThumb url={item.official_image_url} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {item.name_ko ?? item.name}
                      </Text>
                      <Text style={styles.shopAddress} numberOfLines={1}>
                        {item.manufacturer}
                        {item.available_shop_count > 0
                          ? ` · ${t("map.shopAvail", { count: item.available_shop_count })}`
                          : ""}
                      </Text>
                    </View>
                    {pinned?.id === item.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={PRIMARY}
                      />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                  pinQuery.trim().length > 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>
                        {t("map.searchEmpty")}
                      </Text>
                    </View>
                  ) : null
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginPress={() => {
          setShowLoginModal(false);
          router.push("/login");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GRAY_100,
  },
  header: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 12,
  },
  floatingSearchBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: H_PADDING,
    paddingVertical: 12,
  },
  carouselContainer: {
    paddingLeft: H_PADDING,
    overflow: "hidden",
  },
  cardSlot: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GRAY_300,
  },
  dotActive: {
    backgroundColor: PRIMARY,
  },
  center: {
    height: CARD_HEIGHT + 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GRAY_100,
    marginHorizontal: H_PADDING,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 15,
    color: TEXT_GRAY,
  },
  carouselSkeleton: {
    paddingHorizontal: H_PADDING,
    paddingTop: 24,
  },
  cardRow: {
    flexDirection: "row" as const,
    gap: CARD_GAP,
  },
  dotRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    marginTop: 12,
  },
  // Search overlay
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE,
    zIndex: 50,
  },
  overlayHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  overlayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    gap: 8,
  },
  overlayTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  overlayInput: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    height: 40,
    backgroundColor: GRAY_100,
    borderRadius: 20,
    paddingHorizontal: 14,
    gap: 8,
  },
  overlayTextInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
    paddingVertical: 0,
  },
  tabBar: {
    flexDirection: "row",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  countText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_GRAY,
  },
  viewOnMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewOnMapText: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: "600",
  },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  shopName: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  shopAddress: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  gachaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  gachaRowInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  separator: {
    height: 1,
    backgroundColor: GRAY_100,
    marginHorizontal: 16,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  skeletonShopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  skeletonGachaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PADDING,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_DARK,
  },
  sectionLocation: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  sectionLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reloadBtn: {
    padding: 2,
  },
  // Nearby shops
  nearbySection: {
    marginTop: 8,
  },
  nearbyEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: H_PADDING,
    backgroundColor: GRAY_100,
    borderRadius: 12,
  },
  shopCard: {
    width: CARD_WIDTH,
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GRAY_200,
    padding: 12,
    flexDirection: "column",
    justifyContent: "space-between",
    height: SHOP_CARD_HEIGHT,
  },
  shopCardName: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  shopCardAddress: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 4,
    lineHeight: 16,
  },
  shopCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shopCardWish: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  shopCardWishText: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "600",
  },
  shopCardDist: {
    fontSize: 11,
    color: TEXT_GRAY,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickCard: {
    width: (SCREEN_WIDTH - H_PADDING * 2 - 10 * 3) / 4,
    alignItems: "center",
    paddingVertical: 14,
    gap: 7,
  },
  quickIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: GRAY_200,
    alignItems: "center",
    justifyContent: "center",
  },

  pinChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  pinChangeText: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  pinModalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  pinModalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 120,
  },
  pinModalSheet: {
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 20,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  pinModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  unpinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unpinBtnText: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: "500",
  },
  pinModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  pinSearchHint: {
    fontSize: 11,
    color: TEXT_GRAY,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  pinCurrentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },
  pinCurrentLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: "600",
  },
  pinCurrentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pinCurrentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  rollCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: PRIMARY,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  rollCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: WHITE,
  },
  rollCardSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_DARK,
  },
});
