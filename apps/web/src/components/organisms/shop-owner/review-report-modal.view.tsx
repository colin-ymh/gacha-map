"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { ReviewReportReason } from "./review-report-modal";

// ── Styled ────────────────────────────────────────────────────────────────────

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1000;
`;

const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 24px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const ReasonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ReasonOption = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid
    ${({ theme, $selected }) => ($selected ? theme.colors.primary : theme.colors.border)};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primaryBg : theme.colors.white};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : theme.colors.textDark};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ $selected }) => ($selected ? 700 : 400)};
  cursor: pointer;
  text-align: left;
`;

const DetailInput = styled.textarea`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 10px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
`;

const ErrorText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.dangerText};
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
`;

const CancelButton = styled.button`
  flex: 1;
  padding: 10px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;
`;

const SubmitButton = styled.button`
  flex: 1;
  padding: 10px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: none;
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ── Types ─────────────────────────────────────────────────────────────────────

const REASONS: ReviewReportReason[] = [
  "spam",
  "abusive",
  "irrelevant",
  "fake",
  "other",
];

interface ReviewReportModalViewProps {
  visible: boolean;
  reason: ReviewReportReason | null;
  detail: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  error: string | null;
  onReasonChange: (reason: ReviewReportReason) => void;
  onDetailChange: (detail: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

// ── View ──────────────────────────────────────────────────────────────────────

const ReviewReportModalView = ({
  visible,
  reason,
  detail,
  canSubmit,
  isSubmitting,
  error,
  onReasonChange,
  onDetailChange,
  onSubmit,
  onClose,
}: ReviewReportModalViewProps) => {
  const t = useTranslations("shopOwner.reviews");

  if (!visible) return null;

  return (
    <Backdrop onClick={onClose}>
      <Card onClick={(e) => e.stopPropagation()}>
        <ModalTitle>{t("reportTitle")}</ModalTitle>

        <ReasonList>
          {REASONS.map((r) => (
            <ReasonOption
              key={r}
              type="button"
              $selected={reason === r}
              onClick={() => onReasonChange(r)}
            >
              {t(`reportReason${capitalize(r)}`)}
            </ReasonOption>
          ))}
        </ReasonList>

        {reason === "other" && (
          <DetailInput
            value={detail}
            onChange={(e) => onDetailChange(e.target.value)}
            placeholder={t("reportDetailPlaceholder")}
            maxLength={500}
          />
        )}

        {error && <ErrorText>{t("reportError")}</ErrorText>}

        <ButtonRow>
          <CancelButton type="button" onClick={onClose}>
            {t("reportCancel")}
          </CancelButton>
          <SubmitButton type="button" disabled={!canSubmit} onClick={onSubmit}>
            {isSubmitting ? t("loading") : t("reportSubmit")}
          </SubmitButton>
        </ButtonRow>
      </Card>
    </Backdrop>
  );
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default ReviewReportModalView;
