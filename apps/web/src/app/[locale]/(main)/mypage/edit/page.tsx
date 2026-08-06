import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PageShell from "@/components/templates/common/page-shell";
import ProfileEditPanel from "@/components/organisms/mypage/profile-edit-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profileEdit");
  return { title: t("title") };
}

export default function ProfileEditPage() {
  return (
    <PageShell>
      <ProfileEditPanel />
    </PageShell>
  );
}
