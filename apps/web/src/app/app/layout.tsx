import localFont from "next/font/local";
import StyledComponentsRegistry from "@/lib/registry";
import AppThemeProvider from "@/lib/theme-provider";
import "../globals.css";

// /app은 next-intl locale prefix 밖의 단일 경로라 [locale]/layout.tsx를 타지
// 않는다. html/body 셸을 여기서 직접 구성한다.
const pretendard = localFont({
  src: "../../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

export default function AppLinkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <StyledComponentsRegistry>
          <AppThemeProvider>{children}</AppThemeProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
