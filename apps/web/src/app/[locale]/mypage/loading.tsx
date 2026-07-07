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

const ProfileArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0 24px;
  gap: 10px;
`;

const MenuRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid ${SHIMMER_BASE};
`;

const MENUS = Array.from({ length: 5 });

export default function MypageLoading() {
  return (
    <PageShell>
      <ProfileArea>
        <Bone $w="80px" $h="80px" $radius="50%" />
        <Bone $w="100px" $h="18px" />
        <Bone $w="140px" $h="14px" />
      </ProfileArea>
      {MENUS.map((_, i) => (
        <MenuRow key={i}>
          <Bone $w="120px" $h="16px" />
          <Bone $w="16px" $h="16px" $radius="2px" />
        </MenuRow>
      ))}
    </PageShell>
  );
}
