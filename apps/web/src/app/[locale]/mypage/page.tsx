import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import MypagePanel from "@/components/organisms/mypage/mypage-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mypage");
  return { title: t("title") };
}

export default function MypagePage() {
  return (
    <PageShell>
      <MypagePanel />
    </PageShell>
  );
}
