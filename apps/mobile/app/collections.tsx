import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { GachaCollectionSummary } from "@gacha-map/shared";
import { getAuthHeaders } from "@/lib/supabase";
import { GlassBackButton } from "@/components/ui/GlassBackButton";
import GachaItemThumb from "@/components/molecules/GachaItemThumb";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
  GRAY_200,
} from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: GRAY_200,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.round(ratio * 100)}%`,
          height: 6,
          borderRadius: 3,
          backgroundColor: PRIMARY,
        }}
      />
    </View>
  );
}

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [collections, setCollections] = useState<GachaCollectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!API_BASE) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/users/gacha-collections`, {
        headers,
      });
      const body = await res.json().catch(() => ({}));
      setCollections(
        (body as { collections?: GachaCollectionSummary[] }).collections ?? [],
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: GRAY_100 }}>
      <View
        style={{
          position: "absolute",
          left: 16,
          top: insets.top + 8,
          zIndex: 10,
        }}
      >
        <GlassBackButton onPress={() => router.back()} />
      </View>

      {isLoading ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 60,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 20,
            gap: 12,
          }}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: WHITE,
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                gap: 12,
              }}
            >
              <SkeletonBone width={72} height={72} borderRadius={12} />
              <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
                <SkeletonBone width="60%" height={15} borderRadius={5} />
                <SkeletonBone width="40%" height={12} borderRadius={4} />
                <SkeletonBone width="100%" height={6} borderRadius={3} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : collections.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={load}
              tintColor={PRIMARY}
            />
          }
        >
          <Text style={{ fontSize: 14, color: TEXT_GRAY }}>
            {t("collection.emptyList")}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 60,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 20,
            gap: 12,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={load}
              tintColor={PRIMARY}
            />
          }
        >
          {collections.map((item) => (
            <TouchableOpacity
              key={item.productId}
              activeOpacity={0.7}
              onPress={() =>
                router.push(
                  `/collection/${item.productId}?title=${encodeURIComponent(item.productDisplayName)}` as never,
                )
              }
              style={{
                backgroundColor: WHITE,
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                gap: 12,
              }}
            >
              <GachaItemThumb
                url={item.productImageUrl}
                size={72}
                borderRadius={12}
              />
              <View style={{ flex: 1, justifyContent: "center", gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: TEXT_DARK,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {item.productDisplayName}
                  </Text>
                  {item.isComplete && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: PRIMARY_BG_SOFT,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: PRIMARY,
                        }}
                      >
                        {t("collection.complete")}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: TEXT_GRAY }}>
                  {t("collection.progress", {
                    collected: item.collectedCount,
                    total: item.totalVariants,
                  })}
                </Text>
                <ProgressBar
                  ratio={
                    item.totalVariants > 0
                      ? item.collectedCount / item.totalVariants
                      : 0
                  }
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
