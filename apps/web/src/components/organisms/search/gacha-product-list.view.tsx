"use client";

import styled from "styled-components";
import { TEXT_GRAY } from "@/styles/color";

interface GachaProductListViewProps {
  children: React.ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
}

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 40px 16px;
  color: ${TEXT_GRAY};
  font-size: 14px;
`;

export default function GachaProductListView({
  children,
  emptyMessage,
  isEmpty,
}: GachaProductListViewProps) {
  if (isEmpty) {
    return <EmptyMessage>{emptyMessage}</EmptyMessage>;
  }

  return <ListContainer>{children}</ListContainer>;
}
