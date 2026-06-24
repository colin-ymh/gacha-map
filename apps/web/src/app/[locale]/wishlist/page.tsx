import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import WishlistPageClient from "./wishlist-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wishlist");
  return { title: t("title") };
}

export default function WishlistPage() {
  return (
    <PageShell>
      <WishlistPageClient />
    </PageShell>
  );
}
