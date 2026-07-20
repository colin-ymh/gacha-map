"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import ReviewReportTable from "@/components/organisms/admin/review-report-table";
import ReviewReportDetailPanel from "@/components/organisms/admin/review-report-detail-panel";
import { createClient } from "@/lib/supabase/client";
import type { AdminReviewReportItem, ReviewReportStatus } from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const PendingCount = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const Tabs = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? 700 : 400)};
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textGray};
  border-bottom: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary : "transparent")};
  margin-bottom: -2px;
  transition: all 0.15s;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const SplitLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  min-height: 500px;
`;

const ListPanel = styled.div`
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  overflow-y: auto;
`;

const DetailPanel = styled.div`
  background-color: ${({ theme }) => theme.colors.white};
  overflow-y: auto;
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  border: 1px solid ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.dangerText};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Component ───────────────────────────────────────────────────────────────

const STATUS_TABS: ReviewReportStatus[] = ["pending", "approved", "rejected"];

export default function AdminReviewReportsPage() {
  const t = useTranslations("admin.reviewReports");
  const router = useRouter();

  const [reports, setReports] = useState<AdminReviewReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] =
    useState<ReviewReportStatus>("pending");
  const [selectedReport, setSelectedReport] =
    useState<AdminReviewReportItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getSession = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const session = await getSession();

        if (!session) {
          router.push("/");
          return;
        }

        const response = await fetch(
          `/api/admin/review-reports?status=${activeStatus}&offset=0&limit=50`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );

        if (response.status === 401 || response.status === 403) {
          router.push("/");
          return;
        }
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        if (!cancelled) {
          setReports(data.reports ?? []);
          setSelectedReport(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch review reports",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus]);

  const callApi = async (reportId: string, path: string) => {
    const session = await getSession();
    if (!session) {
      router.push("/");
      return;
    }

    const response = await fetch(
      `/api/admin/review-reports/${reportId}/${path}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    );

    if (response.status === 401 || response.status === 403) {
      router.push("/");
      return;
    }
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    setReports((prev) => prev.filter((r) => r.id !== reportId));
    if (selectedReport?.id === reportId) setSelectedReport(null);
  };

  const handleApprove = async (reportId: string) => {
    setProcessingId(reportId);
    try {
      await callApi(reportId, "approve");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update review report",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reportId: string) => {
    setProcessingId(reportId);
    try {
      await callApi(reportId, "reject");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update review report",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReview = async (report: AdminReviewReportItem) => {
    if (!report.review_id) return;
    if (!window.confirm(t("deleteConfirm"))) return;

    setIsDeleting(true);
    try {
      const session = await getSession();
      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/reviews/${report.review_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const updated = { ...report, review_id: null, review_deleted: true };
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)));
      setSelectedReport((prev) => (prev?.id === report.id ? updated : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete review");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTabChange = (status: ReviewReportStatus) => {
    setActiveStatus(status);
  };

  return (
    <Container>
      <Header>
        <TitleGroup>
          <Title>{t("title")}</Title>
          <PendingCount>{t("pending", { count: reports.length })}</PendingCount>
        </TitleGroup>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <Tabs>
        {STATUS_TABS.map((status) => (
          <Tab
            key={status}
            $active={activeStatus === status}
            onClick={() => handleTabChange(status)}
          >
            {status === "pending" && t("tabPending")}
            {status === "approved" && t("tabApproved")}
            {status === "rejected" && t("tabRejected")}
          </Tab>
        ))}
      </Tabs>

      <SplitLayout>
        <ListPanel>
          <ReviewReportTable
            reports={reports}
            isLoading={isLoading}
            selectedReportId={selectedReport?.id ?? null}
            onSelectReport={setSelectedReport}
          />
        </ListPanel>
        <DetailPanel>
          <ReviewReportDetailPanel
            report={selectedReport}
            processingId={processingId}
            isDeleting={isDeleting}
            onApprove={handleApprove}
            onReject={handleReject}
            onDeleteReview={handleDeleteReview}
          />
        </DetailPanel>
      </SplitLayout>
    </Container>
  );
}
