"use client";

import styled, { css } from "styled-components";

type Variant = "primary" | "secondary" | "danger" | "success" | "info";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantStyles = {
  primary: css`
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primaryHover};
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.colors.white};
    color: ${({ theme }) => theme.colors.gray600};
    border: 1px solid ${({ theme }) => theme.colors.gray200};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.gray50};
    }
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.dangerBg};
    color: ${({ theme }) => theme.colors.dangerText};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerBgHover};
    }
  `,
  success: css`
    background: ${({ theme }) => theme.colors.successBg};
    color: ${({ theme }) => theme.colors.successText};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.successBgHover};
    }
  `,
  info: css`
    background: ${({ theme }) => theme.colors.infoBg};
    color: ${({ theme }) => theme.colors.infoText};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.infoBgHover};
    }
  `,
};

const StyledButton = styled.button<{
  $variant: Variant;
  $size: Size;
  $fullWidth: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    opacity 0.15s;
  white-space: nowrap;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  ${({ $size, theme }) =>
    $size === "sm" &&
    css`
      padding: 4px 10px;
      font-size: ${theme.fontSize.xs};
    `}

  ${({ $size }) =>
    $size === "md" &&
    css`
      padding: 10px 16px;
    `}

  ${({ $variant }) => variantStyles[$variant as Variant]}

  ${({ $fullWidth }) =>
    $fullWidth &&
    css`
      width: 100%;
    `}
`;

const Button = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  ...props
}: ButtonProps) => (
  <StyledButton
    $variant={variant}
    $size={size}
    $fullWidth={fullWidth}
    {...props}
  >
    {children}
  </StyledButton>
);

export default Button;
