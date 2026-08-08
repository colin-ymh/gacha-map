import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
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
import ImageViewerModal from "@/components/molecules/ImageViewerModal";
import { SkeletonBone } from "@/components/ui/Skeleton";
import {
  PRIMARY,
  PRIMARY_BG_SOFT,
  WHITE,
  TEXT_DARK,
  TEXT_GRAY,
  GRAY_100,
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
  const [showImageViewer, setShowImageViewer] = useState(false);

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
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <SkeletonBone width={64} height={64} borderRadius={12} />
            <SkeletonBone width="50%" height={20} borderRadius={6} />
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
          {/* 상품 정보 */}
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => setShowImageViewer(true)}
              disabled={!productImageUrl}
              activeOpacity={0.85}
            >
              <GachaItemThumb
                url={productImageUrl}
                size={64}
                borderRadius={12}
              />
            </TouchableOpacity>
            <Text
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: "700",
                color: TEXT_DARK,
                marginRight: detail.isComplete ? 52 : 0,
              }}
              numberOfLines={2}
            >
              {headerTitle}
            </Text>
            {detail.isComplete && (
              <View
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  paddingHorizontal: 8,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: PRIMARY_BG_SOFT,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "600", color: PRIMARY }}
                >
                  {t("collection.complete")}
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

      {productImageUrl && (
        <ImageViewerModal
          images={[productImageUrl]}
          initialIndex={0}
          visible={showImageViewer}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </View>
  );
}
