'use client'

import { ThemeProvider } from 'styled-components'
import { theme } from '@/styles/theme'

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}
