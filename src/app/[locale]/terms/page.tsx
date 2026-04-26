import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import TermsPanel from "@/components/organisms/common/terms-panel";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [
    { locale: "ko" },
    { locale: "en" },
    { locale: "ja" },
    { locale: "zh" },
  ];
}

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return { title: t("title") };
}

export default function TermsPage() {
  return (
    <PageShell>
      <TermsPanel />
    </PageShell>
  );
}
