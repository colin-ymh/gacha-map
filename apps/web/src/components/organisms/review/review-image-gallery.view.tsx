"use client";

import Image from "next/image";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon } from "@/components/atoms/icons";

// ── Styled ──────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.white};
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.gray600};
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: ${({ theme }) => theme.colors.gray900};
  }
`;

const HeaderTitle = styled.h2`
  flex: 1;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
`;

const CountText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  margin: 0;
  padding: 8px 16px;
  flex-shrink: 0;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: ${({ theme }) => theme.colors.border};
`;

const Cell = styled.div`
  aspect-ratio: 1;
  position: relative;
  background: ${({ theme }) => theme.colors.thumbnailPlaceholder};
  overflow: hidden;
`;

const EmptyText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
  text-align: center;
  padding: 40px 16px;
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface ReviewImageGalleryViewProps {
  images: string[];
  isLoading: boolean;
  onBack: () => void;
}

function toThumbUrl(url: string): string {
  return url.replace(/\.jpg(\?|$)/, "_thumb.jpg$1");
}

const ReviewImageGalleryView = ({
  images,
  isLoading,
  onBack,
}: ReviewImageGalleryViewProps) => {
  const t = useTranslations("review");

  return (
    <Container>
      <TopBar>
        <BackButton onClick={onBack}>
          <ArrowLeftIcon size={18} />
        </BackButton>
        <HeaderTitle>{t("viewPhotos")}</HeaderTitle>
        <div style={{ width: 26 }} />
      </TopBar>

      {!isLoading && (
        <CountText>{t("photoCount", { count: images.length })}</CountText>
      )}

      {isLoading ? (
        <EmptyText>{t("loading")}</EmptyText>
      ) : images.length === 0 ? (
        <EmptyText>{t("noPhotos")}</EmptyText>
      ) : (
        <Grid>
          {images.map((url, idx) => (
            <Cell key={idx}>
              <Image
                src={toThumbUrl(url)}
                alt={`gallery-${idx + 1}`}
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 375px) 33vw, 120px"
              />
            </Cell>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default ReviewImageGalleryView;
