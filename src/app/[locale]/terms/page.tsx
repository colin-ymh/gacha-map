import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import TermsPanel from "@/components/organisms/common/terms-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: t("title") };
}

export default function TermsPage() {
  return (
    <PageShell>
      <TermsPanel />
    </PageShell>
  );
}
