'use client'

import styled from 'styled-components'
import Header from '@/components/organisms/common/header'

interface PageShellProps {
  children: React.ReactNode
}

const Page = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`

const Main = styled.main`
  max-width: ${({ theme }) => theme.layout.maxContentWidth};
  width: 100%;
  margin: 0 auto;
  padding: 24px 16px;
`

const PageShell = ({ children }: PageShellProps) => (
  <Page>
    <Header />
    <Main>{children}</Main>
  </Page>
)

export default PageShell
