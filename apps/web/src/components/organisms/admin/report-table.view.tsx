"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminReportItem } from "@/types";

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

const DuplicateBadge = styled.span`
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};
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

interface ReportTableViewProps {
  reports: AdminReportItem[];
  isLoading: boolean;
  selectedReportId: string | null;
  onSelectReport: (report: AdminReportItem) => void;
}

const ReportTableView = ({
  reports,
  isLoading,
  selectedReportId,
  onSelectReport,
}: ReportTableViewProps) => {
  const t = useTranslations("admin.reports");

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
          <col style={{ width: "80px" }} />
          <col style={{ width: "80px" }} />
          <col />
          <col style={{ width: "80px" }} />
          <col style={{ width: "80px" }} />
        </colgroup>
        <TableHead>
          <tr>
            <TableHeadCell>{t("tableId")}</TableHeadCell>
            <TableHeadCell>{t("tableType")}</TableHeadCell>
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
              <TableCell title={report.id}>{report.id.slice(0, 8)}</TableCell>
              <TableCell>
                {report.report_type === "new_shop" && t("typeNewShop")}
                {report.report_type === "fix_info" && t("typeFixInfo")}
                {report.report_type === "closed" && t("typeClosed")}
                {report.report_type === "other" && t("typeOther")}
              </TableCell>
              <TableCell>
                {report.shop_name || report.proposed_shop_name || "-"}
                {report.duplicate_report_count > 1 && (
                  <DuplicateBadge>
                    {t("duplicateBadge", {
                      count: report.duplicate_report_count,
                    })}
                  </DuplicateBadge>
                )}
              </TableCell>
              <TableCell>
                {new Date(report.created_at).toLocaleDateString("ko-KR")}
              </TableCell>
              <TableCell>
                <StatusBadge $status={report.status}>
                  {report.status === "pending" && t("statusPending")}
                  {report.status === "reviewed" && t("statusReviewed")}
                  {report.status === "resolved" && t("statusResolved")}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableScrollWrapper>
  );
};

export default ReportTableView;
