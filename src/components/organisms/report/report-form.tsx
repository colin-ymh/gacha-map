"use client";

import { useState, useCallback } from "react";
import styled, { css } from "styled-components";
import { useTranslations } from "next-intl";
import Button from "@/components/atoms/common/button";
import Input from "@/components/atoms/common/input";
import LoginPopup from "@/components/organisms/auth/login-popup";
import type { ReportType } from "@/types";

interface ReportFormProps {
  shopId?: string;
  onBack: () => void;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.gray600};
  font-size: ${({ theme }) => theme.fontSize.sm};
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: ${({ theme }) => theme.colors.gray900};
  }
`;

const TopBarTitle = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray800};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
  flex: 1;
`;

// ── Form sections ─────────────────────────────────────────────────────────────

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.gray700};
`;

const ErrorMessage = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.dangerText};
  margin: 0;
`;

// ── 2×2 type grid ─────────────────────────────────────────────────────────────

const TypeGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const TypeButton = styled.button<{ $selected: boolean }>`
  padding: 10px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;

  ${({ $selected, theme }) =>
    $selected
      ? css`
          background: ${theme.colors.primary};
          color: ${theme.colors.white};
          border: 1px solid ${theme.colors.primary};
        `
      : css`
          background: ${theme.colors.white};
          color: ${theme.colors.gray700};
          border: 1px solid ${theme.colors.gray300};

          &:hover {
            border-color: ${theme.colors.primary};
            color: ${theme.colors.primary};
          }
        `}
`;

// ── Textarea ──────────────────────────────────────────────────────────────────

const TextareaWrapper = styled.div`
  position: relative;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 120px;
  border: 1px solid ${({ theme }) => theme.colors.gray300};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 8px 12px;
  padding-bottom: 24px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray900};
  background: ${({ theme }) => theme.colors.white};
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.colors.gray400};
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primaryBg};
  }
`;

const CharCount = styled.span`
  position: absolute;
  bottom: 6px;
  right: 10px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray400};
  pointer-events: none;
`;

// ── Footer ────────────────────────────────────────────────────────────────────

const Footer = styled.div`
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
`;

const SuccessMessage = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.successText};
  text-align: center;
  margin: 0;
`;

const SubmitErrorMessage = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.dangerText};
  text-align: center;
  margin: 0;
`;

// ── Hint per type ─────────────────────────────────────────────────────────────

const TYPE_HINTS: Record<ReportType, string | null> = {
  new_shop: "샵 이름, 주소, 특징을 포함해 주세요",
  fix_info: "샵 이름을 포함해 주세요",
  closed: "샵 이름을 포함해 주세요",
  other: null,
};

const TYPES: { value: ReportType; labelKey: string }[] = [
  { value: "new_shop", labelKey: "typeNew" },
  { value: "fix_info", labelKey: "typeFix" },
  { value: "closed", labelKey: "typeClosed" },
  { value: "other", labelKey: "typeOther" },
];

// ── Component ─────────────────────────────────────────────────────────────────

const ReportForm = ({ shopId, onBack }: ReportFormProps) => {
  const t = useTranslations("report");

  const [reportType, setReportType] = useState<ReportType>("new_shop");
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  const [contentError, setContentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  const hint = shopId ? null : TYPE_HINTS[reportType];

  const validate = useCallback((): boolean => {
    if (content.trim().length < 10) {
      setContentError(t("validationMinLength"));
      return false;
    }
    setContentError("");
    return true;
  }, [content, t]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError("");
      setSubmitSuccess(false);

      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_type: reportType,
            content: content.trim(),
            shop_id: shopId ?? null,
            reporter_name: name.trim() || null,
            reporter_contact: contact.trim() || null,
          }),
        });

        if (res.status === 401) {
          setShowLoginPopup(true);
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? t("error"));
        }

        // Reset form
        setContent("");
        setName("");
        setContact("");
        setReportType("new_shop");
        setSubmitSuccess(true);
      } catch {
        setSubmitError(t("error"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [reportType, content, shopId, name, contact, validate, t],
  );

  return (
    <Container>
      <TopBar>
        <BackButton onClick={onBack}>←</BackButton>
        <TopBarTitle>{t("title")}</TopBarTitle>
      </TopBar>

      <Form onSubmit={handleSubmit} noValidate>
        {/* 제보 유형 */}
        <Field>
          <Label>{t("typeLabel")}</Label>
          <TypeGrid>
            {TYPES.map(({ value, labelKey }) => (
              <TypeButton
                key={value}
                type="button"
                $selected={reportType === value}
                onClick={() => setReportType(value)}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </TypeButton>
            ))}
          </TypeGrid>
        </Field>

        {/* 제보 내용 */}
        <Field>
          <Label>{t("contentLabel")}</Label>
          <TextareaWrapper>
            <Textarea
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= 1000) setContent(e.target.value);
              }}
              placeholder={hint ?? ""}
              aria-describedby={contentError ? "content-error" : undefined}
            />
            <CharCount>{t("charCount", { count: content.length })}</CharCount>
          </TextareaWrapper>
          {contentError && (
            <ErrorMessage id="content-error">{contentError}</ErrorMessage>
          )}
        </Field>

        {/* 제보자 이름 */}
        <Field>
          <Label>{t("nameLabel")}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 50))}
            placeholder="이름을 입력해 주세요"
          />
        </Field>

        {/* 연락처 */}
        <Field>
          <Label>{t("contactLabel")}</Label>
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value.slice(0, 100))}
            placeholder="이메일 또는 SNS ID"
          />
        </Field>
      </Form>

      <Footer>
        <Button
          type="submit"
          fullWidth
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {t("submit")}
        </Button>
        {submitSuccess && <SuccessMessage>{t("success")}</SuccessMessage>}
        {submitError && <SubmitErrorMessage>{submitError}</SubmitErrorMessage>}
      </Footer>

      {showLoginPopup && (
        <LoginPopup
          onClose={() => setShowLoginPopup(false)}
          returnUrl={
            typeof window !== "undefined" ? window.location.pathname : "/report"
          }
        />
      )}
    </Container>
  );
};

export default ReportForm;
