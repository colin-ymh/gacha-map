"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import {
  PRIMARY,
  TEXT_DARK,
  TEXT_GRAY,
  TEXT_PLACEHOLDER,
  BORDER,
  WHITE,
  GRAY_200,
} from "@/styles/color";
import type { QuickReportKind } from "@gacha-map/shared";

interface QuickReportButtonsProps {
  locationEnabled: boolean;
  alreadyReported: boolean;
  submitting: boolean;
  onReport: (kind: QuickReportKind) => void;
}

const Wrapper = styled.div`
  background: ${WHITE};
  border-bottom: 1px solid ${BORDER};
`;

const ExpandedContent = styled.div`
  padding: 24px 16px;
  text-align: center;
`;

const Title = styled.p`
  font-size: 14px;
  font-weight: 700;
  color: ${TEXT_DARK};
  margin: 0 0 4px;
`;

const Subtitle = styled.p`
  font-size: 12px;
  color: ${TEXT_GRAY};
  margin: 0 0 20px;
`;

const ButtonCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
`;

const PresentBtn = styled.button<{ $disabled: boolean }>`
  background: ${({ $disabled }) => ($disabled ? GRAY_200 : PRIMARY)};
  color: ${WHITE};
  padding: 14px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  width: 100%;
`;

const AbsentBtn = styled.button<{ $disabled: boolean }>`
  background: ${({ $disabled }) => ($disabled ? GRAY_200 : WHITE)};
  color: ${({ $disabled }) => ($disabled ? TEXT_PLACEHOLDER : TEXT_GRAY)};
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 13px;
  border: 1.5px solid ${({ $disabled }) => ($disabled ? GRAY_200 : BORDER)};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  width: 100%;
`;

const Notice = styled.p`
  font-size: 12px;
  color: ${TEXT_GRAY};
  margin: 0 0 16px;
`;

export default function QuickReportButtons({
  locationEnabled,
  alreadyReported,
  submitting,
  onReport,
}: QuickReportButtonsProps) {
  const t = useTranslations("gacha");
  const disabled = !locationEnabled || alreadyReported || submitting;

  if (alreadyReported) return null;

  const title = t("quickReport.emptyTitle");
  const subtitle = t("quickReport.emptySubtitle");

  return (
    <Wrapper>
      <ExpandedContent>
        <Title>{title}</Title>
        <Subtitle>{subtitle}</Subtitle>

        {!locationEnabled && <Notice>{t("quickReport.disabled")}</Notice>}

        <ButtonCol>
          <PresentBtn
            $disabled={disabled}
            onClick={() => !disabled && onReport("gacha_present")}
            disabled={disabled}
          >
            {submitting ? "..." : t("quickReport.present")}
          </PresentBtn>
          <AbsentBtn
            $disabled={disabled}
            onClick={() => !disabled && onReport("gacha_absent")}
            disabled={disabled}
          >
            {t("quickReport.absent")}
          </AbsentBtn>
        </ButtonCol>
      </ExpandedContent>
    </Wrapper>
  );
}
