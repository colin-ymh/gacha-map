"use client";

import { useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminShopOwnerApplicationItem } from "@/types";
import {
  BADGE_NEW_SHOP_BG,
  BADGE_NEW_SHOP_TEXT,
  BADGE_CLAIM_SHOP_BG,
  BADGE_CLAIM_SHOP_TEXT,
  SUCCESS_BG,
  SUCCESS_TEXT,
  DANGER_BG,
  DANGER_TEXT,
  REPORT_STATUS_PENDING_BG,
  REPORT_STATUS_PENDING_TEXT,
} from "@/styles/color";

// ── Styled ────────────────────────────────────────────────────────────────────

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
  vertical-align: top;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ActionCell = styled.td`
  padding: 12px 16px;
  vertical-align: top;
  min-width: 180px;
`;

const ActionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ApproveButton = styled.button`
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  transition: all 0.15s;
  background-color: ${({ theme }) => theme.colors.primaryBg};
  color: ${({ theme }) => theme.colors.primary};

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const RejectButton = styled.button`
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  transition: all 0.15s;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};

  &:hover {
    background-color: ${({ theme }) => theme.colors.dangerText};
    color: ${({ theme }) => theme.colors.white};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const RejectForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
`;

const NoteInput = styled.input`
  padding: 5px 8px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ConfirmRejectButton = styled.button`
  padding: 5px 10px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  background-color: ${({ theme }) => theme.colors.dangerText};
  color: ${({ theme }) => theme.colors.white};

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

interface BadgeProps {
  $bg: string;
  $color: string;
}

const Badge = styled.span<BadgeProps>`
  display: inline-block;
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Badge maps ────────────────────────────────────────────────────────────────

const TYPE_BADGE = {
  new_shop: { bg: BADGE_NEW_SHOP_BG, color: BADGE_NEW_SHOP_TEXT },
  claim_shop: { bg: BADGE_CLAIM_SHOP_BG, color: BADGE_CLAIM_SHOP_TEXT },
};

const STATUS_BADGE = {
  pending: { bg: REPORT_STATUS_PENDING_BG, color: REPORT_STATUS_PENDING_TEXT },
  approved: { bg: SUCCESS_BG, color: SUCCESS_TEXT },
  rejected: { bg: DANGER_BG, color: DANGER_TEXT },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShopApplicationTableViewProps {
  applications: AdminShopOwnerApplicationItem[];
  isLoading: boolean;
  processingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
}

// ── View ──────────────────────────────────────────────────────────────────────

const ShopApplicationTableView = ({
  applications,
  isLoading,
  processingId,
  onApprove,
  onReject,
}: ShopApplicationTableViewProps) => {
  const t = useTranslations("admin.shopApplications");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  if (isLoading) {
    return <EmptyMessage>{t("loading")}</EmptyMessage>;
  }

  if (applications.length === 0) {
    return <EmptyMessage>{t("empty")}</EmptyMessage>;
  }

  const handleRejectClick = (id: string) => {
    setRejectingId(id);
    setRejectNote("");
  };

  const handleRejectConfirm = (id: string) => {
    onReject(id, rejectNote);
    setRejectingId(null);
    setRejectNote("");
  };

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeadCell>{t("tableId")}</TableHeadCell>
          <TableHeadCell>{t("tableType")}</TableHeadCell>
          <TableHeadCell>{t("tableShop")}</TableHeadCell>
          <TableHeadCell>{t("tableBizNum")}</TableHeadCell>
          <TableHeadCell>{t("tableRepresentative")}</TableHeadCell>
          <TableHeadCell>{t("tableDate")}</TableHeadCell>
          <TableHeadCell>{t("tableStatus")}</TableHeadCell>
          <TableHeadCell>{t("tableAction")}</TableHeadCell>
        </tr>
      </TableHead>
      <TableBody>
        {applications.map((app) => {
          const typeBadge = TYPE_BADGE[app.type];
          const statusBadge = STATUS_BADGE[app.status];
          const shopDisplay =
            app.shop_name ?? app.shop_name_existing ?? app.address ?? "-";
          const isProcessing = processingId === app.id;

          return (
            <TableRow key={app.id}>
              <TableCell title={app.id}>{app.id.slice(0, 8)}</TableCell>
              <TableCell>
                <Badge $bg={typeBadge.bg} $color={typeBadge.color}>
                  {app.type === "new_shop"
                    ? t("typeNewShop")
                    : t("typeClaimShop")}
                </Badge>
              </TableCell>
              <TableCell title={shopDisplay}>{shopDisplay}</TableCell>
              <TableCell>{app.business_registration_number}</TableCell>
              <TableCell>{app.representative_name}</TableCell>
              <TableCell>{formatDate(app.created_at)}</TableCell>
              <TableCell>
                <Badge $bg={statusBadge.bg} $color={statusBadge.color}>
                  {app.status === "pending"
                    ? t("statusPending")
                    : app.status === "approved"
                      ? t("statusApproved")
                      : t("statusRejected")}
                </Badge>
                {app.status === "rejected" && app.admin_note && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: "#6b7280",
                      whiteSpace: "normal",
                      maxWidth: 160,
                    }}
                  >
                    {app.admin_note}
                  </div>
                )}
              </TableCell>
              <ActionCell>
                {app.status === "pending" && (
                  <ActionContainer>
                    <ApproveButton
                      disabled={isProcessing}
                      onClick={() => onApprove(app.id)}
                    >
                      {t("approveBtn")}
                    </ApproveButton>
                    {rejectingId === app.id ? (
                      <RejectForm>
                        <NoteInput
                          placeholder={t("rejectNotePlaceholder")}
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          autoFocus
                        />
                        <ConfirmRejectButton
                          disabled={isProcessing}
                          onClick={() => handleRejectConfirm(app.id)}
                        >
                          {t("rejectConfirm")}
                        </ConfirmRejectButton>
                      </RejectForm>
                    ) : (
                      <RejectButton
                        disabled={isProcessing}
                        onClick={() => handleRejectClick(app.id)}
                      >
                        {t("rejectBtn")}
                      </RejectButton>
                    )}
                  </ActionContainer>
                )}
              </ActionCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default ShopApplicationTableView;
