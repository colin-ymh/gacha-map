"use client";

import styled from "styled-components";
import LoginForm from "./login-form";

// ── Styled ────────────────────────────────────────────────────────────────────

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${({ $isOpen }) => ($isOpen ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  position: relative;
  background: ${({ theme }) => theme.colors.white};
  border-radius: 12px;
  max-width: 360px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (max-width: 480px) {
    width: 100%;
    max-width: none;
    border-radius: 0;
    max-height: 100vh;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.gray500};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${({ theme }) => theme.colors.gray700};
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  return (
    <Overlay
      $isOpen={isOpen}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <ModalContainer>
        <CloseButton onClick={onClose}>×</CloseButton>
        <LoginForm />
      </ModalContainer>
    </Overlay>
  );
}
