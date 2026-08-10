"use client";

import styled, { keyframes } from "styled-components";

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

// 인스타 웹뷰용 안내. 인앱 브라우저의 ··· 버튼은 웹 콘텐츠 바깥(상단 바)에
// 있으므로, 뷰포트 우상단에 고정한 화살표로 그 위치를 가리킨다.
const nudge = keyframes`
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(4px, -6px); }
`;

export const ArrowHint = styled.div`
  position: fixed;
  top: 8px;
  right: 16px;
  z-index: 1;
  color: ${({ theme }) => theme.colors.primary};
  animation: ${nudge} 1.2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// 감지된 플랫폼 카드 한 장만 그린다. 반대 플랫폼은 아래 전환 링크로 열 수 있어
// 숨기더라도 접근이 막히지는 않는다.
export const PlatformCard = styled.section`
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  border-radius: 20px;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.md};
`;

export const PlatformLabel = styled.h2`
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: ${({ theme }) => theme.colors.textGray};
`;

export const NoticeTitle = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  color: ${({ theme }) => theme.colors.textGray};
`;

export const NoticeStrong = styled.strong`
  display: block;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
  color: ${({ theme }) => theme.colors.textDark};
`;

export const TextButton = styled.button`
  min-height: 40px;
  padding: 0 16px;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 600;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.textGray};
`;

