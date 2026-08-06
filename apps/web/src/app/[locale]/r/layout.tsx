import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

interface Props {
  children: React.ReactNode;
}

// 공유 랜딩은 클라이언트 컴포넌트(store-links.tsx)가 useTranslations를 쓰지 않고
// 텍스트를 서버에서 props로 받는다. 사이트 전체 messages(25KB+)를 실어 보낼 이유가
// 없어서 share 네임스페이스만 잘라 전달한다.
export default async function ShareLayout({ children }: Props) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={{ share: messages.share }}>
      {children}
    </NextIntlClientProvider>
  );
}
