"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  formatKoreanPhone,
  parseBusinessHours,
  serializeBusinessHours,
  type BusinessHoursData,
} from "@gacha-map/shared";
import BusinessHoursEditor from "@/components/molecules/business-hours-editor";
import type { ShopOwnerShop } from "@/types";

// ── Styled Components ────────────────────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 640px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textDark};
  padding-bottom: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Notice = styled.p`
  font-size: ${({ theme }) => theme.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  background-color: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 24px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDark};
`;

const Input = styled.input`
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  background-color: ${({ theme }) => theme.colors.white};
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    background-color: ${({ theme }) => theme.colors.gray50};
    color: ${({ theme }) => theme.colors.textGray};
    cursor: not-allowed;
  }
`;

const Textarea = styled.textarea`
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.textDark};
  background-color: ${({ theme }) => theme.colors.white};
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

const PrimaryBtn = styled.button`
  padding: 10px 24px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.white};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SecondaryBtn = styled.button`
  padding: 10px 24px;
  background-color: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textDark};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray50};
  }
`;

const StatusText = styled.p<{ $isError?: boolean }>`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme, $isError }) =>
    $isError ? theme.colors.dangerText : theme.colors.successText};
`;

const LoadingText = styled.p`
  color: ${({ theme }) => theme.colors.textGray};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

// ── Component ────────────────────────────────────────────────────────────────

export default function ShopOwnerProfilePage() {
  const t = useTranslations("shopOwner.profile");
  const router = useRouter();
  const [shop, setShop] = useState<ShopOwnerShop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    msg: string;
    isError: boolean;
  } | null>(null);

  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHoursData | null>(
    null,
  );

  useEffect(() => {
    const fetchShop = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/shop-owner/shop", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const s: ShopOwnerShop = data.shop;
      setShop(s);
      setDescription(s.description ?? "");
      setPhone(s.phone ?? "");
      setBusinessHours(parseBusinessHours(s.opening_hours));
      setIsLoading(false);
    };

    fetchShop();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/");
      return;
    }

    try {
      const res = await fetch("/api/shop-owner/shop", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          description: description || null,
          phone: phone || null,
          opening_hours: businessHours
            ? serializeBusinessHours(businessHours)
            : null,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      setShop(data.shop);
      setStatusMsg({ msg: t("saveSuccess"), isError: false });
    } catch {
      setStatusMsg({ msg: t("saveError"), isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (shop) {
      setDescription(shop.description ?? "");
      setPhone(shop.phone ?? "");
      setBusinessHours(parseBusinessHours(shop.opening_hours));
      setStatusMsg(null);
    }
  };

  if (isLoading) return <LoadingText>{t("title")}</LoadingText>;

  return (
    <Container>
      <Title>{t("title")}</Title>
      <Notice>{t("notice")}</Notice>

      <Form onSubmit={handleSubmit}>
        <FieldGroup>
          <Label>{t("nameLabel")}</Label>
          <Input value={shop?.name ?? ""} disabled />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="description">{t("descriptionLabel")}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="phone">{t("phoneLabel")}</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(formatKoreanPhone(e.target.value))}
            placeholder={t("phonePlaceholder")}
          />
        </FieldGroup>

        <FieldGroup>
          <Label>{t("hoursLabel")}</Label>
          <BusinessHoursEditor
            value={businessHours}
            onChange={setBusinessHours}
          />
        </FieldGroup>

        {statusMsg && (
          <StatusText $isError={statusMsg.isError}>{statusMsg.msg}</StatusText>
        )}

        <Actions>
          <PrimaryBtn type="submit" disabled={isSaving}>
            {isSaving ? t("saving") : t("saveBtn")}
          </PrimaryBtn>
          <SecondaryBtn type="button" onClick={handleCancel}>
            {t("cancelBtn")}
          </SecondaryBtn>
        </Actions>
      </Form>
    </Container>
  );
}
