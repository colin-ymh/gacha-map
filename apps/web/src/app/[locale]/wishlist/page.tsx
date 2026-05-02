import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import WishlistList from "@/components/organisms/wishlist/wishlist-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wishlist");
  return { title: t("title") };
}

export default function WishlistPage() {
  return (
    <PageShell>
      <WishlistList />
    </PageShell>
  );
}
