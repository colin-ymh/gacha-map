import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import { getTranslations, getMessages } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'
import StyledComponentsRegistry from '@/lib/registry'
import AppThemeProvider from '@/lib/theme-provider'
import { ReduxProvider } from '@/providers/redux-provider'
import AuthInitializer from '@/components/auth-initializer'
import '../globals.css'

const pretendard = localFont({
  src: '../../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
  weight: '45 920',
})

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })

  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale} className={pretendard.variable}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <StyledComponentsRegistry>
            <AppThemeProvider>
              <ReduxProvider>
                <AuthInitializer />
                {children}
              </ReduxProvider>
            </AppThemeProvider>
          </StyledComponentsRegistry>
        </NextIntlClientProvider>
        <Script
          src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
