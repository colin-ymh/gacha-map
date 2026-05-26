import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import type { Review } from "@/types/review";
import ReviewCardView from "./ReviewCard.view";

const CONTENT_CLAMP_THRESHOLD = 200;

interface ReviewCardProps {
  review: Review;
  currentUserId: string | null;
  onDelete: (reviewId: string) => void;
  onEdit: (review: Review) => void;
}

const ReviewCard = ({
  review,
  currentUserId,
  onDelete,
  onEdit,
}: ReviewCardProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );

  const isOwner = currentUserId === review.user_id;
  const isLong =
    review.content != null && review.content.length > CONTENT_CLAMP_THRESHOLD;

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleDelete = useCallback(() => {
    Alert.alert("", t("review.deleteConfirm"), [
      { text: t("review.formCancel"), style: "cancel" },
      {
        text: t("review.delete"),
        style: "destructive",
        onPress: () => onDelete(review.id),
      },
    ]);
  }, [onDelete, review.id, t]);

  const handleEdit = useCallback(() => {
    onEdit(review);
  }, [onEdit, review]);

  return (
    <ReviewCardView
      review={review}
      isOwner={isOwner}
      expanded={expanded}
      isLong={isLong}
      selectedImageIndex={selectedImageIndex}
      onToggleExpand={handleToggleExpand}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onImagePress={setSelectedImageIndex}
      onCloseImage={() => setSelectedImageIndex(null)}
    />
  );
};

export default ReviewCard;
