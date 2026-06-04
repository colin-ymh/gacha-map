"use client";

import React, { useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type {
  AdminGachaProductItem,
  AdminGachaProductPendingCandidate,
  GachaProductNameCandidate,
  GachaProductNameCandidateSourceType,
} from "@/types";
import {
  SUCCESS_BG,
  SUCCESS_TEXT,
  DANGER_BG,
  DANGER_TEXT,
  REPORT_STATUS_PENDING_BG,
  REPORT_STATUS_PENDING_TEXT,
} from "@/styles/color";

// ── Styled ────────────────────────────────────────────────────────────────────

const TableScrollWrapper = styled.div`
  @media (max-width: 768px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
`;

const TableHead = styled.thead`
  background-color: ${({ theme }) => theme.colors.gray100};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TableHeadCell = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray700};
  white-space: nowrap;
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray50};
  }
`;

const TableCell = styled.td`
  padding: 12px 16px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  vertical-align: middle;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ExpandedRow = styled.tr`
  background-color: ${({ theme }) => theme.colors.gray50};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ExpandedCell = styled.td`
  padding: 16px;
`;

const ExpandedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CandidatesTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
`;

const CandidateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CandidateItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  flex-wrap: wrap;
`;

const CandidateName = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textDark};
  flex: 1;
  min-width: 120px;
`;

const CandidateMeta = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
`;

const CandidateActions = styled.div`
  display: flex;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
`;

const SmallButton = styled.button<{
  $variant: "approve" | "reject" | "neutral";
}>`
  padding: 4px 10px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  transition: all 0.15s;
  background-color: ${({ theme, $variant }) => {
    if ($variant === "approve") return theme.colors.primaryBg;
    if ($variant === "reject") return theme.colors.dangerBg;
    return theme.colors.gray100;
  }};
  color: ${({ theme, $variant }) => {
    if ($variant === "approve") return theme.colors.primary;
    if ($variant === "reject") return theme.colors.dangerText;
    return theme.colors.textGray;
  }};

  &:hover:not(:disabled) {
    background-color: ${({ theme, $variant }) => {
      if ($variant === "approve") return theme.colors.primary;
      if ($variant === "reject") return theme.colors.dangerText;
      return theme.colors.gray200;
    }};
    color: ${({ theme, $variant }) => {
      if ($variant === "approve" || $variant === "reject")
        return theme.colors.white;
      return theme.colors.textDark;
    }};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    min-height: 36px;
    padding: 6px 10px;
  }
`;

const AddCandidateForm = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const AddCandidateInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  outline: none;
  max-width: 300px;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ActionToggleButton = styled.button`
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  transition: all 0.15s;
  background-color: ${({ theme }) => theme.colors.primaryBg};
  color: ${({ theme }) => theme.colors.primary};
  white-space: nowrap;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
  }

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 8px 12px;
  }
`;

interface BadgeProps {
  $bg: string;
  $color: string;
}

const Badge = styled.span<BadgeProps>`
  display: inline-block;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  white-space: nowrap;
`;

const NameKoText = styled.span<{ $hasName: boolean }>`
  color: ${({ theme, $hasName }) =>
    $hasName ? theme.colors.textDark : theme.colors.textGray};
  font-style: ${({ $hasName }) => ($hasName ? "normal" : "italic")};
`;

const NameKoCell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const NameKoEditRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const InlineInput = styled.input`
  padding: 4px 8px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  outline: none;
  min-width: 120px;
  max-width: 200px;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const IconButton = styled.button`
  padding: 2px 6px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 500;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textGray};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray100};
    color: ${({ theme }) => theme.colors.textDark};
  }
`;

const ClearButton = styled(IconButton)`
  color: ${({ theme }) => theme.colors.dangerText};
  border-color: ${({ theme }) => theme.colors.dangerText};

  &:hover {
    background-color: ${({ theme }) => theme.colors.dangerBg};
  }
`;

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.dangerText};
`;

const InlineCandidateCell = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const InlineCandidateRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
`;

const WideTableCell = styled(TableCell)`
  max-width: 360px;
  white-space: normal;
  overflow: visible;
`;

const ProductThumb = styled.img`
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.gray50};
`;

const NoThumb = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.gray100};
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const LoadingText = styled.div`
  padding: 8px 0;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
`;

// ── Badge maps ────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  pending: { bg: REPORT_STATUS_PENDING_BG, color: REPORT_STATUS_PENDING_TEXT },
  approved: { bg: SUCCESS_BG, color: SUCCESS_TEXT },
  rejected: { bg: DANGER_BG, color: DANGER_TEXT },
};

const MANUAL_REVIEW_SOURCE_NAME = "collector_translation_failure";
const MANUAL_REVIEW_PLACEHOLDER = "수기 입력 필요";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sourceLabel(
  source: GachaProductNameCandidateSourceType,
  t: ReturnType<typeof useTranslations>,
  sourceName?: string,
): string {
  if (sourceName === MANUAL_REVIEW_SOURCE_NAME) {
    return t("sourceManualReview");
  }

  switch (source) {
    case "official_ko":
      return t("sourceOfficial");
    case "domestic_vendor":
      return t("sourceDomestic");
    case "admin":
      return t("sourceAdmin");
    case "machine":
      return t("sourceMachine");
    case "user_alias":
      return t("sourceUser");
  }
}

function isManualReviewPlaceholder(
  candidate: Pick<
    AdminGachaProductPendingCandidate | GachaProductNameCandidate,
    "name" | "source_name"
  >,
) {
  return (
    candidate.source_name === MANUAL_REVIEW_SOURCE_NAME &&
    candidate.name === MANUAL_REVIEW_PLACEHOLDER
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GachaProductTableViewProps {
  products: AdminGachaProductItem[];
  isLoading: boolean;
  activeTab: "all" | "unnamed";
  expandedProductId: string | null;
  candidatesMap: Record<string, GachaProductNameCandidate[]>;
  loadingCandidatesId: string | null;
  processingCandidateId: string | null;
  addingCandidateId: string | null;
  onToggleCandidates: (productId: string) => void;
  onApproveCandidate: (productId: string, candidateId: string) => void;
  onRejectCandidate: (productId: string, candidateId: string) => void;
  onAddCandidate: (productId: string, name: string) => void;
  onEditCandidate: (
    productId: string,
    candidateId: string,
    name: string,
  ) => Promise<string | null>;
  onUpdateNameKo: (productId: string, nameKo: string) => Promise<boolean>;
  onClearNameKo: (productId: string) => Promise<boolean>;
}

// ── View ──────────────────────────────────────────────────────────────────────

const GachaProductTableView = ({
  products,
  isLoading,
  activeTab,
  expandedProductId,
  candidatesMap,
  loadingCandidatesId,
  processingCandidateId,
  addingCandidateId,
  onToggleCandidates,
  onApproveCandidate,
  onRejectCandidate,
  onAddCandidate,
  onEditCandidate,
  onUpdateNameKo,
  onClearNameKo,
}: GachaProductTableViewProps) => {
  const t = useTranslations("admin.gachaProducts");
  const [addInputMap, setAddInputMap] = useState<Record<string, string>>({});
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(
    null,
  );
  const [editCandidateInput, setEditCandidateInput] = useState("");
  const [editCandidateError, setEditCandidateError] = useState<string | null>(
    null,
  );
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(
    null,
  );
  const [editingNameKoId, setEditingNameKoId] = useState<string | null>(null);
  const [nameKoInput, setNameKoInput] = useState("");
  const [savingNameKoId, setSavingNameKoId] = useState<string | null>(null);
  const [inlineEditingProductId, setInlineEditingProductId] = useState<
    string | null
  >(null);
  const [inlineEditInput, setInlineEditInput] = useState("");
  const [inlineEditError, setInlineEditError] = useState<string | null>(null);

  if (isLoading) {
    return <EmptyMessage>{t("loading")}</EmptyMessage>;
  }

  if (products.length === 0) {
    return <EmptyMessage>{t("empty")}</EmptyMessage>;
  }

  const handleAddSubmit = (productId: string) => {
    const name = (addInputMap[productId] ?? "").trim();
    if (!name) return;
    onAddCandidate(productId, name);
    setAddInputMap((prev) => ({ ...prev, [productId]: "" }));
  };

  const startEditCandidate = (c: GachaProductNameCandidate) => {
    setEditingCandidateId(c.id);
    setEditCandidateInput(c.name);
    setEditCandidateError(null);
  };

  const cancelEditCandidate = () => {
    setEditingCandidateId(null);
    setEditCandidateInput("");
    setEditCandidateError(null);
  };

  const saveEditCandidate = async (productId: string, candidateId: string) => {
    const name = editCandidateInput.trim();
    if (!name) return;
    setSavingCandidateId(candidateId);
    const err = await onEditCandidate(productId, candidateId, name);
    setSavingCandidateId(null);
    if (err === "duplicate") {
      setEditCandidateError(t("candidateNameDuplicate"));
      return;
    }
    if (err) return;
    cancelEditCandidate();
  };

  const startEditNameKo = (product: AdminGachaProductItem) => {
    setEditingNameKoId(product.id);
    setNameKoInput(product.name_ko ?? "");
  };

  const cancelEditNameKo = () => {
    setEditingNameKoId(null);
    setNameKoInput("");
  };

  const saveNameKo = async (productId: string) => {
    const name = nameKoInput.trim();
    if (!name) return;
    setSavingNameKoId(productId);
    await onUpdateNameKo(productId, name);
    setSavingNameKoId(null);
    cancelEditNameKo();
  };

  const startInlineEdit = (
    pc: AdminGachaProductPendingCandidate,
    productId: string,
  ) => {
    setInlineEditingProductId(productId);
    setInlineEditInput(pc.name);
    setInlineEditError(null);
  };

  const cancelInlineEdit = () => {
    setInlineEditingProductId(null);
    setInlineEditInput("");
    setInlineEditError(null);
  };

  const saveInlineEdit = async (productId: string, candidateId: string) => {
    const name = inlineEditInput.trim();
    if (!name) return;
    setSavingCandidateId(candidateId);
    const err = await onEditCandidate(productId, candidateId, name);
    setSavingCandidateId(null);
    if (err === "duplicate") {
      setInlineEditError(t("candidateNameDuplicate"));
      return;
    }
    if (err) return;
    cancelInlineEdit();
  };

  const COLS = 6;

  return (
    <TableScrollWrapper>
      <Table>
        <TableHead>
          <tr>
            <TableHeadCell>{t("tableImage")}</TableHeadCell>
            <TableHeadCell>{t("tableId")}</TableHeadCell>
            <TableHeadCell>{t("tableName")}</TableHeadCell>
            <TableHeadCell>{t("tableManufacturer")}</TableHeadCell>
            <TableHeadCell>{t("tableNameKo")}</TableHeadCell>
            <TableHeadCell>{t("tableAction")}</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {products.map((product) => {
            const isExpanded = expandedProductId === product.id;
            const candidates = candidatesMap[product.id];
            const isLoadingCandidates = loadingCandidatesId === product.id;
            const isAdding = addingCandidateId === product.id;

            return (
              <React.Fragment key={product.id}>
                <TableRow>
                  <TableCell>
                    {product.official_image_url ? (
                      <ProductThumb
                        src={product.official_image_url}
                        alt={product.name}
                      />
                    ) : (
                      <NoThumb />
                    )}
                  </TableCell>
                  <TableCell title={product.id}>
                    {product.id.slice(0, 8)}
                  </TableCell>
                  <TableCell title={product.name}>{product.name}</TableCell>
                  <TableCell title={product.manufacturer}>
                    {product.manufacturer}
                  </TableCell>
                  <WideTableCell>
                    {(() => {
                      const pc = product.pending_candidate;
                      const showInline =
                        activeTab === "unnamed" &&
                        pc &&
                        !product.name_ko &&
                        pc.status !== "rejected";

                      if (showInline && pc) {
                        const isManualPlaceholder =
                          isManualReviewPlaceholder(pc);
                        return (
                          <InlineCandidateCell>
                            {inlineEditingProductId === product.id ? (
                              <InlineCandidateRow>
                                <InlineInput
                                  autoFocus
                                  value={inlineEditInput}
                                  onChange={(e) => {
                                    setInlineEditInput(e.target.value);
                                    setInlineEditError(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      saveInlineEdit(product.id, pc.id);
                                    if (e.key === "Escape") cancelInlineEdit();
                                  }}
                                />
                                {inlineEditError && (
                                  <ErrorText>{inlineEditError}</ErrorText>
                                )}
                                <SmallButton
                                  $variant="approve"
                                  disabled={
                                    savingCandidateId === pc.id ||
                                    !inlineEditInput.trim()
                                  }
                                  onClick={() =>
                                    saveInlineEdit(product.id, pc.id)
                                  }
                                >
                                  {t("saveBtn")}
                                </SmallButton>
                                <SmallButton
                                  $variant="neutral"
                                  disabled={savingCandidateId === pc.id}
                                  onClick={cancelInlineEdit}
                                >
                                  {t("cancelBtn")}
                                </SmallButton>
                              </InlineCandidateRow>
                            ) : (
                              <InlineCandidateRow>
                                <CandidateName>{pc.name}</CandidateName>
                                <CandidateMeta>
                                  {sourceLabel(
                                    pc.source_type,
                                    t,
                                    pc.source_name,
                                  )}
                                </CandidateMeta>
                                <CandidateActions>
                                  {!isManualPlaceholder && (
                                    <SmallButton
                                      $variant="approve"
                                      disabled={processingCandidateId === pc.id}
                                      onClick={() =>
                                        onApproveCandidate(product.id, pc.id)
                                      }
                                    >
                                      {t("approveAsPrimary")}
                                    </SmallButton>
                                  )}
                                  <SmallButton
                                    $variant="reject"
                                    disabled={processingCandidateId === pc.id}
                                    onClick={() =>
                                      onRejectCandidate(product.id, pc.id)
                                    }
                                  >
                                    {t("rejectCandidate")}
                                  </SmallButton>
                                  <SmallButton
                                    $variant="neutral"
                                    disabled={processingCandidateId === pc.id}
                                    onClick={() =>
                                      startInlineEdit(pc, product.id)
                                    }
                                  >
                                    {t("editBtn")}
                                  </SmallButton>
                                </CandidateActions>
                              </InlineCandidateRow>
                            )}
                          </InlineCandidateCell>
                        );
                      }

                      if (editingNameKoId === product.id) {
                        return (
                          <NameKoEditRow>
                            <InlineInput
                              autoFocus
                              value={nameKoInput}
                              onChange={(e) => setNameKoInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveNameKo(product.id);
                                if (e.key === "Escape") cancelEditNameKo();
                              }}
                            />
                            <SmallButton
                              $variant="approve"
                              disabled={
                                savingNameKoId === product.id ||
                                !nameKoInput.trim()
                              }
                              onClick={() => saveNameKo(product.id)}
                            >
                              {t("saveBtn")}
                            </SmallButton>
                            <SmallButton
                              $variant="neutral"
                              disabled={savingNameKoId === product.id}
                              onClick={cancelEditNameKo}
                            >
                              {t("cancelBtn")}
                            </SmallButton>
                          </NameKoEditRow>
                        );
                      }

                      return (
                        <NameKoCell>
                          <NameKoText $hasName={!!product.name_ko}>
                            {product.name_ko ?? "-"}
                          </NameKoText>
                          <IconButton onClick={() => startEditNameKo(product)}>
                            {t("editBtn")}
                          </IconButton>
                          {product.name_ko && (
                            <ClearButton
                              onClick={() => onClearNameKo(product.id)}
                            >
                              {t("clearNameKoBtn")}
                            </ClearButton>
                          )}
                        </NameKoCell>
                      );
                    })()}
                  </WideTableCell>
                  <TableCell>
                    <ActionToggleButton
                      onClick={() => onToggleCandidates(product.id)}
                    >
                      {isExpanded ? t("closeBtn") : t("manageNameBtn")}
                    </ActionToggleButton>
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <ExpandedRow>
                    <ExpandedCell colSpan={COLS}>
                      <ExpandedContent>
                        <CandidatesTitle>
                          {t("candidatesTitle")}
                        </CandidatesTitle>

                        {isLoadingCandidates && (
                          <LoadingText>{t("loadingCandidates")}</LoadingText>
                        )}

                        {!isLoadingCandidates && candidates && (
                          <>
                            {candidates.length === 0 ? (
                              <LoadingText>{t("noCandidates")}</LoadingText>
                            ) : (
                              <CandidateList>
                                {candidates.map((c) => {
                                  const badge = STATUS_BADGE[c.status];
                                  const isProcessing =
                                    processingCandidateId === c.id;
                                  const isEditing = editingCandidateId === c.id;
                                  const isSaving = savingCandidateId === c.id;
                                  const isManualPlaceholder =
                                    isManualReviewPlaceholder(c);
                                  return (
                                    <CandidateItem key={c.id}>
                                      {isEditing ? (
                                        <>
                                          <InlineInput
                                            autoFocus
                                            value={editCandidateInput}
                                            onChange={(e) => {
                                              setEditCandidateInput(
                                                e.target.value,
                                              );
                                              setEditCandidateError(null);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                saveEditCandidate(
                                                  product.id,
                                                  c.id,
                                                );
                                              if (e.key === "Escape")
                                                cancelEditCandidate();
                                            }}
                                          />
                                          {editCandidateError && (
                                            <ErrorText>
                                              {editCandidateError}
                                            </ErrorText>
                                          )}
                                          <CandidateActions>
                                            <SmallButton
                                              $variant="approve"
                                              disabled={
                                                isSaving ||
                                                !editCandidateInput.trim()
                                              }
                                              onClick={() =>
                                                saveEditCandidate(
                                                  product.id,
                                                  c.id,
                                                )
                                              }
                                            >
                                              {t("saveBtn")}
                                            </SmallButton>
                                            <SmallButton
                                              $variant="neutral"
                                              disabled={isSaving}
                                              onClick={cancelEditCandidate}
                                            >
                                              {t("cancelBtn")}
                                            </SmallButton>
                                          </CandidateActions>
                                        </>
                                      ) : (
                                        <>
                                          <CandidateName>
                                            {c.name}
                                          </CandidateName>
                                          <CandidateMeta>
                                            {sourceLabel(
                                              c.source_type,
                                              t,
                                              c.source_name,
                                            )}
                                          </CandidateMeta>
                                          {c.is_primary && (
                                            <Badge
                                              $bg={SUCCESS_BG}
                                              $color={SUCCESS_TEXT}
                                            >
                                              {t("isPrimary")}
                                            </Badge>
                                          )}
                                          <Badge
                                            $bg={badge.bg}
                                            $color={badge.color}
                                          >
                                            {t(
                                              `status${c.status.charAt(0).toUpperCase() + c.status.slice(1)}` as
                                                | "statusPending"
                                                | "statusApproved"
                                                | "statusRejected",
                                            )}
                                          </Badge>
                                          <CandidateActions>
                                            {c.status !== "approved" && (
                                              <>
                                                {!isManualPlaceholder && (
                                                  <SmallButton
                                                    $variant="approve"
                                                    disabled={isProcessing}
                                                    onClick={() =>
                                                      onApproveCandidate(
                                                        product.id,
                                                        c.id,
                                                      )
                                                    }
                                                  >
                                                    {t("approveAsPrimary")}
                                                  </SmallButton>
                                                )}
                                                {c.status !== "rejected" && (
                                                  <SmallButton
                                                    $variant="reject"
                                                    disabled={isProcessing}
                                                    onClick={() =>
                                                      onRejectCandidate(
                                                        product.id,
                                                        c.id,
                                                      )
                                                    }
                                                  >
                                                    {t("rejectCandidate")}
                                                  </SmallButton>
                                                )}
                                              </>
                                            )}
                                            {c.status !== "approved" && (
                                              <SmallButton
                                                $variant="neutral"
                                                disabled={isProcessing}
                                                onClick={() =>
                                                  startEditCandidate(c)
                                                }
                                              >
                                                {t("editBtn")}
                                              </SmallButton>
                                            )}
                                          </CandidateActions>
                                        </>
                                      )}
                                    </CandidateItem>
                                  );
                                })}
                              </CandidateList>
                            )}
                          </>
                        )}

                        <AddCandidateForm>
                          <AddCandidateInput
                            placeholder={t("addCandidatePlaceholder")}
                            value={addInputMap[product.id] ?? ""}
                            onChange={(e) =>
                              setAddInputMap((prev) => ({
                                ...prev,
                                [product.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleAddSubmit(product.id);
                            }}
                          />
                          <SmallButton
                            $variant="neutral"
                            disabled={
                              isAdding ||
                              !(addInputMap[product.id] ?? "").trim()
                            }
                            onClick={() => handleAddSubmit(product.id)}
                          >
                            {t("addCandidateBtn")}
                          </SmallButton>
                        </AddCandidateForm>
                      </ExpandedContent>
                    </ExpandedCell>
                  </ExpandedRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableScrollWrapper>
  );
};

export default GachaProductTableView;
