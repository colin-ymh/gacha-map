import 'styled-components'
import * as colors from './color'

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
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  layout: {
    maxContentWidth: '640px',
    headerHeight: '60px',
    sidebarWidth: '359px',
    adminSidebarWidth: '224px',
  },
} as const

export type AppTheme = typeof theme

declare module 'styled-components' {
  export interface DefaultTheme extends AppTheme {}
}
