'use client'

import styled from 'styled-components'

export const TagFilter = styled.p`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray500};
`

export const Results = styled.div`
  margin-top: 24px;
`
