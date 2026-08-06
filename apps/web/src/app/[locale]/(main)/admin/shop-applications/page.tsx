"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import ShopApplicationTable from "@/components/organisms/admin/shop-application-table";
import { createClient } from "@/lib/supabase/client";
import type {
  AdminShopOwnerApplicationItem,
  ShopOwnerApplicationStatus,
} from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const SubText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const FilterRow = styled.div`
  display: flex;
  gap: 8px;
`;

const FilterSelect = styled.select`
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.white};
  cursor: pointer;
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  border: 1px solid ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.dangerText};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── helpers ───────────────────────────────────────────────────────────────────

async function getSessionToken() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminShopApplicationsPage() {
  const t = useTranslations("admin.shopApplications");
  const router = useRouter();
  const [applications, setApplications] = useState<
    AdminShopOwnerApplicationItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    ShopOwnerApplicationStatus | ""
  >("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      const token = await getSessionToken();
      if (!token) {
        router.push("/");
        return;
      }

      try {
        const params = new URLSearchParams({ limit: "100", offset: "0" });
        if (statusFilter) params.set("status", statusFilter);

        const res = await fetch(`/api/admin/shop-applications?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401 || res.status === 403) {
          router.push("/");
          return;
        }
        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        setApplications(data.applications ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setIsLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleApprove = async (id: string) => {
    const token = await getSessionToken();
    if (!token) {
      router.push("/");
      return;
    }

    const res = await fetch(`/api/admin/shop-applications/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "approve" }),
    });

    if (res.status === 401 || res.status === 403) {
      router.push("/");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `API error: ${res.status}`,
      );
    }

    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "approved" } : a)),
    );
  };

  const handleReject = async (id: string, note: string) => {
    const token = await getSessionToken();
    if (!token) {
      router.push("/");
      return;
    }

    const res = await fetch(`/api/admin/shop-applications/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "reject", admin_note: note }),
    });

    if (res.status === 401 || res.status === 403) {
      router.push("/");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `API error: ${res.status}`,
      );
    }

    setApplications((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "rejected", admin_note: note || null }
          : a,
      ),
    );
  };

  const pending = applications.filter((a) => a.status === "pending").length;

  return (
    <Container>
      <Header>
        <TitleBlock>
          <Title>{t("title")}</Title>
          <SubText>{t("pendingCount", { count: pending })}</SubText>
        </TitleBlock>
        <FilterRow>
          <FilterSelect
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ShopOwnerApplicationStatus | "")
            }
          >
            <option value="">{t("filterAll")}</option>
            <option value="pending">{t("statusPending")}</option>
            <option value="approved">{t("statusApproved")}</option>
            <option value="rejected">{t("statusRejected")}</option>
          </FilterSelect>
        </FilterRow>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <ShopApplicationTable
        applications={applications}
        isLoading={isLoading}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </Container>
  );
}
