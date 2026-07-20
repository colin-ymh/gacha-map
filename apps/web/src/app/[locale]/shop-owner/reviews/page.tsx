"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "@/types";
import ReviewReportModal from "@/components/organisms/shop-owner/review-report-modal";

// ── Styled Components ────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  padding-bottom: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Table = styled.div`
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr 160px 120px 100px;
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.gray50};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TableHeaderCell = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textGray};
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr 160px 120px 100px;
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  align-items: center;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray50};
  }
`;

const AuthorCell = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Avatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background-color: ${({ theme }) => theme.colors.gray200};
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const AuthorName = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
`;

const ContentCell = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ImageTag = styled.span`
  display: inline-block;
  padding: 3px 8px;
  background-color: ${({ theme }) => theme.colors.gray100};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
`;

const DateCell = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const EmptyText = styled.p`
  padding: 32px;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const ReportButton = styled.button`
  padding: 6px 10px;
  background-color: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryBg};
  }
`;

const ReportedLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
`;

const LoadMoreBtn = styled.button`
  align-self: center;
  padding: 10px 32px;
  background-color: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textDark};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.colors.gray50};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

// ── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ShopOwnerReviewsPage() {
  const t = useTranslations("shopOwner.reviews");
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const fetchReviews = useCallback(
    async (currentOffset: number, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const res = await fetch(
        `/api/shop-owner/reviews?offset=${currentOffset}&limit=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );

      if (!res.ok) {
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      const data = await res.json();
      const newReviews: Review[] = (data.reviews ?? []).map(
        (
          r: Review & {
            user_profiles?: {
              nickname: string | null;
              avatar_url: string | null;
            };
          },
        ) => ({
          ...r,
          user: r.user_profiles ?? r.user ?? null,
        }),
      );

      if (append) {
        setReviews((prev) => [...prev, ...newReviews]);
      } else {
        setReviews(newReviews);
      }

      setTotal(data.total ?? 0);
      setOffset(currentOffset + newReviews.length);
      setIsLoading(false);
      setIsLoadingMore(false);
    },
    [router],
  );

  useEffect(() => {
    queueMicrotask(() => fetchReviews(0, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMore = offset < total;

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <Container>
      <Title>{t("title")}</Title>

      <Table>
        <TableHeader>
          <TableHeaderCell>{t("author")}</TableHeaderCell>
          <TableHeaderCell>{t("content")}</TableHeaderCell>
          <TableHeaderCell>{t("images")}</TableHeaderCell>
          <TableHeaderCell>{t("date")}</TableHeaderCell>
          <TableHeaderCell>{t("reportBtn")}</TableHeaderCell>
        </TableHeader>

        {reviews.length === 0 ? (
          <EmptyText>{t("empty")}</EmptyText>
        ) : (
          reviews.map((review) => (
            <TableRow key={review.id}>
              <AuthorCell>
                <Avatar>
                  {review.user?.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={review.user.avatar_url} alt="" />
                  )}
                </Avatar>
                <AuthorName>
                  {review.user?.nickname ?? review.user_id.slice(0, 8)}
                </AuthorName>
              </AuthorCell>
              <ContentCell>{review.content ?? ""}</ContentCell>
              <div>
                {review.image_urls.length > 0 ? (
                  <ImageTag>
                    {t("imageCount", { count: review.image_urls.length })}
                  </ImageTag>
                ) : (
                  <ImageTag>{t("noImages")}</ImageTag>
                )}
              </div>
              <DateCell>{formatDate(review.created_at)}</DateCell>
              <div>
                {reportedIds.has(review.id) ? (
                  <ReportedLabel>{t("reportedLabel")}</ReportedLabel>
                ) : (
                  <ReportButton
                    type="button"
                    onClick={() => setReportTargetId(review.id)}
                  >
                    {t("reportBtn")}
                  </ReportButton>
                )}
              </div>
            </TableRow>
          ))
        )}
      </Table>

      {hasMore && (
        <LoadMoreBtn
          onClick={() => fetchReviews(offset, true)}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? t("loading") : t("loadMore")}
        </LoadMoreBtn>
      )}

      <ReviewReportModal
        reviewId={reportTargetId}
        onClose={() => setReportTargetId(null)}
        onSubmitted={() => {
          if (reportTargetId) {
            setReportedIds((prev) => new Set(prev).add(reportTargetId));
          }
          setReportTargetId(null);
        }}
      />
    </Container>
  );
}
