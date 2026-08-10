"use client";

import styled from "styled-components";

export const Page = styled.main`
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px 20px 56px;
  background: linear-gradient(
    180deg,
    ${({ theme }) => theme.colors.white} 0%,
    ${({ theme }) => theme.colors.primaryBg} 100%
  );
`;

export const AppIcon = styled.img`
  width: 96px;
  height: 96px;
  border-radius: 22px;
  box-shadow: ${({ theme }) => theme.shadow.md};
`;

export const Title = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  text-align: center;
  color: ${({ theme }) => theme.colors.textDark};
`;

export const Caption = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
`;

export const CtaGroup = styled.div`
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

export const StoreButton = styled.a`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 20px;
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryHover};
  }
`;

export const SecondaryButton = styled.a`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 20px;
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textDark};
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
`;
