import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect(`/${locale}/admin/shops`);
  }

  if (profile?.role === "shop_owner") {
    redirect(`/${locale}/shop-owner`);
  }

  redirect(`/${locale}/shop-application`);
}
