"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminReportItem } from "@/types";
import ShopAddForm from "./shop-add-form";

// ── Styled ────────────────────────────────────────────────────────────────────

const PanelWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  height: 100%;
  overflow-y: auto;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
  text-align: center;
`;

const PanelTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.lg};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textGray};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-bottom: 6px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const InfoRow = styled.div`
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px;
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const InfoLabel = styled.span`
  color: ${({ theme }) => theme.colors.textGray};
  flex-shrink: 0;
`;

const InfoValue = styled.span`
  color: ${({ theme }) => theme.colors.textDark};
  word-break: break-all;
`;

const ContentBox = styled.div`
  padding: 10px 12px;
  background-color: ${({ theme }) => theme.colors.gray50};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  line-height: 1.6;
  white-space: pre-wrap;
`;

const MapLink = styled.a`
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSize.sm};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-block;
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme, $status }) => {
    switch ($status) {
      case "pending":
        return theme.colors.infoBg;
      case "reviewed":
        return theme.colors.successBg;
      default:
        return theme.colors.gray100;
    }
  }};
  color: ${({ theme, $status }) => {
    switch ($status) {
      case "pending":
        return theme.colors.infoText;
      case "reviewed":
        return theme.colors.successText;
      default:
        return theme.colors.textGray;
    }
  }};
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  flex: 1;
  padding: 10px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  background-color: ${({ theme }) => theme.colors.primaryBg};
  color: ${({ theme }) => theme.colors.primary};

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ResolveButton = styled(ActionButton)`
  background-color: ${({ theme }) => theme.colors.gray100};
  color: ${({ theme }) => theme.colors.textGray};

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray400};
    color: ${({ theme }) => theme.colors.white};
  }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportDetailPanelViewProps {
  report: AdminReportItem | null;
  processingId: string | null;
  showShopForm: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onShopAdded: () => void;
}

// ── View ──────────────────────────────────────────────────────────────────────

const ReportDetailPanelView = ({
  report,
  processingId,
  showShopForm,
  onApprove,
  onReject,
  onShopAdded,
}: ReportDetailPanelViewProps) => {
  const t = useTranslations("admin.reports");

  if (!report) {
    return (
      <PanelWrapper>
        {showShopForm ? (
          <ShopAddForm report={null} onSuccess={onShopAdded} />
        ) : (
          <EmptyState>{t("detail.noSelection")}</EmptyState>
        )}
      </PanelWrapper>
    );
  }

  const isProcessing = processingId === report.id;
  const hasProposed =
    report.proposed_shop_name ||
    report.proposed_address ||
    report.proposed_lat != null;

  return (
    <PanelWrapper>
      <PanelTitle>{t("detail.title")}</PanelTitle>

      <Section>
        <InfoRow>
          <InfoLabel>{t("tableType")}</InfoLabel>
          <InfoValue>
            {report.report_type === "new_shop" && t("typeNewShop")}
            {report.report_type === "fix_info" && t("typeFixInfo")}
            {report.report_type === "closed" && t("typeClosed")}
            {report.report_type === "other" && t("typeOther")}
          </InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>{t("tableStatus")}</InfoLabel>
          <InfoValue>
            <StatusBadge $status={report.status}>
              {report.status === "pending" && t("statusPending")}
              {report.status === "reviewed" && t("statusReviewed")}
              {report.status === "resolved" && t("statusResolved")}
            </StatusBadge>
          </InfoValue>
        </InfoRow>
        {report.shop_name && (
          <InfoRow>
            <InfoLabel>{t("detail.shopName")}</InfoLabel>
            <InfoValue>{report.shop_name}</InfoValue>
          </InfoRow>
        )}
        <InfoRow>
          <InfoLabel>{t("tableDate")}</InfoLabel>
          <InfoValue>
            {new Date(report.created_at).toLocaleDateString("ko-KR")}
          </InfoValue>
        </InfoRow>
      </Section>

      <Section>
        <SectionTitle>{t("detail.content")}</SectionTitle>
        <ContentBox>{report.content}</ContentBox>
      </Section>

      <Section>
        <SectionTitle>{t("detail.reporterSection")}</SectionTitle>
        {report.user_id ? (
          <>
            <InfoRow>
              <InfoLabel>{t("detail.userNickname")}</InfoLabel>
              <InfoValue>{report.user_nickname ?? "-"}</InfoValue>
            </InfoRow>
            <InfoRow>
              <InfoLabel>{t("detail.userEmail")}</InfoLabel>
              <InfoValue>{report.user_email ?? "-"}</InfoValue>
            </InfoRow>
            <InfoRow>
              <InfoLabel>{t("detail.userJoinDate")}</InfoLabel>
              <InfoValue>
                {report.user_created_at
                  ? new Date(report.user_created_at).toLocaleDateString("ko-KR")
                  : "-"}
              </InfoValue>
            </InfoRow>
          </>
        ) : (
          <>
            <InfoRow>
              <InfoLabel>{t("detail.anonName")}</InfoLabel>
              <InfoValue>{report.reporter_name ?? "-"}</InfoValue>
            </InfoRow>
            <InfoRow>
              <InfoLabel>{t("detail.anonContact")}</InfoLabel>
              <InfoValue>{report.reporter_contact ?? "-"}</InfoValue>
            </InfoRow>
          </>
        )}
      </Section>

      {hasProposed && (
        <Section>
          <SectionTitle>{t("detail.proposedInfo")}</SectionTitle>
          {report.proposed_shop_name && (
            <InfoRow>
              <InfoLabel>{t("detail.proposedName")}</InfoLabel>
              <InfoValue>{report.proposed_shop_name}</InfoValue>
            </InfoRow>
          )}
          {report.proposed_address && (
            <InfoRow>
              <InfoLabel>{t("detail.proposedAddress")}</InfoLabel>
              <InfoValue>{report.proposed_address}</InfoValue>
            </InfoRow>
          )}
          {report.proposed_lat != null && report.proposed_lng != null && (
            <InfoRow>
              <InfoLabel>{t("detail.mapLink")}</InfoLabel>
              <InfoValue>
                <MapLink
                  href={`https://map.naver.com/v5/?c=${report.proposed_lng},${report.proposed_lat},15,0,0,0,dh`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("detail.mapLink")}
                </MapLink>
              </InfoValue>
            </InfoRow>
          )}
        </Section>
      )}

      {report.status === "pending" && (
        <ActionRow>
          <ActionButton
            disabled={isProcessing}
            onClick={() => onApprove(report.id)}
          >
            {t("markReviewed")}
          </ActionButton>
          <ResolveButton
            disabled={isProcessing}
            onClick={() => onReject(report.id)}
          >
            {t("markResolved")}
          </ResolveButton>
        </ActionRow>
      )}

      {showShopForm && (
        <>
          <Divider />
          <ShopAddForm report={report} onSuccess={onShopAdded} />
        </>
      )}
    </PanelWrapper>
  );
};

export default ReportDetailPanelView;
