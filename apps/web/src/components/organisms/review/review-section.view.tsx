"use client";

import { useRef, useEffect } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import ReviewCard from "@/components/molecules/review/review-card";
import type { Review } from "@/types";

// ── Styled ──────────────────────────────────────────────────────────────────

const Section = styled.section`
  display: flex;
  flex-direction: column;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-top: 6px solid ${({ theme }) => theme.colors.gray100};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  gap: 8px;
`;

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
  flex: 1;
`;

const GalleryButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  padding: 4px 10px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray600};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const WriteButton = styled.button`
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 6px;
  padding: 5px 12px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  line-height: 1;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.white};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const EmptyText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  text-align: center;
  padding: 32px 16px;
  line-height: 1.6;
`;

const LoadMoreTrigger = styled.div`
  height: 1px;
`;

const LoadingText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  text-align: center;
  padding: 12px;
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface ReviewSectionViewProps {
  reviews: Review[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  currentUserId: string | null;
  onOpenGallery: () => void;
  onOpenForm: () => void;
  onDeleteReview: (reviewId: string) => void;
  onEditReview: (review: Review) => void;
  onLoadMore: () => void;
}

const ReviewSectionView = ({
  reviews,
  total,
  hasMore,
  isLoading,
  currentUserId,
  onOpenGallery,
  onOpenForm,
  onDeleteReview,
  onEditReview,
  onLoadMore,
}: ReviewSectionViewProps) => {
  const t = useTranslations("review");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>{t("reviewCount", { count: total })}</SectionTitle>
        <GalleryButton onClick={onOpenGallery}>{t("viewPhotos")}</GalleryButton>
        <WriteButton onClick={onOpenForm}>{t("writeReview")}</WriteButton>
      </SectionHeader>

      {!isLoading && reviews.length === 0 ? (
        <EmptyText>{t("noReviews")}</EmptyText>
      ) : (
        reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            currentUserId={currentUserId}
            onDelete={onDeleteReview}
            onEdit={onEditReview}
          />
        ))
      )}

      {hasMore && <LoadMoreTrigger ref={sentinelRef} />}
      {isLoading && <LoadingText>{t("loading")}</LoadingText>}
    </Section>
  );
};

export default ReviewSectionView;
