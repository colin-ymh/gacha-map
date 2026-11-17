"use client";

import { useEffect, useRef, type RefObject } from "react";
import type {
  ShopApplicationCandidate,
  useShopApplicationCandidates,
} from "@gacha-map/shared/src/hooks/useShopApplicationCandidates";
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

const CandidatePanel = styled.div`
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ theme }) => theme.colors.gray100};
`;

const CandidateRow = styled.button`
  display: grid;
  gap: 3px;
  width: 100%;
  border: 0;
  background: none;
  padding: 8px 0;
  min-height: 44px;
  text-align: start;
  cursor: pointer;

  &:disabled {
    cursor: default;
  }
`;

const CandidateAction = styled.button`
  align-self: start;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: none;
  text-align: start;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;
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

const LocationWarn = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.warningText};
  background: ${({ theme }) => theme.colors.warningBg};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 10px 12px;
  margin: 0;
`;

const AddressRow = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const SearchButton = styled.button`
  padding: 8px 12px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  background-color: ${({ theme }) => theme.colors.white};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ClearButton = styled.button`
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.gray300};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray600};
  background-color: ${({ theme }) => theme.colors.white};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: ${({ theme }) => theme.colors.gray500};
  }
`;

const ResolvedAddress = styled.div`
  flex: 1;
  padding: 8px 10px;
  background-color: ${({ theme }) => theme.colors.gray100};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.gray900};
`;

const CoordHint = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
  margin-left: 6px;
`;

const GeocodingText = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.gray500};
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
  candidates: ReturnType<typeof useShopApplicationCandidates>;
  onNameCompositionChange: (composing: boolean) => void;
  onCandidateSelect: (shop: ShopApplicationCandidate) => void;
  onCandidateCancel?: () => void;
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
  onSearchAddress: () => void;
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
  candidates,
  onNameCompositionChange,
  onCandidateSelect,
  onCandidateCancel,
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
  onSearchAddress,
  onMessageChange,
  onConsentChange,
  onFilesSelected,
  onRemoveDocument,
  onSubmit,
}: ShopApplicationFormViewProps) => {
  const t = useTranslations("shopApplication");
  const claimCard = useRef<HTMLDivElement>(null);
  const hasSelectedCandidate = !!onCandidateCancel;
  useEffect(() => {
    if (hasSelectedCandidate) claimCard.current?.focus();
  }, [hasSelectedCandidate]);

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
            <ShopCard ref={claimCard} tabIndex={hasSelectedCandidate ? -1 : undefined}>
              <ShopCardName>{shopName}</ShopCardName>
              {shopAddress && <ShopCardAddress>{shopAddress}</ShopCardAddress>}
            </ShopCard>
            {onCandidateCancel && (
              <CandidateAction type="button" disabled={isSubmitting} onClick={onCandidateCancel}>
                {t("candidateCancel")}
              </CandidateAction>
            )}
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
                onCompositionStart={() => onNameCompositionChange(true)}
                onCompositionEnd={() => onNameCompositionChange(false)}
                placeholder={t("shopNamePlaceholder")}
                maxLength={100}
              />
              {candidates.loading && (
                <ShopCardAddress role="status">{t("candidateLoading")}</ShopCardAddress>
              )}
              {(candidates.items.length > 0 || candidates.failed) && (
                <CandidatePanel>
                  {candidates.failed ? (
                    <>
                      <ShopCardAddress role="status">{t("candidateError")}</ShopCardAddress>
                      <CandidateAction type="button" onClick={candidates.retry}>
                        {t("candidateRetry")}
                      </CandidateAction>
                    </>
                  ) : (
                    <>
                      <ShopCardName>{t("candidateHeading")}</ShopCardName>
                      {candidates.items.map((shop) => (
                        <CandidateRow
                          key={shop.id}
                          type="button"
                          disabled={!shop.claimable || isSubmitting}
                          onClick={() => onCandidateSelect(shop)}
                        >
                          <ShopCardName as="span">{shop.name}</ShopCardName>
                          {shop.address && <ShopCardAddress as="span">{shop.address}</ShopCardAddress>}
                          {!shop.claimable && (
                            <ShopCardAddress as="span">{t("candidateOwned")}</ShopCardAddress>
                          )}
                        </CandidateRow>
                      ))}
                    </>
                  )}
                  <CandidateAction type="button" onClick={candidates.dismiss}>
                    {t("candidateContinue")}
                  </CandidateAction>
                </CandidatePanel>
              )}
              {errors.shopName && (
                <ErrorMessage>{errors.shopName}</ErrorMessage>
              )}
            </Field>

            {/* 주소 + 위치 확인 (Daum Postcode)
                좌표 없이 승인되면 샵이 0,0에 생성되므로 여기서 반드시 확보한다.
                자유 텍스트 입력 대신 위젯으로 주소를 확정하고, 그 결과로 지오코딩을
                1번만 호출한다 — 별도 "위치 확인" 단계를 두지 않는다. */}
            <Field>
              <Label>
                {t("addressLabel")}
                <RequiredMark>{t("required")}</RequiredMark>
              </Label>
              {coords ? (
                <AddressRow>
                  <ResolvedAddress>
                    {coords.address ?? address}
                    <CoordHint>
                      ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
                    </CoordHint>
                  </ResolvedAddress>
                  <ClearButton type="button" onClick={onSearchAddress}>
                    {t("addressClear")}
                  </ClearButton>
                </AddressRow>
              ) : (
                <>
                  <AddressRow>
                    <SearchButton
                      type="button"
                      onClick={onSearchAddress}
                      disabled={geocodeState === "loading"}
                    >
                      {t("addressSearch")}
                    </SearchButton>
                  </AddressRow>
                  {geocodeState === "loading" && (
                    <GeocodingText>{t("locationSearching")}</GeocodingText>
                  )}
                  {geocodeState === "failed" && (
                    <LocationWarn>{t("locationFailed")}</LocationWarn>
                  )}
                </>
              )}
              {errors.address && <ErrorMessage>{errors.address}</ErrorMessage>}
              {errors.location && (
                <ErrorMessage>{errors.location}</ErrorMessage>
              )}
            </Field>
          </>
        )}

        {/* 소유권 신청으로 전환해도 첨부된 서류는 확인하고 제거할 수 있다. */}
        {(!isClaim || documentPreviews.length > 0) && (
          <Field>
            <Label>
              {t("documentsLabel")}
              {!isClaim && <RequiredMark>{t("required")}</RequiredMark>}
            </Label>
            {!isClaim && <DocumentsHint>{t("documentsHint")}</DocumentsHint>}

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

            {!isClaim && documentPreviews.length < 3 && (
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
