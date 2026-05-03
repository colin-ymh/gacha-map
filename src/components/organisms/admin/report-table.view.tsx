"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminReportItem } from "@/types";

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
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme, $status }) => {
    switch ($status) {
      case "pending":
        return theme.colors.infoBg;
      case "reviewed":
        return theme.colors.successBg;
      default:
        return theme.colors.gray100;
    }
  }};
  color: ${({ theme, $status }) => {
    switch ($status) {
      case "pending":
        return theme.colors.infoText;
      case "reviewed":
        return theme.colors.successText;
      default:
        return theme.colors.textGray;
    }
  }};
`;

const ActionCell = styled.td`
  padding: 12px 16px;
`;

const ActionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ActionButton = styled.button`
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

const ResolveButton = styled(ActionButton)`
  background-color: ${({ theme }) => theme.colors.gray100};
  color: ${({ theme }) => theme.colors.textGray};

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray400};
    color: ${({ theme }) => theme.colors.white};
  }
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface ReportTableViewProps {
  reports: AdminReportItem[];
  isLoading: boolean;
  processingId: string | null;
  onApprove: (reportId: string) => void;
  onReject: (reportId: string) => void;
}

const ReportTableView = ({
  reports,
  isLoading,
  processingId,
  onApprove,
  onReject,
}: ReportTableViewProps) => {
  const t = useTranslations("admin.reports");

  if (isLoading) {
    return <EmptyMessage>{t("loading")}</EmptyMessage>;
  }

  if (reports.length === 0) {
    return <EmptyMessage>{t("empty")}</EmptyMessage>;
  }

  return (
    <Table>
      <TableHead>
        <tr>
          <TableHeadCell>{t("tableId")}</TableHeadCell>
          <TableHeadCell>{t("tableSubmitter")}</TableHeadCell>
          <TableHeadCell>{t("tableShop")}</TableHeadCell>
          <TableHeadCell>{t("tableType")}</TableHeadCell>
          <TableHeadCell>{t("tableStatus")}</TableHeadCell>
          <TableHeadCell>{t("tableAction")}</TableHeadCell>
        </tr>
      </TableHead>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell title={report.id}>{report.id.slice(0, 8)}</TableCell>
            <TableCell>{report.reporter_name || "-"}</TableCell>
            <TableCell>{report.shop_name || "-"}</TableCell>
            <TableCell>{report.report_type}</TableCell>
            <TableCell>
              <StatusBadge $status={report.status}>
                {report.status === "pending" && t("statusPending")}
                {report.status === "reviewed" && t("statusReviewed")}
                {report.status === "resolved" && t("statusResolved")}
              </StatusBadge>
            </TableCell>
            <ActionCell>
              {report.status === "pending" && (
                <ActionContainer>
                  <ActionButton
                    disabled={processingId === report.id}
                    onClick={() => onApprove(report.id)}
                  >
                    {t("markReviewed")}
                  </ActionButton>
                  <ResolveButton
                    disabled={processingId === report.id}
                    onClick={() => onReject(report.id)}
                  >
                    {t("markResolved")}
                  </ResolveButton>
                </ActionContainer>
              )}
              {report.status !== "pending" && (
                <StatusBadge $status={report.status}>
                  {report.status === "reviewed" && t("statusReviewed")}
                  {report.status === "resolved" && t("statusResolved")}
                </StatusBadge>
              )}
            </ActionCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default ReportTableView;
