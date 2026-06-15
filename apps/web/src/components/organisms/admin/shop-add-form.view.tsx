"use client";

import { useRef, useEffect } from "react";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import type { ShopStatus } from "@/types";

// ── Styled ────────────────────────────────────────────────────────────────────

const FormTitle = styled.h3`
  font-size: ${({ theme }) => theme.fontSize.base};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  margin-bottom: 16px;
`;

const PreFillNote = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 12px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSize.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textGray};
`;

const Input = styled.input`
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  background-color: ${({ theme }) => theme.colors.white};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const TextArea = styled.textarea`
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  background-color: ${({ theme }) => theme.colors.white};
  resize: vertical;
  min-height: 60px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Select = styled.select`
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  background-color: ${({ theme }) => theme.colors.white};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const AddressSearchWrapper = styled.div`
  position: relative;
`;

const AddressInputRow = styled.div`
  display: flex;
  gap: 6px;
`;

const AddressInput = styled(Input)`
  flex: 1;
`;

const ClearButton = styled.button`
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  background-color: ${({ theme }) => theme.colors.white};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: ${({ theme }) => theme.colors.textGray};
  }
`;

const SuggestionsDropdown = styled.ul`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 220px;
  overflow-y: auto;
`;

const SuggestionItem = styled.li`
  padding: 8px 12px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSize.sm};

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray100};
  }
`;

const SuggestionRoad = styled.div`
  color: ${({ theme }) => theme.colors.textDark};
  font-weight: 500;
`;

const SuggestionJibun = styled.div`
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.xs};
  margin-top: 2px;
`;

const ResolvedAddress = styled.div`
  padding: 8px 10px;
  background-color: ${({ theme }) => theme.colors.gray100};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
`;

const CoordHint = styled.span`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  margin-left: 6px;
`;

const SearchingText = styled.div`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.textGray};
  padding: 4px 0;
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 10px;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  margin-top: 8px;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SuccessMessage = styled.div`
  padding: 10px;
  background-color: ${({ theme }) => theme.colors.successBg};
  color: ${({ theme }) => theme.colors.successText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
  text-align: center;
`;

const ErrorMessage = styled.div`
  padding: 10px;
  background-color: ${({ theme }) => theme.colors.dangerBg};
  color: ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShopFormValues {
  name: string;
  address: string;
  lat: string;
  lng: string;
  description: string;
  phone: string;
  opening_hours: string;
  status: ShopStatus;
}

export interface GeocodeSuggestion {
  roadAddress: string;
  jibunAddress: string;
  lat: number;
  lng: number;
}

interface ShopAddFormViewProps {
  values: ShopFormValues;
  isFromReport: boolean;
  isSubmitting: boolean;
  success: boolean;
  error: string | null;
  onChange: (field: keyof ShopFormValues, value: string) => void;
  onSubmit: () => void;
  addressQuery: string;
  onAddressQueryChange: (q: string) => void;
  suggestions: GeocodeSuggestion[];
  isFetchingSuggestions: boolean;
  onSelectSuggestion: (s: GeocodeSuggestion) => void;
  onClearAddress: () => void;
}

// ── View ──────────────────────────────────────────────────────────────────────

const ShopAddFormView = ({
  values,
  isFromReport,
  isSubmitting,
  success,
  error,
  onChange,
  onSubmit,
  addressQuery,
  onAddressQueryChange,
  suggestions,
  isFetchingSuggestions,
  onSelectSuggestion,
  onClearAddress,
}: ShopAddFormViewProps) => {
  const t = useTranslations("admin.reports.shopForm");
  const dropdownRef = useRef<HTMLUListElement>(null);

  const hasResolvedCoords = values.lat !== "" && values.lng !== "";

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        // do nothing — suggestions will clear on blur via container
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (success) {
    return <SuccessMessage>{t("success")}</SuccessMessage>;
  }

  return (
    <>
      <FormTitle>{t("title")}</FormTitle>
      {isFromReport && <PreFillNote>{t("fromReport")}</PreFillNote>}

      <FieldGroup>
        <Field>
          <Label>{t("name")} *</Label>
          <Input
            value={values.name}
            placeholder={t("namePlaceholder")}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </Field>

        <Field>
          <Label>{t("address")} *</Label>
          <AddressSearchWrapper>
            {hasResolvedCoords ? (
              <AddressInputRow>
                <ResolvedAddress>
                  {values.address || `${values.lat}, ${values.lng}`}
                  <CoordHint>
                    ({parseFloat(values.lat).toFixed(5)},{" "}
                    {parseFloat(values.lng).toFixed(5)})
                  </CoordHint>
                </ResolvedAddress>
                <ClearButton type="button" onClick={onClearAddress}>
                  {t("addressClear")}
                </ClearButton>
              </AddressInputRow>
            ) : (
              <>
                <AddressInputRow>
                  <AddressInput
                    value={addressQuery}
                    placeholder={t("addressSearchPlaceholder")}
                    onChange={(e) => onAddressQueryChange(e.target.value)}
                    autoComplete="off"
                  />
                </AddressInputRow>
                {isFetchingSuggestions && (
                  <SearchingText>{t("addressSearching")}</SearchingText>
                )}
                {suggestions.length > 0 && (
                  <SuggestionsDropdown ref={dropdownRef}>
                    {suggestions.map((s, i) => (
                      <SuggestionItem
                        key={i}
                        onMouseDown={() => onSelectSuggestion(s)}
                      >
                        <SuggestionRoad>
                          {s.roadAddress || s.jibunAddress}
                        </SuggestionRoad>
                        {s.roadAddress && s.jibunAddress && (
                          <SuggestionJibun>{s.jibunAddress}</SuggestionJibun>
                        )}
                      </SuggestionItem>
                    ))}
                  </SuggestionsDropdown>
                )}
                {!isFetchingSuggestions &&
                  suggestions.length === 0 &&
                  addressQuery.trim().length >= 2 && (
                    <SearchingText>{t("addressNoResults")}</SearchingText>
                  )}
              </>
            )}
          </AddressSearchWrapper>
        </Field>

        <Field>
          <Label>{t("phone")}</Label>
          <Input
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </Field>

        <Field>
          <Label>{t("openingHours")}</Label>
          <Input
            value={values.opening_hours}
            onChange={(e) => onChange("opening_hours", e.target.value)}
          />
        </Field>

        <Field>
          <Label>{t("description")}</Label>
          <TextArea
            value={values.description}
            onChange={(e) => onChange("description", e.target.value)}
          />
        </Field>

        <Field>
          <Label>{t("status")}</Label>
          <Select
            value={values.status}
            onChange={(e) => onChange("status", e.target.value)}
          >
            <option value="active">{t("statusActive")}</option>
            <option value="hidden">{t("statusHidden")}</option>
          </Select>
        </Field>
      </FieldGroup>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <SubmitButton onClick={onSubmit} disabled={isSubmitting}>
        {t("submit")}
      </SubmitButton>
    </>
  );
};

export default ShopAddFormView;
