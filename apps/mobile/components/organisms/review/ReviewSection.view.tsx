import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import ReviewCard from "./ReviewCard";
import type { Review } from "@/types/review";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  BORDER,
  GRAY_200,
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
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
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
  container: {
    borderTopWidth: 6,
    borderTopColor: GRAY_200,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  loadMoreText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
});

export default ReviewSectionView;
