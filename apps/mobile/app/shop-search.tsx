import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { fetchShops } from "@gacha-map/shared";
import type { ShopSummary, GachaProductWithShops } from "@gacha-map/shared";
import { setBounded } from "@/lib/bounded-cache";
import {
  PRIMARY,
  PRIMARY_BG,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_BODY,
  TEXT_PLACEHOLDER,
  THUMBNAIL_PLACEHOLDER,
  GRAY_400,
  GRAY_100,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";
const GACHA_DEBOUNCE_MS = 300;

type TabType = "shop" | "gacha";

function ShopThumb() {
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: THUMBNAIL_PLACEHOLDER,
        flexShrink: 0,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="storefront-outline" size={28} color={GRAY_400} />
    </View>
  );
}

function GachaThumb({ imageUrl }: { imageUrl: string | null }) {
  const [error, setError] = useState(false);
  const uri = !error && imageUrl ? imageUrl : null;
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: THUMBNAIL_PLACEHOLDER,
        flexShrink: 0,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={uri}
          style={{ width: 64, height: 64 }}
          contentFit="cover"
          onError={() => setError(true)}
        />
      ) : (
        <Text style={{ fontSize: 24 }}>🎰</Text>
      )}
    </View>
  );
}

export default function ShopSearchScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);
  const [activeTab, setActiveTab] = useState<TabType>("shop");
  const [query, setQuery] = useState("");

  // Shop search state
  const [shopResults, setShopResults] = useState<ShopSummary[]>([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopSearched, setShopSearched] = useState(false);

  // Gacha search state
  const [gachaResults, setGachaResults] = useState<GachaProductWithShops[]>([]);
  const [gachaLoading, setGachaLoading] = useState(false);
  const [gachaSearched, setGachaSearched] = useState(false);
  const gachaCache = useRef<Map<string, GachaProductWithShops[]>>(new Map());
  const gachaAbort = useRef<AbortController | null>(null);

  const handleShopSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setShopLoading(true);
    setShopSearched(true);
    try {
      const result = await fetchShops(API_BASE, { q: trimmed, limit: 50 });
      setShopResults(result.shops);
    } catch {
      setShopResults([]);
    } finally {
      setShopLoading(false);
    }
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
      setBounded(gachaCache.current, key, products, 30);
      setGachaResults(products);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setGachaResults([]);
    } finally {
      setGachaLoading(false);
    }
  }, []);

  // Gacha debounce
  useEffect(() => {
    if (activeTab !== "gacha") return;
    const trimmed = query.trim();
    if (!trimmed) {
      setGachaResults([]);
      setGachaSearched(false);
      return;
    }
    setGachaSearched(true);
    setGachaLoading(true);
    const timer = setTimeout(() => searchGacha(trimmed), GACHA_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [query, activeTab, searchGacha]);

  useEffect(() => {
    return () => {
      gachaAbort.current?.abort();
    };
  }, []);

  const handleSearch = useCallback(() => {
    if (activeTab === "shop") handleShopSearch(query);
    else {
      const trimmed = query.trim();
      if (trimmed) {
        setGachaSearched(true);
        searchGacha(trimmed);
      }
    }
  }, [activeTab, query, handleShopSearch, searchGacha]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setShopResults([]);
    setShopSearched(false);
    setGachaResults([]);
    setGachaSearched(false);
    inputRef.current?.focus();
  }, []);

  const isLoading = activeTab === "shop" ? shopLoading : gachaLoading;
  const searched = activeTab === "shop" ? shopSearched : gachaSearched;
  const placeholder =
    activeTab === "shop"
      ? t("shopSearch.placeholderShop")
      : t("shopSearch.placeholderGacha");

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* 검색창 헤더 */}
      <View
        className="flex-row items-center px-4 py-2 gap-3"
        style={{ borderBottomWidth: 1, borderBottomColor: GRAY_100 }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: TEXT_BODY }}>{"←"}</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          className="flex-1 h-10 bg-gray-100 rounded-[20px] px-4 text-sm"
          placeholder={placeholder}
          placeholderTextColor={TEXT_PLACEHOLDER}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <Text style={{ fontSize: 18, color: TEXT_PLACEHOLDER }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 탭 */}
      <View
        className="flex-row"
        style={{ borderBottomWidth: 1, borderBottomColor: GRAY_100 }}
      >
        {(["shop", "gacha"] as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          const label =
            tab === "shop" ? t("shopSearch.tabShop") : t("shopSearch.tabGacha");
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => handleTabChange(tab)}
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

      {/* 결과 */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : searched &&
        (activeTab === "shop" ? shopResults : gachaResults).length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
            {t("shopSearch.noResults")}
          </Text>
        </View>
      ) : activeTab === "shop" ? (
        <FlatList
          data={shopResults}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <View>
              <TouchableOpacity
                className="flex-row px-4 py-3.5 gap-3"
                activeOpacity={0.7}
                onPress={() => router.push(`/shop/${item.id}` as never)}
              >
                <ShopThumb />
                <View className="flex-1 justify-center gap-1">
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: TEXT_DARK,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 11, color: TEXT_GRAY }}
                  >
                    {item.address}
                  </Text>
                </View>
              </TouchableOpacity>
              {index < shopResults.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: GRAY_100,
                    marginHorizontal: 16,
                  }}
                />
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={gachaResults}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const name = item.name_ko ?? item.name;
            const hasShops = item.available_shop_count > 0;
            const priceLabel = item.min_price_krw
              ? t("shopSearch.minPrice", {
                  price: item.min_price_krw.toLocaleString(),
                })
              : t("shopSearch.noPriceInfo");
            return (
              <View>
                <TouchableOpacity
                  className="flex-row px-4 py-3.5 gap-3"
                  activeOpacity={0.7}
                  onPress={() => router.push(`/gacha/${item.id}` as never)}
                >
                  <GachaThumb imageUrl={item.official_image_url} />
                  <View className="flex-1 justify-center gap-1">
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: TEXT_DARK,
                      }}
                    >
                      {name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 12, color: TEXT_GRAY }}
                    >
                      {item.manufacturer}
                    </Text>
                    {item.price_jpy && (
                      <Text style={{ fontSize: 11, color: TEXT_GRAY }}>
                        ¥{item.price_jpy.toLocaleString()}
                      </Text>
                    )}
                    <View className="flex-row items-center gap-2">
                      {hasShops ? (
                        <>
                          <Text
                            style={{
                              fontSize: 12,
                              color: PRIMARY,
                              fontWeight: "600",
                            }}
                          >
                            {t("shopSearch.shopCount", {
                              count: item.available_shop_count,
                            })}
                          </Text>
                          <Text style={{ fontSize: 12, color: PRIMARY }}>
                            · {priceLabel}
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                          {t("shopSearch.noShops")}
                        </Text>
                      )}
                    </View>
                    {item.name_parts?.tags && item.name_parts.tags.length > 0 && (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 4,
                          marginTop: 2,
                        }}
                      >
                        {item.name_parts.tags.slice(0, 3).map((tag) => (
                          <View
                            key={tag}
                            style={{
                              backgroundColor: GRAY_100,
                              borderRadius: 99,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                            }}
                          >
                            <Text style={{ fontSize: 10, color: TEXT_GRAY }}>
                              {tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                {index < gachaResults.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: GRAY_100,
                      marginHorizontal: 16,
                    }}
                  />
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
