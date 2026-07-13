import { useState, useCallback } from "react";
import type { Review } from "@/types/review";
import ReviewCardView from "./ReviewCard.view";

const CONTENT_CLAMP_THRESHOLD = 200;

interface ReviewCardProps {
  review: Review;
  currentUserId: string | null;
  onKebabOpen: (reviewId: string, pageX: number, pageY: number) => void;
}

const ReviewCard = ({
  review,
  currentUserId,
  onKebabOpen,
}: ReviewCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const isOwner = currentUserId === review.user_id;
  const isLong = review.content != null && review.content.length > CONTENT_CLAMP_THRESHOLD;

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleKebabOpen = useCallback(
    (pageX: number, pageY: number) => {
      onKebabOpen(review.id, pageX, pageY);
    },
    [onKebabOpen, review.id],
  );

  return (
    <ReviewCardView
      review={review}
      isOwner={isOwner}
      expanded={expanded}
      isLong={isLong}
      selectedImageIndex={selectedImageIndex}
      onToggleExpand={handleToggleExpand}
      onKebabOpen={handleKebabOpen}
      onImagePress={setSelectedImageIndex}
      onCloseImage={() => setSelectedImageIndex(null)}
    />
  );
};

export default ReviewCard;
