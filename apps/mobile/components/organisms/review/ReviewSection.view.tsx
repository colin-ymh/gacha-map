import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import ReviewCard from "./ReviewCard";
import { SkeletonBone, SkeletonCircle } from "@/components/ui/Skeleton";
import { GlassIconPill, type GlassIconPillAction } from "@/components/ui/LiquidGlass";
import type { Review } from "@/types/review";
import {
  PRIMARY,
  TEXT_GRAY,
  DANGER,
} from "@/constants/colors";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

interface ReviewSectionViewProps {
  reviews: Review[];
  hasMore: boolean;
  isLoading: boolean;
  currentUserId: string | null;
  onDelete: (reviewId: string) => void;
  onEdit: (review: Review) => void;
  onLoadMore: () => void;
}

const ReviewSectionView = ({
  reviews,
  hasMore,
  isLoading,
  currentUserId,
  onDelete,
  onEdit,
  onLoadMore,
}: ReviewSectionViewProps) => {
  const { t } = useTranslation();
  const [kebabAnchor, setKebabAnchor] = useState<{
    id: string;
    pageX: number;
    pageY: number;
  } | null>(null);
  const kebabReview = reviews.find((r) => r.id === kebabAnchor?.id) ?? null;

  const pillScale = useRef(new Animated.Value(0.85)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;

  const openKebab = (id: string, pageX: number, pageY: number) => {
    pillScale.setValue(0.85);
    pillOpacity.setValue(0);
    setKebabAnchor({ id, pageX, pageY });
    Animated.parallel([
      Animated.spring(pillScale, {
        toValue: 1,
        damping: 14,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.timing(pillOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeKebab = () => setKebabAnchor(null);

  return (
    <View style={styles.container}>
      {isLoading && reviews.length === 0 ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonReview}>
              {/* 헤더: 아바타 + 닉네임/뱃지 */}
              <View style={styles.skeletonHeader}>
                <SkeletonCircle size={38} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <SkeletonBone width="35%" height={15} style={{ marginBottom: 6 }} />
                  <SkeletonBone width="22%" height={20} style={{ borderRadius: 99 }} />
                </View>
              </View>
              {/* 풀너비 이미지 */}
              <SkeletonBone width={SCREEN_W} height={SCREEN_W} style={{ marginHorizontal: -14, borderRadius: 0 }} />
              {/* 텍스트 */}
              <View style={{ paddingTop: 12 }}>
                <SkeletonBone width="85%" height={14} style={{ marginBottom: 6 }} />
                <SkeletonBone width="60%" height={14} style={{ marginBottom: 10 }} />
                <SkeletonBone width="25%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t("review.noReviews")}</Text>
        </View>
      ) : (
        <View>
          {reviews.map((item) => (
            <ReviewCard
              key={item.id}
              review={item}
              currentUserId={currentUserId}
              onKebabOpen={openKebab}
            />
          ))}
          {isLoading && reviews.length > 0 && (
            <View style={styles.footer}>
              <ActivityIndicator color={PRIMARY} size="small" />
            </View>
          )}
          {hasMore && !isLoading && (
            <TouchableOpacity onPress={onLoadMore} style={styles.loadMoreBtn}>
              <Text style={styles.loadMoreText}>{t("review.loadMore")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={kebabAnchor !== null}
        transparent
        animationType="none"
        onRequestClose={closeKebab}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={closeKebab}
        />
        {kebabAnchor !== null && kebabReview !== null && (() => {
          const actions: GlassIconPillAction[] = [
            {
              icon: "create-outline",
              label: t("review.edit"),
              onPress: () => { onEdit(kebabReview); closeKebab(); },
            },
            {
              icon: "trash-outline",
              label: t("review.delete"),
              color: DANGER,
              onPress: () => {
                closeKebab();
                Alert.alert("", t("review.deleteConfirm"), [
                  { text: t("review.formCancel"), style: "cancel" },
                  {
                    text: t("review.delete"),
                    style: "destructive",
                    onPress: () => onDelete(kebabReview.id),
                  },
                ]);
              },
            },
          ];
          return (
            <Animated.View
              style={{
                position: "absolute",
                right: SCREEN_W - kebabAnchor.pageX + 8,
                top: Math.min(Math.max(kebabAnchor.pageY - 36, 80), SCREEN_H - 100),
                transform: [{ scale: pillScale }],
                opacity: pillOpacity,
              }}
            >
              <GlassIconPill actions={actions} />
            </Animated.View>
          );
        })()}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  center: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    paddingVertical: 12,
    alignItems: "center",
  },
  loadMoreBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  loadMoreText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  skeletonList: {},
  skeletonReview: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
    overflow: "hidden" as const,
  },
  skeletonHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 10,
  },
});

export default ReviewSectionView;
