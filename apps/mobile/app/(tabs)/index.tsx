import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  ScrollView,
  Image,
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
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SkeletonBone } from "@/components/ui/Skeleton";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { useFeaturedGacha } from "@/hooks/useFeaturedGacha";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchBySearch, exitSearch } from "@/store/slices/shops.slice";
import { useWishDebounce } from "@/hooks/useWishDebounce";
import { useProductWishDebounce } from "@/hooks/useProductWishDebounce";
import { setBounded } from "@/lib/bounded-cache";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useRecentShops } from "@/hooks/useRecentShops";
import { useRecentGacha } from "@/hooks/useRecentGacha";
import SearchHistoryOverlay from "@/components/organisms/search/SearchHistoryOverlay";
import LoginModal from "@/components/ui/LoginModal";
import GachaRollCard, {
  CARD_HEIGHT,
} from "@/components/molecules/gacha/GachaRollCard";
import GachaRollModal from "@/components/organisms/gacha/GachaRollModal";
import { useNearbyShops } from "@/hooks/useNearbyShops";
import type { GachaProductWithShops, ShopSummary } from "@gacha-map/shared";
import {
  WHITE,
  GRAY_100,
  TEXT_DARK,
  TEXT_GRAY,
  PRIMARY,
  GRAY_300,
  BORDER,
} from "@/constants/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 20;
const CARD_GAP = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - H_PADDING * 2) / 2.2);
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const AUTO_ADVANCE_MS = 3500;

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

type TabType = "shop" | "gacha";


function GachaItemThumb({ url }: { url: string | null }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width: 56, height: 56, flexShrink: 0 }}>
      <GachaPlaceholder size={56} borderRadius={8} />
      {!!url && (
        <Image
          source={{ uri: url }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 56,
            height: 56,
            borderRadius: 8,
            opacity: loaded ? 1 : 0,
          }}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
        />
      )}
    </View>
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
  const [erroredIds, setErroredIds] = useState<Set<string>>(new Set());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [dotIndex, setDotIndex] = useState(0);

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

  // History hooks
  const {
    history,
    addQuery,
    removeQuery,
    clearAll: clearHistory,
  } = useSearchHistory();
  const {
    recentShops,
    removeShop,
    reload: reloadRecentShops,
  } = useRecentShops();
  const {
    recentGacha,
    removeGacha,
    reload: reloadRecentGacha,
  } = useRecentGacha();

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
    dispatch(exitSearch());
    router.navigate("/(tabs)/map" as never);
  }, [dispatch, router]);

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

  useFocusEffect(
    useCallback(() => {
      reloadRecentShops();
      reloadRecentGacha();
    }, [reloadRecentShops, reloadRecentGacha]),
  );

  const { shops: nearbyShops, loading: nearbyLoading, locationDenied, userLat, userLng } = useNearbyShops(10);

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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 검색 바 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={1}
          onPress={() => setSearchOpen(true)}
        >
          <Ionicons name="search" size={18} color={TEXT_GRAY} />
          <Text style={styles.searchPlaceholder}>
            {t("map.searchPlaceholder")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
                      onRollPress={() => setSelectedProductId(item.id)}
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

        {/* 근처 샵 섹션 */}
        {!locationDenied && (
          <View style={styles.nearbySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("roll.nearbyShops")}</Text>
            </View>

            {nearbyLoading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shopCardList}
                scrollEnabled={false}
              >
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.shopCardSkeleton}>
                    <SkeletonBone width="80%" height={13} />
                    <SkeletonBone width="60%" height={11} style={{ marginTop: 5 }} />
                    <SkeletonBone width="55%" height={11} style={{ marginTop: 2 }} />
                    <SkeletonBone width={40} height={11} style={{ marginTop: 8 }} />
                  </View>
                ))}
              </ScrollView>
            ) : nearbyShops.length === 0 ? (
              <View style={styles.nearbyEmpty}>
                <Text style={styles.statusText}>{t("roll.nearbyEmpty")}</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shopCardList}
              >
                {nearbyShops.map((shop: ShopSummary) => (
                  <TouchableOpacity
                    key={shop.id}
                    style={styles.shopCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/shop/${shop.id}` as never)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shopCardName} numberOfLines={1}>
                        {shop.name}
                      </Text>
                      <Text style={styles.shopCardAddress} numberOfLines={2}>
                        {shop.address ?? ""}
                      </Text>
                    </View>
                    <View style={styles.shopCardMeta}>
                      <View style={styles.shopCardWish}>
                        <Ionicons name="heart" size={11} color={PRIMARY} />
                        <Text style={styles.shopCardWishText}>{shop.wishlist_count ?? 0}</Text>
                      </View>
                      {distanceLabel(shop.lat, shop.lng) !== "" && (
                        <Text style={styles.shopCardDist}>
                          {distanceLabel(shop.lat, shop.lng)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {selectedProductId && (
        <GachaRollModal
          productId={selectedProductId}
          isLoggedIn={!!isLoggedIn}
          onClose={() => setSelectedProductId(null)}
          onLoginRequired={() => {
            setSelectedProductId(null);
            router.push("/login");
          }}
        />
      )}

      {/* 검색 오버레이 */}
      {searchOpen && (
        <View style={styles.overlay}>
          {/* 헤더 */}
          <View style={[styles.overlayHeader, { paddingTop: insets.top }]}>
            <View style={styles.overlayHeaderRow}>
              <TouchableOpacity
                onPress={handleSearchClose}
                style={{ padding: 4 }}
              >
                <Ionicons name="arrow-back" size={24} color={TEXT_DARK} />
              </TouchableOpacity>
              <Text style={styles.overlayTitle}>{t("map.searchTitle")}</Text>
            </View>
            {/* 검색 입력창 */}
            <View style={styles.overlayInput}>
              <Ionicons name="search" size={16} color={TEXT_GRAY} />
              <TextInput
                style={styles.overlayTextInput}
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
                onSubmitEditing={() => {
                  const q = inputText.trim();
                  if (q) addQuery(q);
                }}
              />
              {inputText.length > 0 && (
                <TouchableOpacity onPress={handleSearchTextClear}>
                  <Ionicons name="close-circle" size={16} color={TEXT_GRAY} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 탭 */}
          <View style={styles.tabBar}>
            {(["shop", "gacha"] as TabType[]).map((tab) => {
              const isActive = activeTab === tab;
              const label =
                tab === "shop" ? t("map.tabShop") : t("map.tabGacha");
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabItem,
                    { borderBottomColor: isActive ? PRIMARY : "transparent" },
                  ]}
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
                  <View style={styles.countRow}>
                    <Text style={styles.countText}>
                      {t("map.shopSearchCount", { count: searchShops.length })}
                    </Text>
                    {searchShops.length > 0 && (
                      <TouchableOpacity
                        onPress={handleViewOnMap}
                        style={styles.viewOnMapBtn}
                      >
                        <Ionicons
                          name="map-outline"
                          size={14}
                          color={PRIMARY}
                        />
                        <Text style={styles.viewOnMapText}>
                          {t("map.viewOnMap")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              : !gachaLoading && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={styles.countText}>
                      {t("map.gachaSearchCount", {
                        count: gachaResults.length,
                      })}
                    </Text>
                  </View>
                ))}

          {/* 결과 목록 */}
          {inputText.trim() === "" ? (
            <SearchHistoryOverlay
              history={history}
              recentShops={recentShops}
              recentGacha={recentGacha}
              onQueryPress={(q) => {
                setInputText(q);
                dispatch(fetchBySearch(q));
              }}
              onRemoveQuery={removeQuery}
              onClearAll={clearHistory}
              onShopPress={(shopId) => router.push(`/shop/${shopId}` as never)}
              onRemoveShop={removeShop}
              onGachaPress={(gachaId) =>
                router.push(`/gacha/${gachaId}` as never)
              }
              onRemoveGacha={removeGacha}
            />
          ) : activeTab === "shop" ? (
            status === "loading" ? (
              <View style={{ flex: 1, padding: 16 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.skeletonShopRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <SkeletonBone width="55%" height={14} />
                      <SkeletonBone width="40%" height={11} />
                    </View>
                    <SkeletonBone width={22} height={22} borderRadius={11} />
                  </View>
                ))}
              </View>
            ) : (
              <FlatList
                data={searchShops}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.shopRow}>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/shop/${item.id}` as never)}
                    >
                      <View style={{ gap: 4 }}>
                        <Text style={styles.shopName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.shopAddress} numberOfLines={1}>
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
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>{t("map.searchEmpty")}</Text>
                  </View>
                }
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              />
            )
          ) : gachaLoading ? (
            <View style={{ flex: 1, padding: 16 }}>
              {[0, 1, 2, 3, 4].map((i) => (
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
              data={gachaResults}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.gachaRow}>
                  <TouchableOpacity
                    style={styles.gachaRowInner}
                    onPress={() => router.push(`/gacha/${item.id}` as never)}
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
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleProductWishToggle(item.id)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name={
                        wishedProductIds.includes(item.id)
                          ? "heart"
                          : "heart-outline"
                      }
                      size={22}
                      color={PRIMARY}
                    />
                  </TouchableOpacity>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>{t("map.searchEmpty")}</Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}

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
    backgroundColor: WHITE,
  },
  header: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 12,
  },
  searchBar: {
    height: 44,
    backgroundColor: GRAY_100,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: TEXT_GRAY,
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
    fontSize: 14,
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
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  shopAddress: {
    fontSize: 11,
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
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  skeletonGachaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  // Section headers
  sectionHeader: {
    paddingHorizontal: H_PADDING,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
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
  shopCardList: {
    paddingHorizontal: H_PADDING,
    gap: 12,
  },
  shopCard: {
    width: 140,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 100,
  },
  shopCardSkeleton: {
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  shopCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  shopCardAddress: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 4,
    lineHeight: 15,
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
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "600",
  },
  shopCardDist: {
    fontSize: 10,
    color: TEXT_GRAY,
  },
});
