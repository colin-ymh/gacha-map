"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminReviewReportItem } from "@/types";

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

const ImageGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ImageThumb = styled.img`
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
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
      case "approved":
        return theme.colors.successBg;
      default:
        return theme.colors.gray100;
    }
  }};
  color: ${({ theme, $status }) => {
    switch ($status) {
      case "pending":
        return theme.colors.infoText;
      case "approved":
        return theme.colors.successText;
      default:
        return theme.colors.textGray;
    }
  }};
`;

const DeletedBadge = styled.span`
  display: inline-block;
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};
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

const RejectButton = styled(ActionButton)`
  background-color: ${({ theme }) => theme.colors.gray100};
  color: ${({ theme }) => theme.colors.textGray};

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray400};
    color: ${({ theme }) => theme.colors.white};
  }
`;

const DeleteButton = styled(ActionButton)`
  background-color: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};

  &:hover {
    background-color: ${({ theme }) => theme.colors.dangerText};
    color: ${({ theme }) => theme.colors.white};
  }
`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewReportDetailPanelViewProps {
  report: AdminReviewReportItem | null;
  processingId: string | null;
  isDeleting: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDeleteReview: (report: AdminReviewReportItem) => void;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── View ──────────────────────────────────────────────────────────────────────

const ReviewReportDetailPanelView = ({
  report,
  processingId,
  isDeleting,
  onApprove,
  onReject,
  onDeleteReview,
}: ReviewReportDetailPanelViewProps) => {
  const t = useTranslations("admin.reviewReports");

  if (!report) {
    return (
      <PanelWrapper>
        <EmptyState>{t("detail.noSelection")}</EmptyState>
      </PanelWrapper>
    );
  }

  const isProcessing = processingId === report.id;

  return (
    <PanelWrapper>
      <PanelTitle>{t("detail.title")}</PanelTitle>

      <Section>
        <InfoRow>
          <InfoLabel>{t("tableReason")}</InfoLabel>
          <InfoValue>{t(`reason${capitalize(report.reason)}`)}</InfoValue>
        </InfoRow>
        {report.reason_detail && (
          <InfoRow>
            <InfoLabel>{t("detail.reasonDetail")}</InfoLabel>
            <InfoValue>{report.reason_detail}</InfoValue>
          </InfoRow>
        )}
        <InfoRow>
          <InfoLabel>{t("tableStatus")}</InfoLabel>
          <InfoValue>
            <StatusBadge $status={report.status}>
              {t(`status${capitalize(report.status)}`)}
            </StatusBadge>
            {report.review_deleted && (
              <DeletedBadge style={{ marginLeft: 6 }}>
                {t("deletedBadge")}
              </DeletedBadge>
            )}
          </InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>{t("detail.shopName")}</InfoLabel>
          <InfoValue>{report.shop_name ?? "-"}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>{t("tableDate")}</InfoLabel>
          <InfoValue>
            {new Date(report.created_at).toLocaleDateString("ko-KR")}
          </InfoValue>
        </InfoRow>
      </Section>

      <Section>
        <SectionTitle>{t("detail.reviewContent")}</SectionTitle>
        <ContentBox>
          {report.review_content || t("detail.noContent")}
        </ContentBox>
        {report.review_image_urls.length > 0 && (
          <ImageGrid>
            {report.review_image_urls.map((url) => (
              <ImageThumb key={url} src={url} alt="" />
            ))}
          </ImageGrid>
        )}
        <InfoRow>
          <InfoLabel>{t("detail.reviewAuthor")}</InfoLabel>
          <InfoValue>{report.review_author_nickname ?? "-"}</InfoValue>
        </InfoRow>
      </Section>

      <Section>
        <SectionTitle>{t("detail.reporterSection")}</SectionTitle>
        <InfoRow>
          <InfoLabel>{t("detail.reporterNickname")}</InfoLabel>
          <InfoValue>{report.reporter_nickname ?? "-"}</InfoValue>
        </InfoRow>
      </Section>

      {report.status === "pending" && (
        <ActionRow>
          <ActionButton
            disabled={isProcessing}
            onClick={() => onApprove(report.id)}
          >
            {t("approveBtn")}
          </ActionButton>
          <RejectButton
            disabled={isProcessing}
            onClick={() => onReject(report.id)}
          >
            {t("rejectBtn")}
          </RejectButton>
        </ActionRow>
      )}

      {report.status === "approved" && !report.review_deleted && (
        <ActionRow>
          <DeleteButton
            disabled={isDeleting}
            onClick={() => onDeleteReview(report)}
          >
            {isDeleting ? t("deletingReview") : t("deleteReviewBtn")}
          </DeleteButton>
        </ActionRow>
      )}
    </PanelWrapper>
  );
};

export default ReviewReportDetailPanelView;
