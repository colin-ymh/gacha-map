import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import ShopApplicationsList from "@/components/organisms/mypage/shop-applications-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myShopApplications");
  return { title: t("title") };
}

export default function ShopApplicationsPage() {
  return (
    <PageShell>
      <ShopApplicationsList />
    </PageShell>
  );
}
