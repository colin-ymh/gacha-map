"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { BORDER, TEXT_SECONDARY, SUCCESS_GREEN } from "@/styles/color";
import type { QuickReportKind } from "@gacha-map/shared";

interface QuickReportButtonsProps {
  locationEnabled: boolean;
  alreadyReported: boolean;
  submitting: boolean;
  onReport: (kind: QuickReportKind) => void;
}

const Wrapper = styled.div`
  padding: 24px 16px;
  text-align: center;
  background: #fafafa;
`;

const Emoji = styled.div`
  font-size: 28px;
  margin-bottom: 8px;
`;

const Title = styled.p`
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px;
`;

const Subtitle = styled.p`
  font-size: 12px;
  color: ${TEXT_SECONDARY};
  margin: 0 0 20px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 12px;
`;

const PresentBtn = styled.button<{ $disabled: boolean }>`
  background: ${({ $disabled }) => ($disabled ? "#ccc" : SUCCESS_GREEN)};
  color: #fff;
  padding: 12px 20px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  box-shadow: ${({ $disabled }) =>
    $disabled ? "none" : "0 2px 6px rgba(76,175,80,0.3)"};
`;

const AbsentBtn = styled.button<{ $disabled: boolean }>`
  background: ${({ $disabled }) => ($disabled ? "#eee" : "#fff")};
  color: ${({ $disabled }) => ($disabled ? "#aaa" : "#555")};
  padding: 12px 20px;
  border-radius: 24px;
  font-size: 13px;
  border: 1.5px solid ${({ $disabled }) => ($disabled ? "#ddd" : BORDER)};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
`;

const Notice = styled.p`
  font-size: 12px;
  color: ${TEXT_SECONDARY};
  margin: 0 0 16px;
`;

const Hint = styled.p`
  font-size: 11px;
  color: #bbb;
  margin: 0;
`;

export default function QuickReportButtons({
  locationEnabled,
  alreadyReported,
  submitting,
  onReport,
}: QuickReportButtonsProps) {
  const t = useTranslations("gacha");
  const disabled = !locationEnabled || alreadyReported || submitting;

  return (
    <Wrapper>
      <Emoji>🎰</Emoji>
      <Title>{t("quickReport.emptyTitle")}</Title>
      <Subtitle>{t("quickReport.emptySubtitle")}</Subtitle>

      {!locationEnabled && !alreadyReported && (
        <Notice>{t("quickReport.disabled")}</Notice>
      )}

      {alreadyReported ? (
        <Notice>{t("quickReport.alreadyReported")}</Notice>
      ) : (
        <ButtonRow>
          <PresentBtn
            $disabled={disabled}
            onClick={() => !disabled && onReport("gacha_present")}
          >
            {submitting ? "..." : t("quickReport.present")}
          </PresentBtn>
          <AbsentBtn
            $disabled={disabled}
            onClick={() => !disabled && onReport("gacha_absent")}
          >
            {t("quickReport.absent")}
          </AbsentBtn>
        </ButtonRow>
      )}

      <Hint>{t("quickReport.hint")}</Hint>
    </Wrapper>
  );
}
