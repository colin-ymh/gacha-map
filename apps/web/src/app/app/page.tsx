import type { Metadata } from "next";
import DebugLinks from "./debug-links";
import SmartLink from "./smart-link";
import { Page, AppIcon, Title } from "./styles";

// 인스타 바이오 링크 전용 경로. 검색 노출 대상이 아니다.
export const metadata: Metadata = {
  title: "가챠맵 앱 설치",
  description: "가챠맵 앱을 설치하고 내 주변 가챠샵을 찾아보세요.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ debug?: string }>;
}

export default async function AppLinkPage({ searchParams }: Props) {
  const { debug } = await searchParams;

  return (
    <Page>
      <AppIcon src="/gacha-map-icon.png" alt="가챠맵" />
      <Title>가챠맵 설치하기</Title>
      <SmartLink />
      {debug ? <DebugLinks /> : null}
    </Page>
  );
}
