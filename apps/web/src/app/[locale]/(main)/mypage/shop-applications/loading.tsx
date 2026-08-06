"use client";

import styled, { keyframes } from "styled-components";
import PageShell from "@/components/templates/common/page-shell";
import { SHIMMER_BASE, SHIMMER_HIGHLIGHT } from "@/styles/color";

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

const Bone = styled.div<{ $w?: string; $h?: string; $radius?: string }>`
  width: ${({ $w }) => $w ?? "100%"};
  height: ${({ $h }) => $h ?? "16px"};
  border-radius: ${({ $radius }) => $radius ?? "6px"};
  background: linear-gradient(
    90deg,
    ${SHIMMER_BASE} 25%,
    ${SHIMMER_HIGHLIGHT} 50%,
    ${SHIMMER_BASE} 75%
  );
  background-size: 800px 100%;
  animation: ${shimmer} 1.4s infinite linear;
`;

const AppCardRow = styled.div`
  padding: 14px 0;
  border-bottom: 1px solid ${SHIMMER_BASE};
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CardTop = styled.div`
  display: flex;
  justify-content: space-between;
`;

const APPS = Array.from({ length: 4 });

export default function ShopApplicationsLoading() {
  return (
    <PageShell>
      <Bone $w="140px" $h="20px" style={{ marginBottom: "20px" }} />
      {APPS.map((_, i) => (
        <AppCardRow key={i}>
          <CardTop>
            <Bone $w="50%" $h="16px" />
            <Bone $w="70px" $h="20px" $radius="10px" />
          </CardTop>
          <Bone $w="40%" $h="12px" />
          <Bone $w="80%" $h="12px" />
        </AppCardRow>
      ))}
    </PageShell>
  );
}
