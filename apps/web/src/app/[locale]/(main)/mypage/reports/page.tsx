import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import ReportsList from "@/components/organisms/mypage/reports-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myReports");
  return { title: t("title") };
}

export default function MyReportsPage() {
  return (
    <PageShell>
      <ReportsList />
    </PageShell>
  );
}
