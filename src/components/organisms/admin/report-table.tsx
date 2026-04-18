"use client";

import { useState } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { AdminReportItem } from "@/types";

// ── Styled Components ───────────────────────────────────────────────────────

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
      case "approved":
        return theme.colors.successBg;
      case "rejected":
        return theme.colors.dangerBg;
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
      case "rejected":
        return theme.colors.dangerText;
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
  gap: 8px;
`;

const Button = styled.button`
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

const RejectButton = styled(Button)`
  background-color: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};

  &:hover {
    background-color: ${({ theme }) => theme.colors.dangerText};
    color: ${({ theme }) => theme.colors.white};
  }
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const Dropdown = styled.div`
  position: relative;
  display: inline-block;
  width: 100%;
`;

const DropdownContent = styled.div<{ $open: boolean }>`
  display: ${({ $open }) => ($open ? "flex" : "none")};
  flex-direction: column;
  gap: 4px;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-top: 4px;
  z-index: 10;
  box-shadow: ${({ theme }) => theme.shadow.md};
`;

const DropdownItem = styled.button`
  padding: 8px 12px;
  text-align: left;
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  transition: background-color 0.15s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray100};
  }
`;

const InlineForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
`;

const InlineInput = styled.input`
  padding: 6px 8px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primaryBg};
  }
`;

const InlineSearch = styled.input`
  padding: 6px 8px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primaryBg};
  }
`;

const SearchResults = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
`;

const SearchResultItem = styled.button`
  padding: 8px 12px;
  text-align: left;
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  transition: background-color 0.15s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray100};
  }
`;

// ── Component ───────────────────────────────────────────────────────────────

interface ReportTableProps {
  reports: AdminReportItem[];
  isLoading: boolean;
  onApprove: (
    reportId: string,
    mode: "new" | "link",
    shopId?: string,
  ) => Promise<void>;
  onReject: (reportId: string, reason: string) => Promise<void>;
}

interface ShopSearchResult {
  id: string;
  name: string;
}

export default function ReportTable({
  reports,
  isLoading,
  onApprove,
  onReject,
}: ReportTableProps) {
  const t = useTranslations("admin.reports");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shopSearchQuery, setShopSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ShopSearchResult[]>([]);
  const [selectedShop, setSelectedShop] = useState<ShopSearchResult | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const handleApproveClick = (reportId: string) => {
    setExpandedId(expandedId === reportId ? null : reportId);
    setRejectReason("");
    setShopSearchQuery("");
    setSelectedShop(null);
  };

  const handleApproveNew = async (reportId: string) => {
    setProcessingId(reportId);
    try {
      await onApprove(reportId, "new");
      setExpandedId(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveLink = async (reportId: string, shopId: string) => {
    setProcessingId(reportId);
    try {
      await onApprove(reportId, "link", shopId);
      setExpandedId(null);
      setSelectedShop(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (reportId: string) => {
    setExpandedId(expandedId === reportId ? null : reportId);
    setRejectReason("");
    setShopSearchQuery("");
    setSelectedShop(null);
  };

  const handleRejectSubmit = async (reportId: string) => {
    if (!rejectReason.trim()) {
      return;
    }
    setProcessingId(reportId);
    try {
      await onReject(reportId, rejectReason);
      setExpandedId(null);
      setRejectReason("");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSearchShop = async (query: string) => {
    setShopSearchQuery(query);
    if (query.length === 0) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/shops?q=${encodeURIComponent(query)}`,
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(
          (data.shops || []).map((shop: AdminReportItem) => ({
            id: shop.id,
            name: shop.name,
          })),
        );
      }
    } catch {
      setSearchResults([]);
    }
  };

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
            <TableCell>{report.id.slice(0, 8)}</TableCell>
            <TableCell>{report.submitter_name || "-"}</TableCell>
            <TableCell>{report.name || "-"}</TableCell>
            <TableCell>
              {report.description ? report.description.slice(0, 20) : "-"}
            </TableCell>
            <TableCell>
              <StatusBadge $status={report.status}>
                {report.status === "pending" && t("statusPending")}
                {report.status === "approved" && t("statusApproved")}
                {report.status === "rejected" && t("statusRejected")}
              </StatusBadge>
            </TableCell>
            <ActionCell>
              {report.status === "pending" ? (
                <ActionContainer>
                  <Dropdown>
                    <Button
                      disabled={processingId === report.id}
                      onClick={() => handleApproveClick(report.id)}
                    >
                      {t("approveBtn")} ▼
                    </Button>
                    <DropdownContent
                      $open={expandedId === report.id && !rejectReason}
                    >
                      <DropdownItem onClick={() => handleApproveNew(report.id)}>
                        {t("approveNew")}
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => {
                          setShopSearchQuery("");
                          setSelectedShop(null);
                          setSearchResults([]);
                        }}
                      >
                        {t("approveLink")}
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>

                  {expandedId === report.id &&
                    !rejectReason &&
                    searchResults.length === 0 &&
                    shopSearchQuery === "" && (
                      <InlineForm>
                        <InlineSearch
                          placeholder={t("searchShop")}
                          value={shopSearchQuery}
                          onChange={(e) => handleSearchShop(e.target.value)}
                        />
                      </InlineForm>
                    )}

                  {expandedId === report.id &&
                    !rejectReason &&
                    (shopSearchQuery || selectedShop) && (
                      <InlineForm>
                        <InlineSearch
                          placeholder={t("searchShop")}
                          value={shopSearchQuery}
                          onChange={(e) => handleSearchShop(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                          <SearchResults>
                            {searchResults.map((shop) => (
                              <SearchResultItem
                                key={shop.id}
                                onClick={() => {
                                  setSelectedShop(shop);
                                  setShopSearchQuery("");
                                  setSearchResults([]);
                                }}
                              >
                                {shop.name}
                              </SearchResultItem>
                            ))}
                          </SearchResults>
                        )}
                        {selectedShop && (
                          <div>
                            <small>{selectedShop.name}</small>
                            <Button
                              disabled={processingId === report.id}
                              onClick={() =>
                                handleApproveLink(report.id, selectedShop.id)
                              }
                            >
                              확인
                            </Button>
                          </div>
                        )}
                      </InlineForm>
                    )}

                  <RejectButton
                    disabled={processingId === report.id}
                    onClick={() => handleRejectClick(report.id)}
                  >
                    {t("rejectBtn")}
                  </RejectButton>

                  {expandedId === report.id && rejectReason !== undefined && (
                    <InlineForm>
                      <InlineInput
                        placeholder={t("rejectPlaceholder")}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <Button
                        disabled={
                          !rejectReason.trim() || processingId === report.id
                        }
                        onClick={() => handleRejectSubmit(report.id)}
                      >
                        {t("rejectConfirm")}
                      </Button>
                    </InlineForm>
                  )}
                </ActionContainer>
              ) : (
                <StatusBadge $status={report.status}>
                  {report.status === "approved" && t("statusApproved")}
                  {report.status === "rejected" && t("statusRejected")}
                </StatusBadge>
              )}
            </ActionCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
