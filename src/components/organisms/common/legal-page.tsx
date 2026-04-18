"use client";

import { useRouter } from "@/i18n/navigation";
import styled from "styled-components";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding-bottom: 32px;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.gray100};
  position: relative;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    opacity: 0.75;
  }
`;

const Title = styled.h1`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin: 0;
  white-space: nowrap;
`;

const Content = styled.div`
  padding: 24px 16px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  line-height: 1.8;

  h2 {
    font-size: ${({ theme }) => theme.fontSize.base};
    font-weight: 700;
    margin: 24px 0 8px;

    &:first-child {
      margin-top: 0;
    }
  }

  p {
    margin: 0 0 12px;
    color: ${({ theme }) => theme.colors.gray500};
  }
`;

interface LegalPageProps {
  title: string;
  backLabel: string;
  children: React.ReactNode;
}

const LegalPage = ({ title, backLabel, children }: LegalPageProps) => {
  const router = useRouter();

  return (
    <Wrapper>
      <TopBar>
        <BackButton onClick={() => router.back()}>← {backLabel}</BackButton>
        <Title>{title}</Title>
      </TopBar>
      <Content>{children}</Content>
    </Wrapper>
  );
};

export default LegalPage;
