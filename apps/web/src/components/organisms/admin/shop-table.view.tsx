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
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface ShopTableViewProps {
  shops: AdminShopItem[];
  isLoading: boolean;
  updatingId: string | null;
  hideAction: boolean;
  onActionClick: (shopId: string) => void;
}

const ShopTableView = ({
  shops,
  isLoading,
  updatingId,
  hideAction,
  onActionClick,
}: ShopTableViewProps) => {
  const t = useTranslations("admin.shops");

  if (isLoading) {
    return <EmptyMessage>{t("loading")}</EmptyMessage>;
  }

  if (shops.length === 0) {
    return <EmptyMessage>{t("empty")}</EmptyMessage>;
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeadCell>{t("tableId")}</TableHeadCell>
          <TableHeadCell>{t("tableName")}</TableHeadCell>
          <TableHeadCell>{t("tableAddress")}</TableHeadCell>
          <TableHeadCell>{t("tableAuth")}</TableHeadCell>
          <TableHeadCell>{t("tableAction")}</TableHeadCell>
        </tr>
      </TableHead>
      <TableBody>
        {shops.map((shop) => (
          <TableRow key={shop.id}>
            <TableCell>{shop.id.slice(0, 8)}</TableCell>
            <TableCell>{shop.name}</TableCell>
            <TableCell>{shop.address || "-"}</TableCell>
            <TableCell>
              <AuthBadge $authorized={shop.is_authorized}>
                {shop.is_authorized ? t("authorized") : t("notAuthorized")}
              </AuthBadge>
            </TableCell>
            <TableCell>
              <ActionButton
                disabled={updatingId === shop.id}
                onClick={() => onActionClick(shop.id)}
              >
                {hideAction ? t("unhideBtn") : t("hideBtn")}
              </ActionButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default ShopTableView;
