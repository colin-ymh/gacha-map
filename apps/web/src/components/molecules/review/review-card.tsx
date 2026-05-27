"use client";

import { useState } from "react";
import Image from "next/image";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { Review } from "@/types";

// ── Styled ──────────────────────────────────────────────────────────────────

const Card = styled.div`
  padding: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.gray200};
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
`;

const AvatarInitial = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.gray300};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray600};
  flex-shrink: 0;
`;

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const Nickname = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const DateText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
`;

const EditButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
  padding: 4px 6px;

  &:hover {
    color: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray400};
  padding: 4px 6px;

  &:hover {
    color: ${({ theme }) => theme.colors.dangerText};
  }
`;

const ContentText = styled.p<{ $clamped: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray700};
  line-height: 1.6;
  margin: 0 0 10px 0;
  white-space: pre-wrap;
  ${({ $clamped }) =>
    $clamped &&
    `
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
  padding: 0;
  margin-bottom: 10px;
`;

const ImageGrid = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
`;

const ThumbWrapper = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  background: ${({ theme }) => theme.colors.thumbnailPlaceholder};
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface ReviewCardProps {
  review: Review;
  currentUserId: string | null;
  onDelete: (reviewId: string) => void;
  onEdit?: (review: Review) => void;
}

const CONTENT_CLAMP_THRESHOLD = 180;

function toThumbUrl(url: string): string {
  return url.replace(/\.jpg(\?|$)/, "_thumb.jpg$1");
}

const ReviewCard = ({
  review,
  currentUserId,
  onDelete,
  onEdit,
}: ReviewCardProps) => {
  const t = useTranslations("review");
  const [expanded, setExpanded] = useState(false);

  const nickname = review.user?.nickname ?? "익명";
  const avatarUrl = review.user?.avatar_url ?? null;
  const initial = nickname.charAt(0).toUpperCase();

  const date = new Date(review.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isLong =
    review.content != null && review.content.length > CONTENT_CLAMP_THRESHOLD;
  const isOwner = currentUserId === review.user_id;

  return (
    <Card>
      <Header>
        {avatarUrl ? (
          <Avatar>
            <Image
              src={avatarUrl}
              alt={nickname}
              fill
              style={{ objectFit: "cover" }}
            />
          </Avatar>
        ) : (
          <AvatarInitial>{initial}</AvatarInitial>
        )}
        <UserInfo>
          <Nickname>{nickname}</Nickname>
          <DateText>{date}</DateText>
        </UserInfo>
        {isOwner && (
          <>
            {onEdit && (
              <EditButton onClick={() => onEdit(review)}>
                {t("edit")}
              </EditButton>
            )}
            <DeleteButton
              onClick={() => {
                if (window.confirm(t("deleteConfirm"))) {
                  onDelete(review.id);
                }
              }}
            >
              {t("delete")}
            </DeleteButton>
          </>
        )}
      </Header>

      {review.content && (
        <>
          <ContentText $clamped={isLong && !expanded}>
            {review.content}
          </ContentText>
          {isLong && (
            <ToggleButton onClick={() => setExpanded((p) => !p)}>
              {expanded ? t("showLess") : t("showMore")}
            </ToggleButton>
          )}
        </>
      )}

      {review.image_urls.length > 0 && (
        <ImageGrid>
          {review.image_urls.slice(0, 3).map((url, idx) => (
            <ThumbWrapper key={idx}>
              <Image
                src={toThumbUrl(url)}
                alt={`review-image-${idx + 1}`}
                fill
                style={{ objectFit: "cover" }}
                sizes="80px"
              />
            </ThumbWrapper>
          ))}
        </ImageGrid>
      )}
    </Card>
  );
};

export default ReviewCard;
