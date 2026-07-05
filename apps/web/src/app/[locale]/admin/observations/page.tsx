"use client";

import { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

interface Observation {
  id: string;
  status: string;
  source_type: string;
  observed_title_ko: string | null;
  observed_title_ja: string | null;
  manufacturer_hint: string | null;
  price_krw: number | null;
  image_url: string | null;
  raw_vision: { ip_name?: string; series_label?: string } | null;
  shop_id: string | null;
  shops: { name: string } | null;
  created_at: string;
}

interface DiscoveryRequest {
  id: string;
  status: string;
  extracted_title_ko: string | null;
  extracted_title_ja: string | null;
  manufacturer_hint: string | null;
  price_krw: number | null;
  image_url: string | null;
  raw_vision: { ip_name?: string; series_label?: string } | null;
  jan_code: string | null;
  attempt_count: number;
  error_message: string | null;
  user_manual_product_id: string | null;
  matched_product_id: string | null;
  matched_product: { id: string; name: string; name_ko: string | null; official_image_url: string | null } | null;
  observation_id: string | null;
  shop_id: string | null;
  shops: { name: string } | null;
  created_at: string;
  updated_at: string;
}

// ── Styled ─────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

const TabBar = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid ${({ theme, $active }) => ($active ? theme.colors.primary : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textGray)};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ $active }) => ($active ? "600" : "400")};
  cursor: pointer;
`;

const StatusFilter = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const StatusBtn = styled.button<{ $active: boolean }>`
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryBg : "transparent")};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textGray)};
  font-size: ${({ theme }) => theme.fontSize.xs};
  cursor: pointer;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const Th = styled.th`
  text-align: left;
  padding: 8px 12px;
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textGray};
  font-weight: 500;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 8px 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  vertical-align: middle;
  color: ${({ theme }) => theme.colors.textDark};
`;

const Thumb = styled.img`
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.gray100};
`;

const NoImage = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.gray100};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
`;

const Badge = styled.span<{ $color: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  background: ${({ $color }) => $color}22;
  color: ${({ $color }) => $color};
  font-weight: 500;
`;

const Empty = styled.div`
  padding: 40px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
`;

const Pagination = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textGray};
`;

const PagBtn = styled.button`
  padding: 4px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  &:disabled { opacity: 0.4; cursor: default; }
`;

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  needs_review: "#f59e0b",
  matched: "#10b981",
  rejected: "#ef4444",
  pending: "#6366f1",
  searching: "#3b82f6",
  imported: "#10b981",
  no_match: "#f59e0b",
  failed: "#ef4444",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const LIMIT = 50;

// ── Component ──────────────────────────────────────────────────────────────

export default function ObservationsAdminPage() {
  const [tab, setTab] = useState<"observations" | "discovery">("observations");

  // observations state
  const [obsStatus, setObsStatus] = useState("needs_review");
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsTotal, setObsTotal] = useState(0);
  const [obsOffset, setObsOffset] = useState(0);
  const [obsLoading, setObsLoading] = useState(false);

  // discovery state
  const [drStatus, setDrStatus] = useState("pending");
  const [requests, setRequests] = useState<DiscoveryRequest[]>([]);
  const [drTotal, setDrTotal] = useState(0);
  const [drOffset, setDrOffset] = useState(0);
  const [drLoading, setDrLoading] = useState(false);

  const getToken = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, []);

  const fetchObservations = useCallback(async (status: string, offset: number) => {
    setObsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/admin/observations?status=${status}&offset=${offset}&limit=${LIMIT}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setObservations(data.observations);
        setObsTotal(data.total);
      }
    } finally {
      setObsLoading(false);
    }
  }, [getToken]);

  const fetchDiscovery = useCallback(async (status: string, offset: number) => {
    setDrLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/admin/discovery-requests?status=${status}&offset=${offset}&limit=${LIMIT}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
        setDrTotal(data.total);
      }
    } finally {
      setDrLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (tab === "observations") fetchObservations(obsStatus, obsOffset);
  }, [tab, obsStatus, obsOffset, fetchObservations]);

  useEffect(() => {
    if (tab === "discovery") fetchDiscovery(drStatus, drOffset);
  }, [tab, drStatus, drOffset, fetchDiscovery]);

  return (
    <Container>
      <Title>제보 & 수집 큐</Title>

      <TabBar>
        <Tab $active={tab === "observations"} onClick={() => setTab("observations")}>
          제보 내역
        </Tab>
        <Tab $active={tab === "discovery"} onClick={() => setTab("discovery")}>
          Collector 큐
        </Tab>
      </TabBar>

      {tab === "observations" && (
        <>
          <StatusFilter>
            {["needs_review", "matched", "rejected"].map((s) => (
              <StatusBtn key={s} $active={obsStatus === s} onClick={() => { setObsStatus(s); setObsOffset(0); }}>
                {s}
              </StatusBtn>
            ))}
          </StatusFilter>

          {obsLoading ? <Empty>로딩 중...</Empty> : observations.length === 0 ? (
            <Empty>항목 없음</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>이미지</Th>
                  <Th>제목(KO)</Th>
                  <Th>IP / 시리즈</Th>
                  <Th>소스</Th>
                  <Th>샵</Th>
                  <Th>상태</Th>
                  <Th>일시</Th>
                </tr>
              </thead>
              <tbody>
                {observations.map((obs) => (
                  <tr key={obs.id}>
                    <Td>
                      {obs.image_url
                        ? <Thumb src={obs.image_url} alt="" />
                        : <NoImage>📷</NoImage>}
                    </Td>
                    <Td>{obs.observed_title_ko ?? obs.observed_title_ja ?? "—"}</Td>
                    <Td>
                      {obs.raw_vision?.ip_name && <div style={{ fontSize: 12 }}>{obs.raw_vision.ip_name}</div>}
                      {obs.raw_vision?.series_label && <div style={{ fontSize: 11, opacity: 0.7 }}>{obs.raw_vision.series_label}</div>}
                    </Td>
                    <Td>{obs.source_type}</Td>
                    <Td>{obs.shops?.name ?? obs.shop_id?.slice(0, 8) ?? "—"}</Td>
                    <Td>
                      <Badge $color={STATUS_COLORS[obs.status] ?? "#888"}>{obs.status}</Badge>
                    </Td>
                    <Td>{fmtDate(obs.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <Pagination>
            <span>{obsTotal}개 중 {obsOffset + 1}–{Math.min(obsOffset + LIMIT, obsTotal)}</span>
            <PagBtn disabled={obsOffset === 0} onClick={() => setObsOffset((p) => Math.max(0, p - LIMIT))}>이전</PagBtn>
            <PagBtn disabled={obsOffset + LIMIT >= obsTotal} onClick={() => setObsOffset((p) => p + LIMIT)}>다음</PagBtn>
          </Pagination>
        </>
      )}

      {tab === "discovery" && (
        <>
          <StatusFilter>
            {["pending", "searching", "imported", "no_match", "failed"].map((s) => (
              <StatusBtn key={s} $active={drStatus === s} onClick={() => { setDrStatus(s); setDrOffset(0); }}>
                {s}
              </StatusBtn>
            ))}
          </StatusFilter>

          {drLoading ? <Empty>로딩 중...</Empty> : requests.length === 0 ? (
            <Empty>항목 없음</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>이미지</Th>
                  <Th>제목(KO)</Th>
                  <Th>IP / 시리즈</Th>
                  <Th>샵</Th>
                  <Th>상태</Th>
                  <Th>매칭 상품</Th>
                  <Th>시도</Th>
                  <Th>오류</Th>
                  <Th>일시</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((dr) => (
                  <tr key={dr.id}>
                    <Td>
                      {dr.image_url
                        ? <Thumb src={dr.image_url} alt="" />
                        : <NoImage>📷</NoImage>}
                    </Td>
                    <Td>{dr.extracted_title_ko ?? "—"}</Td>
                    <Td>
                      {dr.raw_vision?.ip_name && <div style={{ fontSize: 12 }}>{dr.raw_vision.ip_name}</div>}
                      {dr.raw_vision?.series_label && <div style={{ fontSize: 11, opacity: 0.7 }}>{dr.raw_vision.series_label}</div>}
                    </Td>
                    <Td>{dr.shops?.name ?? dr.shop_id?.slice(0, 8) ?? "—"}</Td>
                    <Td>
                      <Badge $color={STATUS_COLORS[dr.status] ?? "#888"}>{dr.status}</Badge>
                    </Td>
                    <Td>
                      {dr.matched_product
                        ? <span title={dr.matched_product.id}>{dr.matched_product.name_ko ?? dr.matched_product.name}</span>
                        : "—"}
                    </Td>
                    <Td>{dr.attempt_count}</Td>
                    <Td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dr.error_message ?? "—"}
                    </Td>
                    <Td>{fmtDate(dr.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <Pagination>
            <span>{drTotal}개 중 {drOffset + 1}–{Math.min(drOffset + LIMIT, drTotal)}</span>
            <PagBtn disabled={drOffset === 0} onClick={() => setDrOffset((p) => Math.max(0, p - LIMIT))}>이전</PagBtn>
            <PagBtn disabled={drOffset + LIMIT >= drTotal} onClick={() => setDrOffset((p) => p + LIMIT)}>다음</PagBtn>
          </Pagination>
        </>
      )}
    </Container>
  );
}
