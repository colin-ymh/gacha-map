"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import styled from "styled-components";
import { createClient } from "@/lib/supabase/client";
import LoginPopup from "@/components/organisms/auth/login-popup";
import type { MyReport, ReportType, ReportStatus } from "@/types";

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
  border-radius: 100px;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  new_shop: { bg: "#FFF0E8", color: "#FF6B35" },
  fix_info: { bg: "#F0E8FF", color: "#8B35FF" },
  closed: { bg: "#FFE8E8", color: "#FF3535" },
  other: { bg: "#F5F5F5", color: "#666666" },
};

const STATUS_BADGE: Record<ReportStatus, { bg: string; color: string }> = {
  pending: { bg: "#E8F0FF", color: "#3B7DFF" },
  reviewed: { bg: "#F0F0F0", color: "#666666" },
  resolved: { bg: "#E8F8EE", color: "#28A745" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ReportsListProps {
  onBack?: () => void;
}

const ReportsList = ({ onBack }: ReportsListProps) => {
  const t = useTranslations("myReports");
  const router = useRouter();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    setHasError(false);
    setIsLoading(true);
    fetch("/api/reports")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setReports(data.reports ?? []))
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsLoggedIn(false);
        setIsLoginPopupOpen(true);
        setIsLoading(false);
        return;
      }
      setIsLoggedIn(true);
      load();
    });
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/mypage");
    }
  };

  if (isLoading) {
    return (
      <Wrapper>
        <BackBar>
          <BackButton onClick={handleBack}>{t("backToMypage")}</BackButton>
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
            onClose={() => (onBack ? onBack() : router.back())}
            returnUrl={
              typeof window !== "undefined" ? window.location.pathname : "/"
            }
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
          <BackButton onClick={handleBack}>{t("backToMypage")}</BackButton>
        </BackBar>
        <EmptyBox>
          <EmptyText>{t("errorMsg")}</EmptyText>
          <ActionButton onClick={load}>{t("retry")}</ActionButton>
        </EmptyBox>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <BackBar>
        <BackButton onClick={handleBack}>{t("backToMypage")}</BackButton>
      </BackBar>
      <CountBar>{t("count", { count: reports.length })}</CountBar>
      <List>
        {reports.length === 0 ? (
          <li>
            <EmptyBox>
              <EmptyText>{t("empty")}</EmptyText>
              <ActionButton onClick={() => router.push("/report")}>
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
                <CardBody
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
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

export default ReportsList;
