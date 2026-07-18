"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type {
  ShopGachaProduct,
  ShopGachaProductAvailability,
  QuickReportKind,
} from "@gacha-map/shared";
import QuickReportButtons from "@/components/molecules/gacha/QuickReportButtons";

// ── Styled ────────────────────────────────────────────────────────────────────

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

const ReportButton = styled.button`
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
`;

const LoadingText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  text-align: center;
  padding: 12px;
`;

const ProductRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Thumbnail = styled.div<{ $src?: string | null }>`
  width: 52px;
  height: 52px;
  border-radius: 8px;
  flex-shrink: 0;
  background: ${({ $src, theme }) =>
    $src ? `url(${$src}) center/cover no-repeat` : theme.colors.gray100};
`;

const ProductInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const ProductName = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Manufacturer = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
`;

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
`;

type BadgeVariant = "available" | "seen" | "default";

const Badge = styled.span<{ $variant: BadgeVariant }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme, $variant }) => {
    if ($variant === "available") return theme.colors.successBg;
    if ($variant === "seen") return theme.colors.infoBg;
    return theme.colors.gray100;
  }};
  color: ${({ theme, $variant }) => {
    if ($variant === "available") return theme.colors.successText;
    if ($variant === "seen") return theme.colors.infoText;
    return theme.colors.textGray;
  }};
`;

const Price = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
  margin-top: 2px;
`;

const ActionCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  text-decoration: underline;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  text-decoration: underline;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: ${({ theme }) => theme.colors.dangerText};
  }
`;

const UnavailableByText = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  margin-top: 2px;
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusVariant(status: ShopGachaProductAvailability): BadgeVariant {
  if (status === "available") return "available";
  if (status === "seen") return "seen";
  return "default";
}

function statusKey(status: ShopGachaProductAvailability): string {
  const map: Record<ShopGachaProductAvailability, string> = {
    available: "statusAvailable",
    seen: "statusSeen",
    sold_out: "statusSoldOut",
    unknown: "statusUnknown",
  };
  return map[status];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GachaSectionViewProps {
  products: ShopGachaProduct[];
  isLoading: boolean;
  isLoggedIn: boolean;
  onReportPress: () => void;
  onDelete: (recordId: string) => void;
  onToggleUnavailable: (recordId: string) => void;
  userQuickReport: QuickReportKind | null;
  locationEnabled: boolean;
  quickReportSubmitting: boolean;
  onQuickReport: (kind: QuickReportKind) => void;
}

const GachaSectionView = ({
  products,
  isLoading,
  isLoggedIn,
  onReportPress,
  onDelete,
  onToggleUnavailable,
  userQuickReport,
  locationEnabled,
  quickReportSubmitting,
  onQuickReport,
}: GachaSectionViewProps) => {
  const t = useTranslations("gacha");

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          {t("productCount", { count: products.length })}
        </SectionTitle>
        <ReportButton onClick={onReportPress}>{t("reportBtn")}</ReportButton>
      </SectionHeader>

      {!isLoading && products.length === 0 && userQuickReport === null && (
        <QuickReportButtons
          locationEnabled={locationEnabled}
          alreadyReported={false}
          submitting={quickReportSubmitting}
          onReport={onQuickReport}
        />
      )}
      {!isLoading && products.length === 0 && userQuickReport !== null && (
        <EmptyText>{t("noProducts")}</EmptyText>
      )}

      {isLoading ? (
        <LoadingText>{t("loading")}</LoadingText>
      ) : (
        products.map((item) => {
          const canDelete =
            isLoggedIn && item.is_mine && item.verified_at === null;

          return (
            <ProductRow key={item.id}>
              <Thumbnail $src={item.gacha_product.official_image_url} />
              <ProductInfo>
                <ProductName>
                  {item.gacha_product.name_ko ??
                    item.gacha_product.name_ja ??
                    item.gacha_product.name}
                </ProductName>
                <Manufacturer>{item.gacha_product.manufacturer}</Manufacturer>
                <Badges>
                  <Badge $variant={getStatusVariant(item.availability_status)}>
                    {t(statusKey(item.availability_status))}
                  </Badge>
                  {item.source === "shop_owner" && (
                    <Badge $variant="default">{t("badgeOwner")}</Badge>
                  )}
                </Badges>
                {item.price_krw != null && (
                  <Price>
                    {t("priceKrw", {
                      price: item.price_krw.toLocaleString(),
                    })}
                  </Price>
                )}
                {item.reported_by_nickname && (
                  <UnavailableByText>
                    {item.reported_by_nickname}님 제보
                  </UnavailableByText>
                )}
                {item.availability_status === "sold_out" &&
                  item.unavailable_by_nickname && (
                    <UnavailableByText>
                      {item.unavailable_by_nickname}님이 없음 표시
                    </UnavailableByText>
                  )}
              </ProductInfo>
              <ActionCol>
                {isLoggedIn && (
                  <ToggleButton onClick={() => onToggleUnavailable(item.id)}>
                    {item.availability_status === "sold_out" ? "있음" : "없음"}
                  </ToggleButton>
                )}
                {canDelete && (
                  <DeleteButton onClick={() => onDelete(item.id)}>
                    {t("deleteBtn")}
                  </DeleteButton>
                )}
              </ActionCol>
            </ProductRow>
          );
        })
      )}
    </Section>
  );
};

export default GachaSectionView;
