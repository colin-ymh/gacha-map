import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { GRAY_100, TEXT_DARK, TEXT_GRAY } from "@/constants/colors";
import GachaPlaceholder from "@/components/ui/GachaPlaceholder";
import { SkeletonBone } from "@/components/ui/Skeleton";

const PREVIEW_THUMB_SIZE = 40;
const THUMB_RADIUS = 8;

interface Props {
  name: string;
  imageUrl: string | null;
  productCount: number;
  childCount?: number;
  preview?: boolean;
  onPress: () => void;
}

/** URL별로 오류 상태를 격리해 목록 재사용·URL 변경 시 이미지를 다시 시도한다. */
function Thumbnail({
  imageUrl,
  preview,
}: {
  imageUrl: string | null;
  preview: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const size = preview ? PREVIEW_THUMB_SIZE : 48;

  return (
    <View
      style={[styles.thumb, { width: size, height: size }]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {imageUrl && !failed ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : (
        <GachaPlaceholder size={size} borderRadius={THUMB_RADIUS} />
      )}
    </View>
  );
}

export function BrowseListRow({
  name,
  imageUrl,
  productCount,
  childCount,
  preview = false,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const productLabel = t("browse.productCount", {
    count: productCount,
    defaultValue: `상품 ${productCount}개`,
  });
  const childLabel =
    childCount != null && childCount > 0
      ? t("browse.series.childCount", {
          count: childCount,
          defaultValue: `하위 ${childCount}`,
        })
      : null;
  const subtitle = childLabel ? `${productLabel} · ${childLabel}` : productLabel;

  return (
    <Pressable
      style={[styles.row, preview && styles.previewRow]}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subtitle}`}
    >
      <Thumbnail key={imageUrl} imageUrl={imageUrl} preview={preview} />
      <View style={styles.text}>
        <Text
          style={[styles.name, preview && styles.previewName]}
          numberOfLines={preview ? 2 : 1}
        >
          {name}
        </Text>
        <Text style={[styles.subtitle, preview && styles.previewSubtitle]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export function BrowseListRowSkeleton({ nameWidth }: { nameWidth: number }) {
  return (
    <View style={[styles.row, styles.previewRow]}>
      <SkeletonBone
        width={PREVIEW_THUMB_SIZE}
        height={PREVIEW_THUMB_SIZE}
        borderRadius={THUMB_RADIUS}
      />
      <View style={styles.skeletonText}>
        <SkeletonBone width={nameWidth} height={14} style={styles.skeletonLine} />
        <SkeletonBone
          width={56}
          height={10}
          borderRadius={5}
          style={styles.skeletonLine}
        />
      </View>
    </View>
  );
}

export function BrowseListSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewRow: {
    minHeight: 64,
    paddingHorizontal: 0,
    paddingVertical: 12,
    gap: 10,
  },
  thumb: {
    borderRadius: THUMB_RADIUS,
    backgroundColor: GRAY_100,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  text: { flex: 1, minWidth: 0, gap: 4 },
  skeletonText: { flex: 1, minWidth: 0, gap: 6 },
  skeletonLine: { maxWidth: "100%" },
  name: { fontSize: 14, fontWeight: "700", color: TEXT_DARK },
  subtitle: { fontSize: 11, fontWeight: "400", color: TEXT_GRAY },
  previewName: { fontWeight: "600", lineHeight: 20 },
  previewSubtitle: { fontSize: 12, lineHeight: 16 },
  separator: {
    height: 1,
    backgroundColor: GRAY_100,
    marginLeft: 76,
    marginRight: 16,
  },
});
