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

const AvatarWrapper = styled.div`
  display: flex;
  justify-content: center;
  padding: 24px 0 32px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
`;

const FIELDS = Array.from({ length: 4 });

export default function ProfileEditLoading() {
  return (
    <PageShell>
      <AvatarWrapper>
        <Bone $w="80px" $h="80px" $radius="50%" />
      </AvatarWrapper>
      {FIELDS.map((_, i) => (
        <FieldGroup key={i}>
          <Bone $w="30%" $h="13px" />
          <Bone $h="44px" $radius="8px" />
        </FieldGroup>
      ))}
      <Bone $h="48px" $radius="8px" style={{ marginTop: "8px" }} />
    </PageShell>
  );
}
