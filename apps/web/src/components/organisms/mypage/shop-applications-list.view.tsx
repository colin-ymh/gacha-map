"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import LoginPopup from "@/components/organisms/auth/login-popup";
import type {
  ShopOwnerApplication,
  ShopOwnerApplicationType,
  ShopOwnerApplicationStatus,
} from "@/types";
import {
  BADGE_NEW_SHOP_BG,
  BADGE_NEW_SHOP_TEXT,
  BADGE_CLAIM_SHOP_BG,
  BADGE_CLAIM_SHOP_TEXT,
  REPORT_STATUS_PENDING_BG,
  REPORT_STATUS_PENDING_TEXT,
  SUCCESS_BG,
  SUCCESS_TEXT,
  DANGER_BG,
  DANGER_TEXT,
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
  padding: 14px 16px;
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

const ShopNameText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray700};
  font-weight: 500;
  margin: 0 0 4px;
`;

const RejectionNote = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.dangerText};
  margin: 4px 0 0;
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

// ── Badge maps ────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<
  ShopOwnerApplicationType,
  { bg: string; color: string }
> = {
  new_shop: { bg: BADGE_NEW_SHOP_BG, color: BADGE_NEW_SHOP_TEXT },
  claim_shop: { bg: BADGE_CLAIM_SHOP_BG, color: BADGE_CLAIM_SHOP_TEXT },
};

const STATUS_BADGE: Record<
  ShopOwnerApplicationStatus,
  { bg: string; color: string }
> = {
  pending: { bg: REPORT_STATUS_PENDING_BG, color: REPORT_STATUS_PENDING_TEXT },
  approved: { bg: SUCCESS_BG, color: SUCCESS_TEXT },
  rejected: { bg: DANGER_BG, color: DANGER_TEXT },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShopApplicationsListViewProps {
  applications: ShopOwnerApplication[];
  isLoading: boolean;
  isLoggedIn: boolean | null;
  hasError: boolean;
  isLoginPopupOpen: boolean;
  onBack: () => void;
  onRetry: () => void;
  onNewApplication: () => void;
  onLoginPopupClose: () => void;
  loginReturnUrl: string;
}

// ── View ──────────────────────────────────────────────────────────────────────

const ShopApplicationsListView = ({
  applications,
  isLoading,
  isLoggedIn,
  hasError,
  isLoginPopupOpen,
  onBack,
  onRetry,
  onNewApplication,
  onLoginPopupClose,
  loginReturnUrl,
}: ShopApplicationsListViewProps) => {
  const t = useTranslations("myShopApplications");

  if (isLoading) {
    return (
      <Wrapper>
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
          <BackButton onClick={onBack}>← {t("title")}</BackButton>
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
        <BackButton onClick={onBack}>← {t("title")}</BackButton>
      </BackBar>
      <CountBar>
        {t("title")} ({applications.length})
      </CountBar>
      <List>
        {applications.length === 0 ? (
          <li>
            <EmptyBox>
              <EmptyText>{t("empty")}</EmptyText>
              <ActionButton onClick={onNewApplication}>
                {t("emptyAction")}
              </ActionButton>
            </EmptyBox>
          </li>
        ) : (
          applications.map((app) => {
            const typeBadge = TYPE_BADGE[app.type];
            const statusBadge = STATUS_BADGE[app.status];
            const displayName = app.shop_name ?? app.address ?? "-";

            return (
              <CardItem key={app.id}>
                <CardHeader>
                  <BadgeRow>
                    <Badge $bg={typeBadge.bg} $color={typeBadge.color}>
                      {app.type === "new_shop"
                        ? t("typeNewShop")
                        : t("typeClaimShop")}
                    </Badge>
                    <Badge $bg={statusBadge.bg} $color={statusBadge.color}>
                      {app.status === "pending"
                        ? t("statusPending")
                        : app.status === "approved"
                          ? t("statusApproved")
                          : t("statusRejected")}
                    </Badge>
                  </BadgeRow>
                  <DateText>{formatDate(app.created_at)}</DateText>
                </CardHeader>
                <ShopNameText>{displayName}</ShopNameText>
                {app.status === "rejected" && app.admin_note && (
                  <RejectionNote>
                    {t("rejectionReason", { reason: app.admin_note })}
                  </RejectionNote>
                )}
              </CardItem>
            );
          })
        )}
      </List>
    </Wrapper>
  );
};

export default ShopApplicationsListView;
