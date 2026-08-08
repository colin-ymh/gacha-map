import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { ReduxProvider } from "@/providers/redux-provider";
import AuthInitializer from "@/components/auth-initializer";

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
    </NextIntlClientProvider>
  );
}
