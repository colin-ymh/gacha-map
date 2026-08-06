import Script from "next/script";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { ReduxProvider } from "@/providers/redux-provider";
import AuthInitializer from "@/components/auth-initializer";

// next/script ScriptProps does not expose `src` in strict React 19 types
const NaverScript = Script as React.ComponentType<{
  src: string;
  strategy: string;
}>;

interface Props {
  children: React.ReactNode;
}

export default async function MainLayout({ children }: Props) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ReduxProvider>
        <AuthInitializer />
        {children}
      </ReduxProvider>
      <NaverScript
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}`}
        strategy="afterInteractive"
      />
    </NextIntlClientProvider>
  );
}
