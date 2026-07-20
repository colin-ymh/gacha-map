"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminReviewReportItem } from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

const Table = styled.table`
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  background-color: ${({ theme }) => theme.colors.white};
`;

const TableHead = styled.thead`
  background-color: ${({ theme }) => theme.colors.gray100};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const TableHeadCell = styled.th`
  padding: 10px 12px;
  text-align: left;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray700};
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr<{ $selected: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  cursor: pointer;
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primaryBg : "transparent"};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${({ theme, $selected }) =>
      $selected ? theme.colors.primaryBg : theme.colors.gray50};
  }
`;

const TableCell = styled.td`
  padding: 10px 12px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-block;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme, $status }) => {
    switch ($status) {
      case "pending":
        return theme.colors.infoBg;
      case "approved":
        return theme.colors.successBg;
      default:
        return theme.colors.gray100;
    }
  }};
  color: ${({ theme, $status }) => {
    switch ($status) {
      case "pending":
        return theme.colors.infoText;
      case "approved":
        return theme.colors.successText;
      default:
        return theme.colors.textGray;
    }
  }};
`;

const DeletedBadge = styled.span`
  display: inline-block;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};
  margin-left: 6px;
`;

const TableScrollWrapper = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── View ──────────────────────────────────────────────────────────────────────

interface ReviewReportTableViewProps {
  reports: AdminReviewReportItem[];
  isLoading: boolean;
  selectedReportId: string | null;
  onSelectReport: (report: AdminReviewReportItem) => void;
}

const ReviewReportTableView = ({
  reports,
  isLoading,
  selectedReportId,
  onSelectReport,
}: ReviewReportTableViewProps) => {
  const t = useTranslations("admin.reviewReports");

  if (isLoading) {
    return <EmptyMessage>{t("loading")}</EmptyMessage>;
  }

  if (reports.length === 0) {
    return <EmptyMessage>{t("empty")}</EmptyMessage>;
  }

  return (
    <TableScrollWrapper>
      <Table>
        <colgroup>
          <col style={{ width: "90px" }} />
          <col />
          <col style={{ width: "80px" }} />
          <col style={{ width: "90px" }} />
        </colgroup>
        <TableHead>
          <tr>
            <TableHeadCell>{t("tableReason")}</TableHeadCell>
            <TableHeadCell>{t("tableShop")}</TableHeadCell>
            <TableHeadCell>{t("tableDate")}</TableHeadCell>
            <TableHeadCell>{t("tableStatus")}</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {reports.map((report) => (
            <TableRow
              key={report.id}
              $selected={selectedReportId === report.id}
              onClick={() => onSelectReport(report)}
            >
              <TableCell>{t(`reason${capitalize(report.reason)}`)}</TableCell>
              <TableCell>{report.shop_name || "-"}</TableCell>
              <TableCell>
                {new Date(report.created_at).toLocaleDateString("ko-KR")}
              </TableCell>
              <TableCell>
                <StatusBadge $status={report.status}>
                  {t(`status${capitalize(report.status)}`)}
                </StatusBadge>
                {report.review_deleted && (
                  <DeletedBadge>{t("deletedBadge")}</DeletedBadge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableScrollWrapper>
  );
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default ReviewReportTableView;
