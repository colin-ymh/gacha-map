"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import LoginPopup from "@/components/organisms/auth/login-popup";
import type { MyReport, ReportType, ReportStatus } from "@/types";
import {
  REPORT_TYPE_NEW_SHOP_BG,
  REPORT_TYPE_NEW_SHOP_TEXT,
  REPORT_TYPE_FIX_INFO_BG,
  REPORT_TYPE_FIX_INFO_TEXT,
  REPORT_TYPE_CLOSED_BG,
  REPORT_TYPE_CLOSED_TEXT,
  REPORT_TYPE_OTHER_BG,
  TEXT_MEDIUM,
  REPORT_STATUS_PENDING_BG,
  REPORT_STATUS_PENDING_TEXT,
  REPORT_STATUS_REVIEWED_BG,
  REPORT_STATUS_RESOLVED_BG,
  REPORT_STATUS_RESOLVED_TEXT,
} from "@/styles/color";

// ── Styled ────────────────────────────────────────────────────────────────────

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const BackBar = styled.div`
  padding: 8px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const BackButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.75;
  }
`;

const CountBar = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray500};
`;

const List = styled.ul`
  flex: 1;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const CardItem = styled.li`
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
`;

const CardBody = styled.div`
  padding: 14px 16px;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
`;

const BadgeRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

interface BadgeProps {
  $bg: string;
  $color: string;
}

const Badge = styled.span<BadgeProps>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
`;

const DateText = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray400};
  white-space: nowrap;
`;

const ShopName = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0 0 4px;
`;

const ContentPreview = styled.p<{ $expanded: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
  line-height: 1.5;
  ${({ $expanded }) =>
    !$expanded &&
    `
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`;

const Loading = styled.div`
  padding: 48px 16px;
  text-align: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
`;

const EmptyBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
  gap: 16px;
`;

const EmptyText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray400};
  margin: 0;
  text-align: center;
`;

const ActionButton = styled.button`
  padding: 10px 20px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    opacity: 0.88;
  }
`;

// ── Badge data ────────────────────────────────────────────────────────────────

const TYPE_KEY: Record<
  ReportType,
  "typeNewShop" | "typeFixInfo" | "typeClosed" | "typeOther"
> = {
  new_shop: "typeNewShop",
  fix_info: "typeFixInfo",
  closed: "typeClosed",
  other: "typeOther",
};

const STATUS_KEY: Record<
  ReportStatus,
  "statusPending" | "statusReviewed" | "statusResolved"
> = {
  pending: "statusPending",
  reviewed: "statusReviewed",
  resolved: "statusResolved",
};

const TYPE_BADGE: Record<ReportType, { bg: string; color: string }> = {
  new_shop: { bg: REPORT_TYPE_NEW_SHOP_BG, color: REPORT_TYPE_NEW_SHOP_TEXT },
  fix_info: { bg: REPORT_TYPE_FIX_INFO_BG, color: REPORT_TYPE_FIX_INFO_TEXT },
  closed: { bg: REPORT_TYPE_CLOSED_BG, color: REPORT_TYPE_CLOSED_TEXT },
  other: { bg: REPORT_TYPE_OTHER_BG, color: TEXT_MEDIUM },
};

const STATUS_BADGE: Record<ReportStatus, { bg: string; color: string }> = {
  pending: { bg: REPORT_STATUS_PENDING_BG, color: REPORT_STATUS_PENDING_TEXT },
  reviewed: { bg: REPORT_STATUS_REVIEWED_BG, color: TEXT_MEDIUM },
  resolved: {
    bg: REPORT_STATUS_RESOLVED_BG,
    color: REPORT_STATUS_RESOLVED_TEXT,
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// ── View ──────────────────────────────────────────────────────────────────────

interface ReportsListViewProps {
  reports: MyReport[];
  isLoading: boolean;
  isLoggedIn: boolean | null;
  hasError: boolean;
  isLoginPopupOpen: boolean;
  expandedId: string | null;
  onBack: () => void;
  onRetry: () => void;
  onToggleExpand: (id: string) => void;
  onNewReport: () => void;
  onLoginPopupClose: () => void;
  loginReturnUrl: string;
}

const ReportsListView = ({
  reports,
  isLoading,
  isLoggedIn,
  hasError,
  isLoginPopupOpen,
  expandedId,
  onBack,
  onRetry,
  onToggleExpand,
  onNewReport,
  onLoginPopupClose,
  loginReturnUrl,
}: ReportsListViewProps) => {
  const t = useTranslations("myReports");

  if (isLoading) {
    return (
      <Wrapper>
        <BackBar>
          <BackButton onClick={onBack}>{t("backToMypage")}</BackButton>
        </BackBar>
        <Loading>{t("loading")}</Loading>
      </Wrapper>
    );
  }

  if (!isLoggedIn) {
    return (
      <Wrapper>
        {isLoginPopupOpen && (
          <LoginPopup
            onClose={onLoginPopupClose}
            returnUrl={loginReturnUrl}
            title={t("loginRequired")}
          />
        )}
      </Wrapper>
    );
  }

  if (hasError) {
    return (
      <Wrapper>
        <BackBar>
          <BackButton onClick={onBack}>{t("backToMypage")}</BackButton>
        </BackBar>
        <EmptyBox>
          <EmptyText>{t("errorMsg")}</EmptyText>
          <ActionButton onClick={onRetry}>{t("retry")}</ActionButton>
        </EmptyBox>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <BackBar>
        <BackButton onClick={onBack}>{t("backToMypage")}</BackButton>
      </BackBar>
      <CountBar>{t("count", { count: reports.length })}</CountBar>
      <List>
        {reports.length === 0 ? (
          <li>
            <EmptyBox>
              <EmptyText>{t("empty")}</EmptyText>
              <ActionButton onClick={onNewReport}>
                {t("emptyAction")}
              </ActionButton>
            </EmptyBox>
          </li>
        ) : (
          reports.map((report) => {
            const typeBadge = TYPE_BADGE[report.report_type];
            const statusBadge = STATUS_BADGE[report.status];
            const isExpanded = expandedId === report.id;

            return (
              <CardItem key={report.id}>
                <CardBody onClick={() => onToggleExpand(report.id)}>
                  <CardHeader>
                    <BadgeRow>
                      <Badge $bg={typeBadge.bg} $color={typeBadge.color}>
                        {t(TYPE_KEY[report.report_type])}
                      </Badge>
                      <Badge $bg={statusBadge.bg} $color={statusBadge.color}>
                        {t(STATUS_KEY[report.status])}
                      </Badge>
                    </BadgeRow>
                    <DateText>{formatDate(report.created_at)}</DateText>
                  </CardHeader>
                  <ShopName>
                    {t("shopLabel")}: {report.shop_name ?? t("noShop")}
                  </ShopName>
                  <ContentPreview $expanded={isExpanded}>
                    {report.content}
                  </ContentPreview>
                </CardBody>
              </CardItem>
            );
          })
        )}
      </List>
    </Wrapper>
  );
};

export default ReportsListView;
