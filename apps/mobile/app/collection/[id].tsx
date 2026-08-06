import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type {
  GachaCollectionDetail,
  GachaCollectionVariant,
} from "@gacha-map/shared";
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
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCROLL_PAD = 16;
const CARD_PAD = 16;
const GRID_GAP = 12;
const GRID_COLS = 3;
const GRID_ITEM_W =
  (SCREEN_WIDTH - SCROLL_PAD * 2 - CARD_PAD * 2 - GRID_GAP * 2) / GRID_COLS;

function VariantCell({ variant }: { variant: GachaCollectionVariant }) {
  const { t } = useTranslation();
  if (!variant.collected) {
    return (
      <View style={{ width: GRID_ITEM_W, alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: GRID_ITEM_W,
            height: GRID_ITEM_W,
            borderRadius: 12,
            backgroundColor: GRAY_100,
            opacity: 0.5,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: Math.round(GRID_ITEM_W * 0.32) }}>🔒</Text>
        </View>
        <Text
          style={{ fontSize: 11, color: TEXT_GRAY, opacity: 0.5 }}
          numberOfLines={1}
        >
          {t("collection.lockedName")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width: GRID_ITEM_W, alignItems: "center", gap: 8 }}>
      <View style={{ width: GRID_ITEM_W, height: GRID_ITEM_W }}>
        <GachaItemThumb
          url={variant.variantImageUrl}
          size={GRID_ITEM_W}
          borderRadius={12}
        />
        <View
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 4,
            borderRadius: 10,
            backgroundColor: PRIMARY,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: WHITE }}>
            x{variant.count}
          </Text>
        </View>
      </View>
      <Text
        style={{ fontSize: 11, color: TEXT_GRAY, maxWidth: GRID_ITEM_W }}
        numberOfLines={1}
      >
        {variant.variantNameKo ?? variant.variantName}
      </Text>
    </View>
  );
}

export default function CollectionDetailScreen() {
  const { id, title, imageUrl } = useLocalSearchParams<{
    id: string;
    title?: string;
    imageUrl?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [detail, setDetail] = useState<GachaCollectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const headerTitle = title ? decodeURIComponent(title) : "";
  const productImageUrl = imageUrl
    ? decodeURIComponent(imageUrl) || null
    : null;

  const load = useCallback(async () => {
    if (!API_BASE || !id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/api/gacha-products/${id}/collection`,
        { headers },
      );
      if (res.ok) setDetail(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const rows: GachaCollectionVariant[][] = [];
  if (detail) {
    for (let i = 0; i < detail.variants.length; i += GRID_COLS) {
      rows.push(detail.variants.slice(i, i + GRID_COLS));
    }
  }

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
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: insets.top + 8,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9,
        }}
      >
        <Text
          style={{ fontSize: 17, fontWeight: "600", color: TEXT_DARK }}
          numberOfLines={1}
        >
          {headerTitle}
        </Text>
      </View>

      {isLoading || !detail ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 60,
            paddingHorizontal: SCROLL_PAD,
            paddingBottom: insets.bottom + 20,
            gap: 12,
          }}
        >
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 16,
              padding: 20,
              gap: 12,
              alignItems: "center",
            }}
          >
            <SkeletonBone width={88} height={88} borderRadius={16} />
            <SkeletonBone width="50%" height={20} borderRadius={6} />
            <SkeletonBone width="100%" height={8} borderRadius={4} />
          </View>
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 16,
              padding: CARD_PAD,
              gap: 16,
            }}
          >
            <SkeletonBone width={80} height={13} borderRadius={4} />
            <View style={{ flexDirection: "row", gap: GRID_GAP }}>
              {[0, 1, 2].map((i) => (
                <SkeletonBone
                  key={i}
                  width={GRID_ITEM_W}
                  height={GRID_ITEM_W}
                  borderRadius={12}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 60,
            paddingHorizontal: SCROLL_PAD,
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
          {/* 진행률 요약 */}
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 16,
              padding: 20,
              gap: 12,
              alignItems: "center",
            }}
          >
            <GachaItemThumb url={productImageUrl} size={88} borderRadius={16} />
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: TEXT_DARK,
                textAlign: "center",
              }}
            >
              {t("collection.progress", {
                collected: detail.collectedCount,
                total: detail.totalVariants,
              })}
            </Text>
            <View
              style={{
                width: "100%",
                height: 8,
                borderRadius: 4,
                backgroundColor: GRAY_200,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${detail.totalVariants > 0 ? Math.round((detail.collectedCount / detail.totalVariants) * 100) : 0}%`,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: PRIMARY,
                }}
              />
            </View>
            {detail.isComplete && (
              <View
                style={{
                  width: "100%",
                  backgroundColor: PRIMARY_BG_SOFT,
                  borderRadius: 12,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: PRIMARY }}
                >
                  {t("collection.completeBanner")}
                </Text>
              </View>
            )}
          </View>

          {/* 전체 상품 그리드 */}
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 16,
              padding: CARD_PAD,
              gap: 16,
            }}
          >
            <Text style={{ fontSize: 13, color: TEXT_GRAY }}>
              {t("collection.gridTitle")}
            </Text>
            {rows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={{ flexDirection: "row", gap: GRID_GAP }}
              >
                {row.map((variant) => (
                  <VariantCell key={variant.variantId} variant={variant} />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
