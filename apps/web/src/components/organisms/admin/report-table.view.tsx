"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminReportItem } from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

const Table = styled.table`
  width: 100%;
  min-width: 1100px;
  table-layout: fixed;
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

const TableScrollWrapper = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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

  @media (max-width: 768px) {
    min-height: 44px;
    padding: 8px 12px;
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
    <TableScrollWrapper>
      <Table>
        <colgroup>
          <col style={{ width: "90px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "100px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "300px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "80px" }} />
          <col style={{ width: "130px" }} />
        </colgroup>
        <TableHead>
          <tr>
            <TableHeadCell>{t("tableId")}</TableHeadCell>
            <TableHeadCell>{t("tableType")}</TableHeadCell>
            <TableHeadCell>{t("tableShop")}</TableHeadCell>
            <TableHeadCell>{t("tableSubmitter")}</TableHeadCell>
            <TableHeadCell>{t("tableContact")}</TableHeadCell>
            <TableHeadCell>{t("tableContent")}</TableHeadCell>
            <TableHeadCell>{t("tableDate")}</TableHeadCell>
            <TableHeadCell>{t("tableStatus")}</TableHeadCell>
            <TableHeadCell>{t("tableAction")}</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell title={report.id}>{report.id.slice(0, 8)}</TableCell>
              <TableCell>
                {report.report_type === "new_shop" && t("typeNewShop")}
                {report.report_type === "fix_info" && t("typeFixInfo")}
                {report.report_type === "closed" && t("typeClosed")}
                {report.report_type === "other" && t("typeOther")}
              </TableCell>
              <TableCell>{report.shop_name || "-"}</TableCell>
              <TableCell>{report.reporter_name || "-"}</TableCell>
              <TableCell>{report.reporter_contact || "-"}</TableCell>
              <TableCell title={report.content}>{report.content}</TableCell>
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
    </TableScrollWrapper>
  );
};

export default ReportTableView;
