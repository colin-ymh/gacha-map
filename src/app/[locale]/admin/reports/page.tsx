"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import ReportTable from "@/components/organisms/admin/report-table";
import { createClient } from "@/lib/supabase/client";
import type { AdminReportItem } from "@/types";

// ── Styled Components ───────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
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

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  border: 1px solid ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.dangerText};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Component ───────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/");
          return;
        }

        const response = await fetch(
          "/api/admin/reports?status=pending&offset=0&limit=50",
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );

        if (response.status === 401 || response.status === 403) {
          router.push("/");
          return;
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setReports(data.reports || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch reports",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle approve
  const handleApprove = async (
    reportId: string,
    mode: "new" | "link",
    shopId?: string,
  ) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const body = mode === "new" ? { mode: "new" } : { mode: "link", shopId };

      const response = await fetch(`/api/admin/reports/${reportId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Optimistic update: remove from list
      setReports((prev) => prev.filter((report) => report.id !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve report");
    }
  };

  // Handle reject
  const handleReject = async (reportId: string, reason: string) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch(`/api/admin/reports/${reportId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ adminNote: reason }),
      });

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Optimistic update: remove from list
      setReports((prev) => prev.filter((report) => report.id !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject report");
    }
  };

  return (
    <Container>
      <Header>
        <Title>{t("title")}</Title>
        <PendingCount>{t("pending", { count: reports.length })}</PendingCount>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <ReportTable
        reports={reports}
        isLoading={isLoading}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </Container>
  );
}
