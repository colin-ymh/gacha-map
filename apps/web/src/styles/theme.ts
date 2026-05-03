import "styled-components";
import * as colors from "./color";

export const theme = {
  colors: {
    primary: colors.PRIMARY,
    primaryHover: colors.PRIMARY_HOVER,
    primaryBg: colors.PRIMARY_BG,
    tagBg: colors.PRIMARY_BG,
    textDark: colors.TEXT_DARK,
    textGray: colors.TEXT_GRAY,
    border: colors.BORDER,
    thumbnailPlaceholder: colors.THUMBNAIL_PLACEHOLDER,

    white: colors.WHITE,
    gray50: colors.GRAY_50,
    gray100: colors.GRAY_100,
    gray200: colors.GRAY_200,
    gray300: colors.GRAY_300,
    gray400: colors.GRAY_400,
    gray500: colors.GRAY_500,
    gray600: colors.GRAY_600,
    gray700: colors.GRAY_700,
    gray800: colors.GRAY_800,
    gray900: colors.GRAY_900,

    successBg: colors.SUCCESS_BG,
    successBgHover: colors.SUCCESS_BG_HOVER,
    successText: colors.SUCCESS_TEXT,

    dangerBg: colors.DANGER_BG,
    dangerBgHover: colors.DANGER_BG_HOVER,
    dangerText: colors.DANGER_TEXT,

    warningText: colors.WARNING_TEXT,

    infoBg: colors.INFO_BG,
    infoBgHover: colors.INFO_BG_HOVER,
    infoText: colors.INFO_TEXT,

    black: colors.BLACK,
    lightGray: colors.LIGHT_GRAY,
    nearBlack: colors.NEAR_BLACK,
    darkSurface: colors.DARK_SURFACE,

    oauthKakaoBg: "#FEE500",
    oauthKakaoText: "#3C1E1E",
    oauthNaverBg: "#03C75A",
    oauthNaverText: "#ffffff",
    oauthGoogleBg: "#ffffff",
    oauthGoogleText: "#3c4043",
    oauthGoogleBorder: "#dadce0",
  },
  fontSize: {
    xs: "0.75rem", // 12px — micro/tag
    sm: "0.875rem", // 14px — caption
    base: "1.0625rem", // 17px — body/button
    lg: "1.125rem", // 18px
    xl: "1.3125rem", // 21px — card title
    "2xl": "1.75rem", // 28px — tile heading
    "3xl": "2.5rem", // 40px — section heading
    "4xl": "3.5rem", // 56px — display hero
  },
  lineHeight: {
    tight: "1.07",
    snug: "1.14",
    normal: "1.47",
    relaxed: "2.41",
  },
  letterSpacing: {
    tighter: "-0.374px",
    tight: "-0.224px",
    micro: "-0.12px",
    normal: "normal",
  },
  borderRadius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    comfortable: "11px",
    full: "9999px",
  },
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    card: "rgba(0, 0, 0, 0.22) 3px 5px 30px 0px",
  },
  layout: {
    maxContentWidth: "640px",
    headerHeight: "60px",
    sidebarWidth: "359px",
    adminSidebarWidth: "224px",
  },
} as const;

export type AppTheme = typeof theme;

declare module "styled-components" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
