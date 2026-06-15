"use client";

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

const LatLngRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
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

interface ShopAddFormViewProps {
  values: ShopFormValues;
  isFromReport: boolean;
  isSubmitting: boolean;
  success: boolean;
  error: string | null;
  onChange: (field: keyof ShopFormValues, value: string) => void;
  onSubmit: () => void;
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
}: ShopAddFormViewProps) => {
  const t = useTranslations("admin.reports.shopForm");

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
          <Label>{t("address")}</Label>
          <Input
            value={values.address}
            placeholder={t("addressPlaceholder")}
            onChange={(e) => onChange("address", e.target.value)}
          />
        </Field>

        <LatLngRow>
          <Field>
            <Label>{t("lat")} *</Label>
            <Input
              type="number"
              step="any"
              value={values.lat}
              placeholder={t("latPlaceholder")}
              onChange={(e) => onChange("lat", e.target.value)}
            />
          </Field>
          <Field>
            <Label>{t("lng")} *</Label>
            <Input
              type="number"
              step="any"
              value={values.lng}
              placeholder={t("lngPlaceholder")}
              onChange={(e) => onChange("lng", e.target.value)}
            />
          </Field>
        </LatLngRow>

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
