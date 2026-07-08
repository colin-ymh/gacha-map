import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import ReviewCard from "./ReviewCard";
import { SkeletonBone, SkeletonCircle } from "@/components/ui/Skeleton";
import type { Review } from "@/types/review";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  BORDER,
  WHITE,
} from "@/constants/colors";

interface ReviewSectionViewProps {
  reviews: Review[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  currentUserId: string | null;
  onWritePress: () => void;
  onGalleryPress: () => void;
  onDelete: (reviewId: string) => void;
  onEdit: (review: Review) => void;
  onLoadMore: () => void;
}

const ReviewSectionView = ({
  reviews,
  total,
  hasMore,
  isLoading,
  currentUserId,
  onWritePress,
  onGalleryPress,
  onDelete,
  onEdit,
  onLoadMore,
}: ReviewSectionViewProps) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {t("review.reviewCount", { count: total })}
        </Text>
        <TouchableOpacity onPress={onGalleryPress} style={styles.galleryBtn}>
          <Text style={styles.galleryBtnText}>{t("review.viewPhotos")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onWritePress} style={styles.writeBtn}>
          <Text style={styles.writeBtnText}>{t("review.writeReview")}</Text>
        </TouchableOpacity>
      </View>

      {/* 목록 */}
      {isLoading && reviews.length === 0 ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonReview}>
              <View style={styles.skeletonHeader}>
                <SkeletonCircle size={36} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <SkeletonBone
                    width="40%"
                    height={14}
                    style={{ marginBottom: 4 }}
                  />
                  <SkeletonBone width="25%" height={11} />
                </View>
              </View>
              <SkeletonBone
                width="90%"
                height={13}
                style={{ marginTop: 8, marginBottom: 4 }}
              />
              <SkeletonBone width="70%" height={13} />
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
              onDelete={onDelete}
              onEdit={onEdit}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  galleryBtn: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  galleryBtnText: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  writeBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  writeBtnText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: WHITE,
  },
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
  skeletonList: {
    paddingVertical: 8,
  },
  skeletonReview: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skeletonHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
});

export default ReviewSectionView;
