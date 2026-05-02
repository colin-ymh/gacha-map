'use client'

import styled from 'styled-components'

interface TagProps {
  label: string
  className?: string
}

const StyledTag = styled.span`
  display: inline-block;
  background: ${({ theme }) => theme.colors.primaryBg};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSize.xs};
  padding: 3px 8px;
  white-space: nowrap;
`

const Tag = ({ label, className }: TagProps) => (
  <StyledTag className={className}>#{label}</StyledTag>
)

export default Tag
