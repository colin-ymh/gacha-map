import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import ShopApplicationPageContent from "./shop-application-page-content";

interface Props {
  searchParams: Promise<{ shopId?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shopApplication");
  return { title: t("titleNew") };
}

export default async function ShopApplicationPage({ searchParams }: Props) {
  const { shopId } = await searchParams;
  return (
    <PageShell>
      <ShopApplicationPageContent shopId={shopId} />
    </PageShell>
  );
}
