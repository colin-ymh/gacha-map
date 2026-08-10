"use client";

import styled from "styled-components";

// globals.css가 html/body에 overflow:hidden을 걸어 둔다(지도 화면용). 이 페이지는
// 내용이 뷰포트를 넘길 수 있으므로 main 자체를 스크롤 컨테이너로 만든다.
// 짧을 때는 가운데 정렬을 유지하되, 길어지면 위쪽이 잘리지 않도록
// justify-content:center 대신 첫/마지막 자식의 auto 마진으로 센터링한다.
export const Page = styled.main`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px 20px 56px;

  & > *:first-child {
    margin-top: auto;
  }

  & > *:last-child {
    margin-bottom: auto;
  }
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

// `/app?debug=1` 전용. 원인이 확정되면 DebugLinks와 함께 제거한다.
export const DebugBox = styled.section`
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

export const DebugTitle = styled.h2`
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
`;

export const DebugLine = styled.p`
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  word-break: break-all;
  color: ${({ theme }) => theme.colors.textGray};
`;

export const DebugLink = styled.a`
  display: block;
  padding: 12px 14px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.colors.gray100};
  color: ${({ theme }) => theme.colors.textDark};
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
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
