"use client";

import styled, { keyframes } from "styled-components";
import {
  SHIMMER_BASE,
  SHIMMER_HIGHLIGHT,
  WHITE,
  LOADING_DIVIDER,
} from "@/styles/color";

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

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${WHITE};
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid ${LOADING_DIVIDER};
  flex-shrink: 0;
`;

const ImageArea = styled(Bone)`
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0;
  flex-shrink: 0;
`;

const Content = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export default function ShopDetailLoading() {
  return (
    <Container>
      <TopBar>
        <Bone $w="32px" $h="32px" $radius="50%" />
        <Bone $w="140px" $h="18px" />
      </TopBar>
      <ImageArea />
      <Content>
        <Bone $w="55%" $h="22px" />
        <Bone $w="30%" $h="16px" />
        <Bone $h="1px" $radius="0" />
        <Bone $w="80%" $h="14px" />
        <Bone $w="60%" $h="14px" />
        <Bone $w="70%" $h="14px" />
        <Bone $w="40%" $h="14px" />
      </Content>
    </Container>
  );
}
