"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminShopItem } from "@/types";

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
`;

const AuthBadge = styled.span<{ $authorized: boolean }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme, $authorized }) =>
    $authorized ? theme.colors.successBg : theme.colors.gray100};
  color: ${({ theme, $authorized }) =>
    $authorized ? theme.colors.successText : theme.colors.textGray};
`;

const OwnerBadge = styled.span`
  display: inline-block;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme }) => theme.colors.primaryBg};
  color: ${({ theme }) => theme.colors.primary};
`;

const TableScrollWrapper = styled.div`
  @media (max-width: 768px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
`;

const ActionCell = styled.td`
  padding: 12px 16px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ActionButton = styled.button`
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
    background-color: ${({ theme }) => theme.colors.dangerBgHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 8px 12px;
  }
`;

const DisconnectButton = styled.button`
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  transition: all 0.15s;
  background-color: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textGray};

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray100};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 8px 12px;
  }
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const FlagBadge = styled.span`
  display: inline-block;
  background-color: ${({ theme }) => theme.colors.warningBg};
  color: ${({ theme }) => theme.colors.warningText};
  font-size: ${({ theme }) => theme.fontSize.xs};
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-left: 6px;
`;

const HiddenReasonBadge = styled.span<{ $auto: boolean }>`
  display: inline-block;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme, $auto }) =>
    $auto ? theme.colors.warningBg : theme.colors.gray100};
  color: ${({ theme, $auto }) =>
    $auto ? theme.colors.warningText : theme.colors.textGray};
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface ShopTableViewProps {
  shops: AdminShopItem[];
  isLoading: boolean;
  updatingId: string | null;
  disconnectingId: string | null;
  hideAction: boolean;
  onActionClick: (shopId: string) => void;
  onDisconnectClick: (shopId: string) => void;
}

const ShopTableView = ({
  shops,
  isLoading,
  updatingId,
  disconnectingId,
  hideAction,
  onActionClick,
  onDisconnectClick,
}: ShopTableViewProps) => {
  const t = useTranslations("admin.shops");

  if (isLoading) {
    return <EmptyMessage>{t("loading")}</EmptyMessage>;
  }

  if (shops.length === 0) {
    return <EmptyMessage>{t("empty")}</EmptyMessage>;
  }

  return (
    <TableScrollWrapper>
      <Table>
        <TableHead>
          <tr>
            <TableHeadCell>{t("tableId")}</TableHeadCell>
            <TableHeadCell>{t("tableName")}</TableHeadCell>
            <TableHeadCell>{t("tableAddress")}</TableHeadCell>
            <TableHeadCell>{t("tableAuth")}</TableHeadCell>
            <TableHeadCell>{t("tableOwner")}</TableHeadCell>
            <TableHeadCell>{t("tableQuickReport")}</TableHeadCell>
            <TableHeadCell>{t("tableAction")}</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {shops.map((shop) => (
            <TableRow key={shop.id}>
              <TableCell>{shop.id.slice(0, 8)}</TableCell>
              <TableCell>
                {shop.name}
                {shop.hidden_reason && (
                  <HiddenReasonBadge
                    $auto={shop.hidden_reason === "auto_absent_report"}
                  >
                    {shop.hidden_reason === "auto_absent_report"
                      ? "자동 숨김"
                      : "수동 숨김"}
                  </HiddenReasonBadge>
                )}
              </TableCell>
              <TableCell>{shop.address || "-"}</TableCell>
              <TableCell>
                <AuthBadge $authorized={shop.is_authorized}>
                  {shop.is_authorized ? t("authorized") : t("notAuthorized")}
                </AuthBadge>
              </TableCell>
              <TableCell>
                {shop.owner_id ? (
                  <OwnerBadge>{t("hasOwner")}</OwnerBadge>
                ) : (
                  t("noOwner")
                )}
              </TableCell>
              <TableCell>
                ✅ {shop.quick_report_present ?? 0} / ❌{" "}
                {shop.quick_report_absent ?? 0}
                {(shop.quick_report_absent ?? 0) >= 3 && (
                  <FlagBadge>⚠️ 검토</FlagBadge>
                )}
              </TableCell>
              <ActionCell>
                <ActionButtons>
                  <ActionButton
                    disabled={updatingId === shop.id}
                    onClick={() => onActionClick(shop.id)}
                  >
                    {hideAction ? t("unhideBtn") : t("hideBtn")}
                  </ActionButton>
                  {shop.owner_id && (
                    <DisconnectButton
                      disabled={disconnectingId === shop.id}
                      onClick={() => onDisconnectClick(shop.id)}
                    >
                      {t("disconnectBtn")}
                    </DisconnectButton>
                  )}
                </ActionButtons>
              </ActionCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableScrollWrapper>
  );
};

export default ShopTableView;
