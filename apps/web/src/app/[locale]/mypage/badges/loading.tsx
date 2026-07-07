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

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 20px;
`;

const BadgeItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const BADGES = Array.from({ length: 9 });

export default function BadgesLoading() {
  return (
    <PageShell>
      <Bone $w="100px" $h="22px" style={{ marginBottom: "8px" }} />
      <Bone $w="60%" $h="14px" style={{ marginBottom: "20px" }} />
      <Grid>
        {BADGES.map((_, i) => (
          <BadgeItem key={i}>
            <Bone $w="64px" $h="64px" $radius="50%" />
            <Bone $w="55px" $h="12px" />
          </BadgeItem>
        ))}
      </Grid>
    </PageShell>
  );
}
