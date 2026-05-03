"use client";

import styled, { css } from "styled-components";
import { useTranslations } from "next-intl";
import Button from "@/components/atoms/common/button";
import Input from "@/components/atoms/common/input";
import { ArrowLeftIcon } from "@/components/atoms/icons";
import type { ReportType } from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

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

const ShopBanner = styled.div`
  padding: 10px 16px;
  background: ${({ theme }) => theme.colors.primaryBg};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const RequiredMark = styled.span`
  color: ${({ theme }) => theme.colors.dangerText};
  margin-left: 2px;
`;

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_TYPE_DEFS: { value: ReportType; labelKey: string }[] = [
  { value: "new_shop", labelKey: "typeNew" },
  { value: "fix_info", labelKey: "typeFix" },
  { value: "closed", labelKey: "typeClosed" },
  { value: "other", labelKey: "typeOther" },
];

// ── View ──────────────────────────────────────────────────────────────────────

interface ReportFormViewProps {
  reportType: ReportType;
  availableTypes: ReportType[];
  shopName?: string;
  content: string;
  name: string;
  contact: string;
  contentError: string;
  isSubmitting: boolean;
  submitSuccess: boolean;
  submitError: string;
  hint: string | null;
  isLoggedIn: boolean;
  onBack: () => void;
  onTypeChange: (type: ReportType) => void;
  onContentChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ReportFormView = ({
  reportType,
  availableTypes,
  shopName,
  content,
  name,
  contact,
  contentError,
  isSubmitting,
  submitSuccess,
  submitError,
  hint,
  isLoggedIn,
  onBack,
  onTypeChange,
  onContentChange,
  onContactChange,
  onNameChange,
  onSubmit,
}: ReportFormViewProps) => {
  const t = useTranslations("report");
  const visibleTypes = ALL_TYPE_DEFS.filter(({ value }) =>
    availableTypes.includes(value),
  );

  return (
    <Container>
      <TopBar>
        <BackButton onClick={onBack}>
          <ArrowLeftIcon size={18} />
        </BackButton>
        <TopBarTitle>{t("title")}</TopBarTitle>
      </TopBar>

      {shopName && <ShopBanner>{shopName}에 대한 제보입니다</ShopBanner>}

      <Form onSubmit={onSubmit} noValidate>
        <Field>
          <Label>{t("typeLabel")}</Label>
          <TypeGrid>
            {visibleTypes.map(({ value, labelKey }) => (
              <TypeButton
                key={value}
                type="button"
                $selected={reportType === value}
                onClick={() => onTypeChange(value)}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </TypeButton>
            ))}
          </TypeGrid>
        </Field>

        <Field>
          <Label>
            {t("contentLabel")}
            <RequiredMark>*</RequiredMark>
          </Label>
          <TextareaWrapper>
            <Textarea
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                onContentChange(e.target.value)
              }
              placeholder={hint ?? ""}
              aria-describedby={contentError ? "content-error" : undefined}
            />
            <CharCount>{t("charCount", { count: content.length })}</CharCount>
          </TextareaWrapper>
          {contentError && (
            <ErrorMessage id="content-error">{contentError}</ErrorMessage>
          )}
        </Field>

        {!isLoggedIn && (
          <Field>
            <Label>{t("nameLabel")}</Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="이름을 입력해 주세요"
            />
          </Field>
        )}

        <Field>
          <Label>{t("contactLabel")}</Label>
          <Input
            value={contact}
            onChange={(e) => onContactChange(e.target.value)}
            placeholder="이메일 또는 SNS ID"
          />
        </Field>
      </Form>

      <Footer>
        <Button
          type="submit"
          fullWidth
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {t("submit")}
        </Button>
        {submitSuccess && <SuccessMessage>{t("success")}</SuccessMessage>}
        {submitError && <SubmitErrorMessage>{submitError}</SubmitErrorMessage>}
      </Footer>
    </Container>
  );
};

export default ReportFormView;
