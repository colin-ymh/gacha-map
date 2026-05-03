import { View, Text, ScrollView } from "react-native";
import type { ShopSummary } from "@gacha-map/shared";

interface SearchViewProps {
  shops: ShopSummary[];
  onRemoveWish: (shopId: string) => void;
}

export default function SearchView({ shops, onRemoveWish }: SearchViewProps) {
  const isEmpty = shops.length === 0;

  return (
    <View className="flex-1">
      {/* Header */}
      <View
        className="h-[52px] items-center justify-center border-b border-gray-200"
        style={{ borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1a1a1a" }}>
          내 찜 목록
        </Text>
      </View>

      {isEmpty ? (
        /* Empty State */
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 14, color: "#888888" }}>
            찜한 샵이 없어요
          </Text>
        </View>
      ) : (
        <>
          {/* Count Bar */}
          <View
            className="px-4 py-3"
            style={{ paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Text style={{ fontSize: 13, color: "#888888" }}>
              찜한 샵 {shops.length}개
            </Text>
          </View>

          {/* Separator */}
          <View
            style={{ height: 1, backgroundColor: "#e5e5e5", width: "100%" }}
          />

          {/* Shop List */}
          <ScrollView className="flex-1">
            {shops.map((shop, index) => (
              <View key={shop.id}>
                {/* Shop Card */}
                <View
                  className="flex-row px-4 py-3.5 gap-3"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    gap: 12,
                  }}
                >
                  {/* Thumbnail */}
                  <View
                    className="flex-shrink-0 rounded-lg bg-gray-300"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      backgroundColor: "#dedede",
                    }}
                  />

                  {/* Info Area */}
                  <View className="flex-1 justify-between">
                    {/* Shop Name */}
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#1a1a1a",
                      }}
                    >
                      {shop.name}
                    </Text>

                    {/* Address */}
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 11,
                        color: "#888888",
                        marginTop: 2,
                      }}
                    >
                      {shop.address}
                    </Text>

                    {/* Tags */}
                    {shop.tags && shop.tags.length > 0 && (
                      <View className="mt-1.5 flex-row gap-1.5">
                        {shop.tags.slice(0, 1).map((tag) => (
                          <View
                            key={tag}
                            className="rounded-full px-2 py-1"
                            style={{
                              height: 20,
                              paddingHorizontal: 8,
                              borderRadius: 9999,
                              backgroundColor: "#fde8ea",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                color: "#e63946",
                              }}
                            >
                              {tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Heart Icon */}
                  <View
                    className="items-center justify-center"
                    style={{ paddingRight: 4 }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        color: "#e94b8c",
                      }}
                      onPress={() => onRemoveWish(shop.id)}
                    >
                      ♥
                    </Text>
                  </View>
                </View>

                {/* Separator */}
                {index < shops.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#f3f4f6",
                      marginHorizontal: 16,
                    }}
                  />
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
