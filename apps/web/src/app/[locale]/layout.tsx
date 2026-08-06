import type { Metadata } from "next";
import localFont from "next/font/local";
import { getTranslations } from "next-intl/server";
import StyledComponentsRegistry from "@/lib/registry";
import AppThemeProvider from "@/lib/theme-provider";
import "../globals.css";

const pretendard = localFont({
  src: "../../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  return (
    <html lang={locale} className={pretendard.variable}>
      <body>
        <StyledComponentsRegistry>
          <AppThemeProvider>{children}</AppThemeProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
