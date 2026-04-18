import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import PrivacyPanel from "@/components/organisms/common/privacy-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

export default function PrivacyPage() {
  return (
    <PageShell>
      <PrivacyPanel />
    </PageShell>
  );
}
