"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import Button from "@/components/atoms/common/button";
import Input from "@/components/atoms/common/input";
import { ArrowLeftIcon } from "@/components/atoms/icons";

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
  padding: 4px;
  display: flex;
  align-items: center;

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
  gap: 16px;
  padding: 16px;
  flex: 1;
`;

const SectionLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
`;

const ShopCard = styled.div`
  background: ${({ theme }) => theme.colors.primaryBg};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 10px 14px;
`;

const ShopCardName = styled.p`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.gray900};
  margin: 0 0 2px;
`;

const ShopCardAddress = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
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

const RequiredMark = styled.span`
  color: ${({ theme }) => theme.colors.dangerText};
  margin-left: 2px;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  border: 1px solid ${({ theme }) => theme.colors.gray300};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 8px 12px;
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

const InfoBox = styled.div`
  background: ${({ theme }) => theme.colors.warningBg};
  border: 1px solid ${({ theme }) => theme.colors.warningBorder};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 10px 14px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray600};
  white-space: pre-line;
`;

const ErrorMessage = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.dangerText};
  margin: 0;
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

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShopApplicationFormViewProps {
  isClaim: boolean;
  shopName?: string;
  shopAddress?: string;
  bizReg: string;
  repName: string;
  phone: string;
  shopNameInput: string;
  address: string;
  message: string;
  errors: Record<string, string>;
  isSubmitting: boolean;
  submitSuccess: boolean;
  submitError: string;
  onBack: () => void;
  onBizRegChange: (v: string) => void;
  onRepNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onShopNameChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

// ── View ──────────────────────────────────────────────────────────────────────

const ShopApplicationFormView = ({
  isClaim,
  shopName,
  shopAddress,
  bizReg,
  repName,
  phone,
  shopNameInput,
  address,
  message,
  errors,
  isSubmitting,
  submitSuccess,
  submitError,
  onBack,
  onBizRegChange,
  onRepNameChange,
  onPhoneChange,
  onShopNameChange,
  onAddressChange,
  onMessageChange,
  onSubmit,
}: ShopApplicationFormViewProps) => {
  const t = useTranslations("shopApplication");

  return (
    <Container>
      <TopBar>
        <BackButton onClick={onBack}>
          <ArrowLeftIcon size={18} />
        </BackButton>
        <TopBarTitle>{isClaim ? t("titleClaim") : t("titleNew")}</TopBarTitle>
      </TopBar>

      <Form onSubmit={onSubmit} noValidate>
        {isClaim && shopName && (
          <Field>
            <Label>{t("targetShopLabel")}</Label>
            <ShopCard>
              <ShopCardName>{shopName}</ShopCardName>
              {shopAddress && <ShopCardAddress>{shopAddress}</ShopCardAddress>}
            </ShopCard>
          </Field>
        )}

        <SectionLabel>{t("sectionLabel")}</SectionLabel>

        <Field>
          <Label>
            {t("bizRegLabel")}
            <RequiredMark>{t("required")}</RequiredMark>
          </Label>
          <Input
            value={bizReg}
            onChange={(e) => onBizRegChange(e.target.value)}
            placeholder={t("bizRegPlaceholder")}
          />
          {errors.bizReg && <ErrorMessage>{errors.bizReg}</ErrorMessage>}
        </Field>

        <Field>
          <Label>
            {t("repNameLabel")}
            <RequiredMark>{t("required")}</RequiredMark>
          </Label>
          <Input
            value={repName}
            onChange={(e) => onRepNameChange(e.target.value)}
            placeholder={t("repNamePlaceholder")}
          />
          {errors.repName && <ErrorMessage>{errors.repName}</ErrorMessage>}
        </Field>

        <Field>
          <Label>
            {t("phoneLabel")}
            <RequiredMark>{t("required")}</RequiredMark>
          </Label>
          <Input
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder={t("phonePlaceholder")}
          />
          {errors.phone && <ErrorMessage>{errors.phone}</ErrorMessage>}
        </Field>

        {!isClaim && (
          <>
            <Field>
              <Label>
                {t("shopNameLabel")}
                <RequiredMark>{t("required")}</RequiredMark>
              </Label>
              <Input
                value={shopNameInput}
                onChange={(e) => onShopNameChange(e.target.value)}
                placeholder={t("shopNamePlaceholder")}
              />
              {errors.shopName && (
                <ErrorMessage>{errors.shopName}</ErrorMessage>
              )}
            </Field>

            <Field>
              <Label>
                {t("addressLabel")}
                <RequiredMark>{t("required")}</RequiredMark>
              </Label>
              <Input
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                placeholder={t("addressPlaceholder")}
              />
              {errors.address && <ErrorMessage>{errors.address}</ErrorMessage>}
            </Field>
          </>
        )}

        <Field>
          <Label>{t("messageLabel")}</Label>
          <Textarea
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onMessageChange(e.target.value)
            }
            placeholder={t("messagePlaceholder")}
          />
        </Field>

        {isClaim && <InfoBox>{t("infoText")}</InfoBox>}
      </Form>

      <Footer>
        <Button
          type="submit"
          fullWidth
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {isClaim ? t("submitClaim") : t("submitNew")}
        </Button>
        {submitSuccess && <SuccessMessage>{t("success")}</SuccessMessage>}
        {submitError && <SubmitErrorMessage>{submitError}</SubmitErrorMessage>}
      </Footer>
    </Container>
  );
};

export default ShopApplicationFormView;
