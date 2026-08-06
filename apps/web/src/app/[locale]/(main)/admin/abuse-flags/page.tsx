"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AbuseFlag } from "@gacha-map/shared";
import { createClient } from "@/lib/supabase/client";

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
  gap: 16px;
  flex-wrap: wrap;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const FilterRow = styled.div`
  display: flex;
  gap: 8px;
`;

interface FilterButtonProps {
  $active: boolean;
}

const FilterButton = styled.button<FilterButtonProps>`
  padding: 6px 14px;
  border-radius: 99px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.border};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primaryBg : theme.colors.white};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textGray};
  cursor: pointer;
  font-weight: ${({ $active }) => ($active ? "600" : "400")};
`;

const ErrorMessage = styled.div`
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  border: 1px solid ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.dangerText};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSize.sm};
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
`;

const Th = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textGray};
  background: ${({ theme }) => theme.colors.gray50};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 10px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textDark};
  vertical-align: top;
`;

const FlagTypeBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  background: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};
  white-space: nowrap;
`;

const DetailPre = styled.pre`
  margin: 0;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textGray};
  white-space: pre-wrap;
  word-break: break-all;
  max-width: 300px;
`;

const UserIdText = styled.span`
  font-family: monospace;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textGray};
`;

const ReviewedBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  background: ${({ theme }) => theme.colors.gray100};
  color: ${({ theme }) => theme.colors.textGray};
`;

const ReviewButton = styled.button`
  padding: 4px 12px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyRow = styled.tr`
  td {
    padding: 32px 16px;
    text-align: center;
    color: ${({ theme }) => theme.colors.textGray};
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

type FilterMode = "all" | "pending" | "reviewed";

export default function AdminAbuseFlagsPage() {
  const t = useTranslations("admin");
  const [flags, setFlags] = useState<AbuseFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("pending");
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const reviewed =
          filter === "pending" ? "false" : filter === "reviewed" ? "true" : "";
        const qs = reviewed !== "" ? `?reviewed=${reviewed}` : "";
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin/abuse-flags${qs}`, {
          headers: session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (!res.ok) throw new Error("Failed to load flags");
        const data = await res.json();
        setFlags(data.flags);
      } catch {
        setError(t("abuseFlags.loadError"));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [filter, t]);

  const handleMarkReviewed = async (id: string) => {
    setMarkingId(id);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/abuse-flags/${id}`, {
        method: "PATCH",
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (!res.ok) throw new Error("Failed");
      setFlags((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, reviewed_at: new Date().toISOString() } : f,
        ),
      );
    } catch {
      setError(t("abuseFlags.markError"));
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <Container>
      <Header>
        <Title>{t("nav.abuseFlags")}</Title>
        <FilterRow>
          <FilterButton
            $active={filter === "pending"}
            onClick={() => setFilter("pending")}
          >
            {t("abuseFlags.filterPending")}
          </FilterButton>
          <FilterButton
            $active={filter === "reviewed"}
            onClick={() => setFilter("reviewed")}
          >
            {t("abuseFlags.filterReviewed")}
          </FilterButton>
          <FilterButton
            $active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            {t("abuseFlags.filterAll")}
          </FilterButton>
        </FilterRow>
      </Header>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {isLoading ? (
        <div>{t("shops.loading")}</div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("abuseFlags.tableType")}</Th>
              <Th>{t("abuseFlags.tableUser")}</Th>
              <Th>{t("abuseFlags.tableDetail")}</Th>
              <Th>{t("abuseFlags.tableCreatedAt")}</Th>
              <Th>{t("abuseFlags.tableStatus")}</Th>
            </tr>
          </thead>
          <tbody>
            {flags.length === 0 ? (
              <EmptyRow>
                <td colSpan={5}>{t("abuseFlags.empty")}</td>
              </EmptyRow>
            ) : (
              flags.map((flag) => (
                <tr key={flag.id}>
                  <Td>
                    <FlagTypeBadge>{flag.flag_type}</FlagTypeBadge>
                  </Td>
                  <Td>
                    <UserIdText>{flag.user_id.slice(0, 8)}…</UserIdText>
                  </Td>
                  <Td>
                    <DetailPre>
                      {JSON.stringify(flag.detail, null, 2)}
                    </DetailPre>
                  </Td>
                  <Td>
                    {new Date(flag.created_at).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Td>
                  <Td>
                    {flag.reviewed_at ? (
                      <ReviewedBadge>{t("abuseFlags.reviewed")}</ReviewedBadge>
                    ) : (
                      <ReviewButton
                        onClick={() => handleMarkReviewed(flag.id)}
                        disabled={markingId === flag.id}
                      >
                        {markingId === flag.id
                          ? t("abuseFlags.marking")
                          : t("abuseFlags.markReviewed")}
                      </ReviewButton>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}
    </Container>
  );
}
