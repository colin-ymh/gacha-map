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

const ItemRow = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid ${SHIMMER_BASE};
`;

const ITEMS = Array.from({ length: 5 });

export default function ShopOwnerGachaLoading() {
  return (
    <PageShell>
      <Bone $w="120px" $h="20px" style={{ marginBottom: "20px" }} />
      {ITEMS.map((_, i) => (
        <ItemRow key={i}>
          <Bone
            $w="72px"
            $h="72px"
            $radius="8px"
            style={{ flexShrink: 0 } as React.CSSProperties}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Bone $w="60%" $h="15px" />
            <Bone $w="40%" $h="12px" />
            <Bone $w="50%" $h="12px" />
          </div>
        </ItemRow>
      ))}
    </PageShell>
  );
}
