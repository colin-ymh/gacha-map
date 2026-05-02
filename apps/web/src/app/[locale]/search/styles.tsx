"use client";

import styled from "styled-components";

export const TagFilter = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray500};
`;

export const Results = styled.section`
  margin-top: 24px;
  flex: 1;
  overflow-y: auto;
`;
