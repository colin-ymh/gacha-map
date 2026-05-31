"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import type { Review } from "@/types";
import ReviewSectionView from "./review-section.view";
import ReviewForm from "./review-form";
import ReviewImageGallery from "./review-image-gallery";

interface ReviewSectionProps {
  shopId: string;
}

const PAGE_LIMIT = 10;

const ReviewSection = ({ shopId }: ReviewSectionProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const userId = useAppSelector((s) => s.auth.user?.id ?? null);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number) => {
      try {
        const res = await fetch(
          `/api/shops/${shopId}/reviews?page=${pageNum}&limit=${PAGE_LIMIT}`,
        );
        const data = await res.json();
        setReviews((prev) =>
          pageNum === 0 ? data.reviews : [...prev, ...data.reviews],
        );
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setPage(pageNum);
      } finally {
        setIsLoading(false);
      }
    },
    [shopId],
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setIsLoading(true);
      fetchPage(page + 1);
    }
  }, [fetchPage, hasMore, isLoading, page]);

  const handleOpenForm = useCallback(() => {
    if (!isLoggedIn) {
      alert("리뷰 작성은 로그인이 필요합니다.");
      return;
    }
    setEditingReview(null);
    setIsFormOpen(true);
  }, [isLoggedIn]);

  const handleEditReview = useCallback((review: Review) => {
    setEditingReview(review);
    setIsFormOpen(true);
  }, []);

  const handleReviewCreated = useCallback((review: Review) => {
    setIsFormOpen(false);
    setEditingReview(null);
    setReviews((prev) => [review, ...prev]);
    setTotal((prev) => prev + 1);
  }, []);

  const handleReviewUpdated = useCallback((updated: Review) => {
    setIsFormOpen(false);
    setEditingReview(null);
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  const handleDeleteReview = useCallback(
    async (reviewId: string) => {
      const snapshot = reviews;
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setTotal((prev) => Math.max(0, prev - 1));
      try {
        const res = await fetch(`/api/reviews/${reviewId}`, {
          method: "DELETE",
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
    <>
      <ReviewSectionView
        reviews={reviews}
        total={total}
        hasMore={hasMore}
        isLoading={isLoading}
        currentUserId={userId}
        onOpenGallery={() => setIsGalleryOpen(true)}
        onOpenForm={handleOpenForm}
        onDeleteReview={handleDeleteReview}
        onEditReview={handleEditReview}
        onLoadMore={handleLoadMore}
      />

      {isFormOpen && (
        <ReviewForm
          shopId={shopId}
          editMode={!!editingReview}
          initialReview={editingReview ?? undefined}
          onSuccess={editingReview ? handleReviewUpdated : handleReviewCreated}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingReview(null);
          }}
        />
      )}

      {isGalleryOpen && (
        <ReviewImageGallery
          shopId={shopId}
          onBack={() => setIsGalleryOpen(false)}
        />
      )}
    </>
  );
};

export default ReviewSection;
