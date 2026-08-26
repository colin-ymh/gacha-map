"use client";

import type { RefObject } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import Button from "@/components/atoms/common/button";
import Input from "@/components/atoms/common/input";
import {
  ArrowLeftIcon,
  CameraIcon,
  CloseIcon,
  CheckIcon,
} from "@/components/atoms/icons";

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

const LocationOk = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  background: ${({ theme }) => theme.colors.primaryBg};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 10px 12px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray900};
`;

const LocationHint = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
`;

const LocationWarn = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.warningText};
  background: ${({ theme }) => theme.colors.warningBg};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 10px 12px;
  margin: 0;
`;

const DocumentsHint = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 0;
  white-space: pre-line;
`;

const DocumentsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const DocumentThumbWrap = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
`;

const DocumentThumb = styled.img`
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.gray200};
  display: block;
`;

const DocumentRemoveButton = styled.button`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: ${({ theme }) => theme.colors.gray900};
  color: ${({ theme }) => theme.colors.white};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
`;

const AttachButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 6px 12px;
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.gray50};
  border: 1px solid ${({ theme }) => theme.colors.gray200};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.gray100};
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const ConsentRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const CheckboxBox = styled.span<{ $checked: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid
    ${({ theme, $checked }) =>
      $checked ? theme.colors.primary : theme.colors.gray300};
  background: ${({ theme, $checked }) =>
    $checked ? theme.colors.primary : theme.colors.white};
  color: ${({ theme }) => theme.colors.white};
  flex-shrink: 0;
`;

const HiddenCheckboxInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`;

const ConsentLabelText = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.gray800};
`;

const ConsentDetail = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin: 4px 0 0;
  white-space: pre-line;
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
  consent: boolean;
  coords: { lat: number; lng: number; address: string | null } | null;
  geocodeState: "idle" | "loading" | "failed";
  documentPreviews: string[];
  fileInputRef: RefObject<HTMLInputElement | null>;
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
  onConsentChange: (v: boolean) => void;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveDocument: (index: number) => void;
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
  consent,
  coords,
  geocodeState,
  documentPreviews,
  fileInputRef,
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
  onConsentChange,
  onFilesSelected,
  onRemoveDocument,
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
            inputMode="numeric"
            maxLength={12}
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

            {/* 위치 확인
                좌표 없이 승인되면 샵이 0,0에 생성되므로 여기서 반드시 확보한다. */}
            <Field>
              <Label>
                {t("locationLabel")}
                <RequiredMark>{t("required")}</RequiredMark>
              </Label>
              {geocodeState === "loading" ? (
                <LocationHint>{t("locationSearching")}</LocationHint>
              ) : coords ? (
                <LocationOk>
                  {coords.address ??
                    `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
                </LocationOk>
              ) : (
                <LocationWarn>
                  {address.trim() ? t("locationFailed") : t("locationEmpty")}
                </LocationWarn>
              )}
              {errors.location && (
                <ErrorMessage>{errors.location}</ErrorMessage>
              )}
            </Field>

            {/* 증빙 서류 (사업자등록증)
                new_shop은 필수. 비공개 버킷에 저장되고 관리자만 서명 URL로 열람한다. */}
            <Field>
              <Label>
                {t("documentsLabel")}
                <RequiredMark>{t("required")}</RequiredMark>
              </Label>
              <DocumentsHint>{t("documentsHint")}</DocumentsHint>

              {documentPreviews.length > 0 && (
                <DocumentsRow>
                  {documentPreviews.map((url, i) => (
                    <DocumentThumbWrap key={url}>
                      <DocumentThumb src={url} alt="" />
                      <DocumentRemoveButton
                        type="button"
                        onClick={() => onRemoveDocument(i)}
                        aria-label={t("documentsRemove")}
                      >
                        <CloseIcon size={12} />
                      </DocumentRemoveButton>
                    </DocumentThumbWrap>
                  ))}
                </DocumentsRow>
              )}

              {documentPreviews.length < 3 && (
                <AttachButton
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CameraIcon size={14} />
                  {t("documentsPick")}
                </AttachButton>
              )}
              <HiddenFileInput
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                onChange={(e) => onFilesSelected(e.target.files)}
              />
              {errors.documents && (
                <ErrorMessage>{errors.documents}</ErrorMessage>
              )}
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

        {/* 개인정보 수집·이용 동의 (필수)
            대표자명·전화번호·사업자등록번호를 수집하므로 동의 없이는 제출할 수 없다. */}
        <Field>
          <ConsentRow>
            <HiddenCheckboxInput
              type="checkbox"
              checked={consent}
              onChange={(e) => onConsentChange(e.target.checked)}
            />
            <CheckboxBox $checked={consent}>
              {consent && <CheckIcon size={12} />}
            </CheckboxBox>
            <ConsentLabelText>
              {t("consentLabel")}
              <RequiredMark>{t("required")}</RequiredMark>
            </ConsentLabelText>
          </ConsentRow>
          <ConsentDetail>{t("consentDetail")}</ConsentDetail>
          {errors.consent && <ErrorMessage>{errors.consent}</ErrorMessage>}
        </Field>
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
