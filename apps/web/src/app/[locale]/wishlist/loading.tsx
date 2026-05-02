"use client";

import styled, { keyframes } from "styled-components";
import PageShell from "@/components/templates/common/page-shell";

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

const Bone = styled.div<{ $w?: string; $h?: string; $radius?: string }>`
  width: ${({ $w }) => $w ?? "100%"};
  height: ${({ $h }) => $h ?? "16px"};
  border-radius: ${({ $radius }) => $radius ?? "6px"};
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 800px 100%;
  animation: ${shimmer} 1.4s infinite linear;
`;

const TitleBone = styled(Bone)`
  height: 24px;
  width: 120px;
  margin-bottom: 20px;
`;

const CardRow = styled.div`
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const CardThumb = styled(Bone)`
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

const CardBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
`;

const CARDS = Array.from({ length: 5 });

export default function WishlistLoading() {
  return (
    <PageShell>
      <TitleBone />
      {CARDS.map((_, i) => (
        <CardRow key={i}>
          <CardThumb />
          <CardBody>
            <Bone $w="55%" $h="16px" />
            <Bone $w="35%" $h="13px" />
            <Bone $w="70%" $h="12px" />
          </CardBody>
        </CardRow>
      ))}
    </PageShell>
  );
}
