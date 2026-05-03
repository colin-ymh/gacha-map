import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import LoginForm from "@/components/organisms/auth/login-form";

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
  const t = await getTranslations({ locale, namespace: "login" });
  return { title: t("title") };
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
