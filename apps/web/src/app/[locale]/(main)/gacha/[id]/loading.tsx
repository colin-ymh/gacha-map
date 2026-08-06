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

const ImageArea = styled(Bone)`
  width: 100%;
  height: 260px;
  border-radius: 12px;
  margin-bottom: 20px;
`;

const ShopRow = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid ${SHIMMER_BASE};
`;

const ShopThumb = styled(Bone)`
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 8px;
`;

const ShopBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
`;

const SHOPS = Array.from({ length: 3 });

export default function GachaDetailLoading() {
  return (
    <PageShell>
      <ImageArea />
      <Bone $w="55%" $h="22px" style={{ marginBottom: "8px" }} />
      <Bone $w="30%" $h="15px" style={{ marginBottom: "6px" }} />
      <Bone $w="20%" $h="18px" style={{ marginBottom: "24px" }} />
      <Bone $w="40%" $h="16px" style={{ marginBottom: "12px" }} />
      {SHOPS.map((_, i) => (
        <ShopRow key={i}>
          <ShopThumb />
          <ShopBody>
            <Bone $w="55%" $h="15px" />
            <Bone $w="40%" $h="12px" />
          </ShopBody>
        </ShopRow>
      ))}
    </PageShell>
  );
}
