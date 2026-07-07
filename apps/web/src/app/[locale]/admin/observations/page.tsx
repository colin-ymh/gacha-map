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
  raw_vision: Record<string, unknown> | null;
  shop_id: string | null;
  shops: { name: string } | null;
  created_at: string;
}

interface CandidateUrl {
  name_ja?: string;
  source_url?: string;
  score?: number;
  reasons?: string[];
  selected?: boolean;
}

interface DiscoveryRequest {
  id: string;
  status: string;
  extracted_title_ko: string | null;
  extracted_title_ja: string | null;
  manufacturer_hint: string | null;
  price_krw: number | null;
  jan_code: string | null;
  image_url: string | null;
  raw_vision: Record<string, unknown> | null;
  raw_ocr: Record<string, unknown> | null;
  error_message: string | null;
  attempt_count: number;
  candidate_urls: CandidateUrl[] | null;
  user_manual_product_id: string | null;
  matched_product_id: string | null;
  matched_product: {
    id: string;
    name: string;
    name_ko: string | null;
    official_image_url: string | null;
  } | null;
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
  border-bottom: 2px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary : "transparent")};
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
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
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
  vertical-align: top;
  color: ${({ theme }) => theme.colors.textDark};
`;

const Thumb = styled.img`
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
`;
const NoImage = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.gray100};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
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
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

// Discovery 전용
const ExpandBtn = styled.button`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
`;

const CandidateList = styled.div`
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CandidateItem = styled.div<{ $selected?: boolean }>`
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid
    ${({ theme, $selected }) => ($selected ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $selected }) => ($selected ? theme.colors.primaryBg : theme.colors.white)};
  font-size: 12px;
`;

const CandidateActions = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
`;

const ActionBtn = styled.button<{
  $variant?: "primary" | "danger" | "warn" | "gray";
}>`
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid;
  ${({ theme, $variant }) => {
    switch ($variant) {
      case "primary":
        return `background: ${theme.colors.primaryBg}; color: ${theme.colors.primary}; border-color: ${theme.colors.primary};`;
      case "danger":
        return `background: #fee2e2; color: #dc2626; border-color: #dc2626;`;
      case "warn":
        return `background: #fef3c7; color: #d97706; border-color: #d97706;`;
      default:
        return `background: ${theme.colors.gray100}; color: ${theme.colors.textGray}; border-color: ${theme.colors.border};`;
    }
  }}
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 8px;
  font-size: 11px;
`;
const InfoLabel = styled.span`
  color: ${({ theme }) => theme.colors.textGray};
  white-space: nowrap;
`;
const InfoValue = styled.span`
  color: ${({ theme }) => theme.colors.textDark};
  word-break: break-all;
`;

const UrlInput = styled.input`
  width: 100%;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  margin-top: 4px;
`;

const ErrInput = styled.textarea`
  width: 100%;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  margin-top: 4px;
  resize: vertical;
  min-height: 48px;
`;

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  needs_review: "#f59e0b",
  pending: "#6366f1",
  searching: "#3b82f6",
  imported: "#10b981",
  no_match: "#f59e0b",
  failed: "#ef4444",
  matched: "#10b981",
  rejected: "#ef4444",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const OBS_STATUSES = ["needs_review", "matched", "rejected"] as const;
const DR_STATUSES = [
  "needs_review",
  "pending",
  "searching",
  "imported",
  "no_match",
  "failed",
] as const;
const LIMIT = 50;

// ── DrRow — Discovery Request 행 ─────────────────────────────────────────

function DrRow({
  dr,
  token,
  onUpdated,
}: {
  dr: DiscoveryRequest;
  token: string;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [showErrInput, setShowErrInput] = useState(false);

  const patch = useCallback(
    async (payload: Record<string, unknown>) => {
      setSaving(true);
      try {
        await fetch("/api/admin/discovery-requests", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: dr.id, ...payload }),
        });
        onUpdated();
      } finally {
        setSaving(false);
      }
    },
    [dr.id, token, onUpdated],
  );

  const handleSelectCandidate = useCallback(
    (idx: number) => {
      const updated = (dr.candidate_urls ?? []).map((c, i) => ({
        ...c,
        selected: i === idx,
      }));
      patch({ candidate_urls: updated });
    },
    [dr.candidate_urls, patch],
  );

  const handleNoMatch = useCallback(() => {
    patch({
      status: "no_match",
      error_message:
        "Human review: none of the official candidates matched this submitted photo.",
    });
  }, [patch]);

  const handleNeedsReview = useCallback(
    () => patch({ status: "needs_review" }),
    [patch],
  );

  const handleFailed = useCallback(() => {
    if (showErrInput) {
      patch({
        status: "failed",
        error_message: errMsg || "Marked as failed by admin.",
      });
      setShowErrInput(false);
    } else {
      setShowErrInput(true);
    }
  }, [showErrInput, errMsg, patch]);

  const handleManualUrl = useCallback(() => {
    if (!manualUrl.trim()) return;
    patch({
      status: "needs_review",
      error_message: `Manual official URL: ${manualUrl.trim()}`,
    });
    setManualUrl("");
  }, [manualUrl, patch]);

  const rawVision = dr.raw_vision as Record<string, unknown> | null;
  const collectorExtraction = rawVision?.collector_image_extraction as
    Record<string, unknown> | undefined;

  return (
    <>
      <tr>
        <Td>
          {dr.image_url ? (
            <a href={dr.image_url} target="_blank" rel="noreferrer">
              <Thumb src={dr.image_url} alt="" />
            </a>
          ) : (
            <NoImage>📷</NoImage>
          )}
        </Td>

        <Td>
          <InfoGrid>
            {dr.extracted_title_ko && (
              <>
                <InfoLabel>KO</InfoLabel>
                <InfoValue>{dr.extracted_title_ko}</InfoValue>
              </>
            )}
            {dr.extracted_title_ja && (
              <>
                <InfoLabel>JA</InfoLabel>
                <InfoValue>{dr.extracted_title_ja}</InfoValue>
              </>
            )}
            {dr.manufacturer_hint && (
              <>
                <InfoLabel>제조사</InfoLabel>
                <InfoValue>{dr.manufacturer_hint}</InfoValue>
              </>
            )}
            {dr.jan_code && (
              <>
                <InfoLabel>JAN</InfoLabel>
                <InfoValue>{dr.jan_code}</InfoValue>
              </>
            )}
            {dr.price_krw && (
              <>
                <InfoLabel>가격</InfoLabel>
                <InfoValue>{dr.price_krw.toLocaleString()}원</InfoValue>
              </>
            )}
            {!!rawVision?.ip_name && (
              <>
                <InfoLabel>IP</InfoLabel>
                <InfoValue>{String(rawVision.ip_name)}</InfoValue>
              </>
            )}
            {!!rawVision?.series_label && (
              <>
                <InfoLabel>시리즈</InfoLabel>
                <InfoValue>{String(rawVision.series_label)}</InfoValue>
              </>
            )}
            {collectorExtraction && (
              <>
                <InfoLabel>collector</InfoLabel>
                <InfoValue>{JSON.stringify(collectorExtraction)}</InfoValue>
              </>
            )}
          </InfoGrid>
        </Td>

        <Td>{dr.shops?.name ?? dr.shop_id?.slice(0, 8) ?? "—"}</Td>

        <Td>
          <Badge $color={STATUS_COLORS[dr.status] ?? "#888"}>{dr.status}</Badge>
        </Td>

        <Td>
          {dr.matched_product ? (
            <span title={dr.matched_product.id}>
              {dr.matched_product.name_ko ?? dr.matched_product.name}
            </span>
          ) : (
            "—"
          )}
        </Td>

        <Td>{dr.attempt_count}</Td>

        <Td style={{ maxWidth: 160 }}>
          {dr.error_message ? (
            <span
              title={dr.error_message}
              style={{ fontSize: 11, opacity: 0.8 }}
            >
              {dr.error_message.slice(0, 60)}
              {dr.error_message.length > 60 ? "…" : ""}
            </span>
          ) : (
            "—"
          )}
        </Td>

        <Td>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* 후보 펼치기 */}
            {(dr.candidate_urls?.length ?? 0) > 0 && (
              <ExpandBtn onClick={() => setExpanded((v) => !v)}>
                후보 {dr.candidate_urls!.length}개 {expanded ? "▲" : "▼"}
              </ExpandBtn>
            )}
            {/* 액션 버튼 */}
            <CandidateActions>
              <ActionBtn
                $variant="warn"
                onClick={handleNeedsReview}
                disabled={saving}
              >
                재검수 필요
              </ActionBtn>
              <ActionBtn
                $variant="danger"
                onClick={handleNoMatch}
                disabled={saving}
              >
                정답 없음
              </ActionBtn>
              <ActionBtn
                $variant="gray"
                onClick={handleFailed}
                disabled={saving}
              >
                {showErrInput ? "확인" : "실패 처리"}
              </ActionBtn>
            </CandidateActions>
            {showErrInput && (
              <ErrInput
                placeholder="오류 메시지 입력"
                value={errMsg}
                onChange={(e) => setErrMsg(e.target.value)}
              />
            )}
            {/* 공식 URL 직접 입력 */}
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              <UrlInput
                placeholder="공식 URL 직접 입력"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
              />
              <ActionBtn
                $variant="primary"
                onClick={handleManualUrl}
                disabled={saving || !manualUrl.trim()}
              >
                저장
              </ActionBtn>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
            {fmtDate(dr.created_at)}
          </div>
        </Td>
      </tr>

      {/* 후보 펼침 */}
      {expanded && (dr.candidate_urls?.length ?? 0) > 0 && (
        <tr>
          <Td
            colSpan={8}
            style={{ background: "#fafafa", paddingTop: 4, paddingBottom: 12 }}
          >
            <CandidateList>
              {dr.candidate_urls!.map((c, i) => (
                <CandidateItem key={i} $selected={!!c.selected}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {c.name_ja && (
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>
                          {c.name_ja}
                        </div>
                      )}
                      {c.source_url && (
                        <a
                          href={c.source_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11,
                            color: "#6366f1",
                            wordBreak: "break-all",
                          }}
                        >
                          {c.source_url}
                        </a>
                      )}
                      <div
                        style={{ marginTop: 2, fontSize: 11, color: "#888" }}
                      >
                        {c.score != null && <span>score: {c.score} </span>}
                        {c.reasons && c.reasons.length > 0 && (
                          <span>| {c.reasons.join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <ActionBtn
                      $variant={c.selected ? "primary" : "gray"}
                      onClick={() => handleSelectCandidate(i)}
                      disabled={saving}
                    >
                      {c.selected ? "✓ 선택됨" : "선택"}
                    </ActionBtn>
                  </div>
                </CandidateItem>
              ))}
            </CandidateList>
          </Td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ObservationsAdminPage() {
  const [tab, setTab] = useState<"observations" | "discovery">("observations");

  const [obsStatus, setObsStatus] = useState("needs_review");
  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsTotal, setObsTotal] = useState(0);
  const [obsOffset, setObsOffset] = useState(0);
  const [obsLoading, setObsLoading] = useState(false);

  const [drStatus, setDrStatus] = useState("needs_review");
  const [requests, setRequests] = useState<DiscoveryRequest[]>([]);
  const [drTotal, setDrTotal] = useState(0);
  const [drOffset, setDrOffset] = useState(0);
  const [drLoading, setDrLoading] = useState(false);

  const [token, setToken] = useState("");

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        setToken(session?.access_token ?? "");
      });
  }, []);

  const fetchObservations = useCallback(
    async (status: string, offset: number) => {
      if (!token) return;
      setObsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/observations?status=${status}&offset=${offset}&limit=${LIMIT}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setObservations(data.observations);
          setObsTotal(data.total);
        }
      } finally {
        setObsLoading(false);
      }
    },
    [token],
  );

  const fetchDiscovery = useCallback(
    async (status: string, offset: number) => {
      if (!token) return;
      setDrLoading(true);
      try {
        const res = await fetch(
          `/api/admin/discovery-requests?status=${status}&offset=${offset}&limit=${LIMIT}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setRequests(data.requests);
          setDrTotal(data.total);
        }
      } finally {
        setDrLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (tab === "observations" && token)
      fetchObservations(obsStatus, obsOffset); // eslint-disable-line react-hooks/set-state-in-effect
  }, [tab, obsStatus, obsOffset, fetchObservations, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "discovery" && token) fetchDiscovery(drStatus, drOffset);
  }, [tab, drStatus, drOffset, fetchDiscovery, token]);

  const handleDrUpdated = useCallback(() => {
    fetchDiscovery(drStatus, drOffset);
  }, [fetchDiscovery, drStatus, drOffset]);

  return (
    <Container>
      <Title>제보 & 수집 큐</Title>

      <TabBar>
        <Tab
          $active={tab === "observations"}
          onClick={() => setTab("observations")}
        >
          제보 내역
        </Tab>
        <Tab $active={tab === "discovery"} onClick={() => setTab("discovery")}>
          Collector 큐
        </Tab>
      </TabBar>

      {/* ── 제보 내역 ── */}
      {tab === "observations" && (
        <>
          <StatusFilter>
            {OBS_STATUSES.map((s) => (
              <StatusBtn
                key={s}
                $active={obsStatus === s}
                onClick={() => {
                  setObsStatus(s);
                  setObsOffset(0);
                }}
              >
                {s}
              </StatusBtn>
            ))}
          </StatusFilter>

          {obsLoading ? (
            <Empty>로딩 중...</Empty>
          ) : observations.length === 0 ? (
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
                      {obs.image_url ? (
                        <a
                          href={obs.image_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Thumb src={obs.image_url} alt="" />
                        </a>
                      ) : (
                        <NoImage>📷</NoImage>
                      )}
                    </Td>
                    <Td>
                      {obs.observed_title_ko ?? obs.observed_title_ja ?? "—"}
                    </Td>
                    <Td>
                      {!!obs.raw_vision?.ip_name && (
                        <div style={{ fontSize: 12 }}>
                          {String(obs.raw_vision.ip_name)}
                        </div>
                      )}
                      {!!obs.raw_vision?.series_label && (
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {String(obs.raw_vision.series_label)}
                        </div>
                      )}
                    </Td>
                    <Td>{obs.source_type}</Td>
                    <Td>
                      {obs.shops?.name ?? obs.shop_id?.slice(0, 8) ?? "—"}
                    </Td>
                    <Td>
                      <Badge $color={STATUS_COLORS[obs.status] ?? "#888"}>
                        {obs.status}
                      </Badge>
                    </Td>
                    <Td>{fmtDate(obs.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <Pagination>
            <span>
              {obsTotal}개 중 {Math.min(obsOffset + 1, obsTotal)}–
              {Math.min(obsOffset + LIMIT, obsTotal)}
            </span>
            <PagBtn
              disabled={obsOffset === 0}
              onClick={() => setObsOffset((p) => Math.max(0, p - LIMIT))}
            >
              이전
            </PagBtn>
            <PagBtn
              disabled={obsOffset + LIMIT >= obsTotal}
              onClick={() => setObsOffset((p) => p + LIMIT)}
            >
              다음
            </PagBtn>
          </Pagination>
        </>
      )}

      {/* ── Collector 큐 ── */}
      {tab === "discovery" && (
        <>
          <StatusFilter>
            {DR_STATUSES.map((s) => (
              <StatusBtn
                key={s}
                $active={drStatus === s}
                onClick={() => {
                  setDrStatus(s);
                  setDrOffset(0);
                }}
              >
                {s}
              </StatusBtn>
            ))}
          </StatusFilter>

          {drLoading ? (
            <Empty>로딩 중...</Empty>
          ) : requests.length === 0 ? (
            <Empty>항목 없음</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>이미지</Th>
                  <Th>추출 정보</Th>
                  <Th>샵</Th>
                  <Th>상태</Th>
                  <Th>매칭 상품</Th>
                  <Th>시도</Th>
                  <Th>오류</Th>
                  <Th>액션</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((dr) => (
                  <DrRow
                    key={dr.id}
                    dr={dr}
                    token={token}
                    onUpdated={handleDrUpdated}
                  />
                ))}
              </tbody>
            </Table>
          )}

          <Pagination>
            <span>
              {drTotal}개 중 {Math.min(drOffset + 1, drTotal)}–
              {Math.min(drOffset + LIMIT, drTotal)}
            </span>
            <PagBtn
              disabled={drOffset === 0}
              onClick={() => setDrOffset((p) => Math.max(0, p - LIMIT))}
            >
              이전
            </PagBtn>
            <PagBtn
              disabled={drOffset + LIMIT >= drTotal}
              onClick={() => setDrOffset((p) => p + LIMIT)}
            >
              다음
            </PagBtn>
          </Pagination>
        </>
      )}
    </Container>
  );
}
