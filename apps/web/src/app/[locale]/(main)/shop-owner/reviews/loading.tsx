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

const ReviewRow = styled.div`
  padding: 14px 0;
  border-bottom: 1px solid ${SHIMMER_BASE};
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ReviewHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const REVIEWS = Array.from({ length: 4 });

export default function ShopOwnerReviewsLoading() {
  return (
    <PageShell>
      <Bone $w="100px" $h="20px" style={{ marginBottom: "20px" }} />
      {REVIEWS.map((_, i) => (
        <ReviewRow key={i}>
          <ReviewHeader>
            <Bone
              $w="36px"
              $h="36px"
              $radius="50%"
              style={{ flexShrink: 0 } as React.CSSProperties}
            />
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <Bone $w="80px" $h="14px" />
              <Bone $w="55px" $h="11px" />
            </div>
          </ReviewHeader>
          <Bone $w="90%" $h="13px" />
          <Bone $w="70%" $h="13px" />
        </ReviewRow>
      ))}
    </PageShell>
  );
}
