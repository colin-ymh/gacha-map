import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import type { Review } from "@/types/review";
import ReviewSectionView from "./ReviewSection.view";

const PAGE_LIMIT = 10;
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

interface ReviewSectionProps {
  shopId: string;
  currentUserId: string | null;
  onWritePress: () => void;
  onGalleryPress: () => void;
  onEditPress: (review: Review) => void;
}

const ReviewSection = ({
  shopId,
  currentUserId,
  onWritePress,
  onGalleryPress,
  onEditPress,
}: ReviewSectionProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPage = useCallback(
    async (pageNum: number, signal?: AbortSignal) => {
      try {
        const res = await fetch(
          `${API_BASE}/api/shops/${shopId}/reviews?page=${pageNum}&limit=${PAGE_LIMIT}`,
          { signal },
        );
        if (signal?.aborted) return;
        const data = await res.json();
        setReviews((prev) =>
          pageNum === 0
            ? (data.reviews ?? [])
            : [...prev, ...(data.reviews ?? [])],
        );
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setPage(pageNum);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [shopId],
  );

  // 화면 포커스 시 첫 페이지 재조회 (review-form에서 돌아올 때 목록 갱신)
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      setIsLoading(true);
      fetchPage(0, controller.signal);
      return () => controller.abort();
    }, [fetchPage]),
  );

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setIsLoading(true);
      fetchPage(page + 1);
    }
  }, [fetchPage, hasMore, isLoading, page]);

  const handleDelete = useCallback(
    async (reviewId: string) => {
      const snapshot = reviews;
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setTotal((prev) => Math.max(0, prev - 1));
      try {
        const { getAuthHeaders } = await import("@/lib/supabase");
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/reviews/${reviewId}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok && res.status !== 204) {
          setReviews(snapshot);
          setTotal((prev) => prev + 1);
        }
      } catch {
        setReviews(snapshot);
        setTotal((prev) => prev + 1);
      }
    },
    [reviews],
  );

  return (
    <ReviewSectionView
      reviews={reviews}
      total={total}
      hasMore={hasMore}
      isLoading={isLoading}
      currentUserId={currentUserId}
      onWritePress={onWritePress}
      onGalleryPress={onGalleryPress}
      onDelete={handleDelete}
      onEdit={onEditPress}
      onLoadMore={handleLoadMore}
    />
  );
};

export default ReviewSection;
