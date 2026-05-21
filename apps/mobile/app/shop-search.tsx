import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchShops } from "@gacha-map/shared";
import type { ShopSummary } from "@gacha-map/shared";
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

function ShopThumb({ imageUrls }: { imageUrls: string[] }) {
  const [error, setError] = useState(false);
  const uri = !error && imageUrls.length > 0 ? imageUrls[0] : null;
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
          source={{ uri }}
          style={{ width: 64, height: 64 }}
          resizeMode="cover"
          onError={() => setError(true)}
        />
      ) : (
        <Ionicons name="storefront-outline" size={28} color={GRAY_400} />
      )}
    </View>
  );
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ShopSearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    try {
      const result = await fetchShops(API_BASE, { q: trimmed, limit: 50 });
      setResults(result.shops);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleShopPress = useCallback(
    (shopId: string) => {
      router.push(`/shop/${shopId}` as never);
    },
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* 검색창 헤더 */}
      <View className="flex-row items-center px-4 py-2 gap-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: TEXT_BODY }}>{"←"}</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          className="flex-1 h-10 bg-gray-100 rounded-[20px] px-4 text-sm"
          placeholder="가챠샵 이름, 주소 검색"
          placeholderTextColor={TEXT_PLACEHOLDER}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => handleSearch(query)}
          returnKeyType="search"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery("");
              setResults([]);
              setSearched(false);
              inputRef.current?.focus();
            }}
          >
            <Text style={{ fontSize: 18, color: TEXT_PLACEHOLDER }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 결과 */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : searched && results.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
            검색 결과가 없어요
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <View>
              <TouchableOpacity
                className="flex-row px-4 py-3.5 gap-3"
                activeOpacity={0.7}
                onPress={() => handleShopPress(item.id)}
              >
                <ShopThumb imageUrls={item.image_urls} />
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
                  {item.tags && item.tags.length > 0 && (
                    <View className="flex-row gap-1">
                      {item.tags.slice(0, 2).map((tag) => (
                        <View
                          key={tag}
                          style={{
                            backgroundColor: PRIMARY_BG,
                            borderRadius: 9999,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ fontSize: 10, color: PRIMARY }}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {index < results.length - 1 && (
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
      )}
    </SafeAreaView>
  );
}
