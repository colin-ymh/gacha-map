"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { formatKoreanPhone, containsProfanity } from "@gacha-map/shared";
import type { ReportType } from "@/types";
import { useAppSelector } from "@/store/hooks";
import ReportFormView from "./report-form.view";

interface ReportFormProps {
  shopId?: string;
  shopName?: string;
  onBack: () => void;
}

const ALL_TYPES: ReportType[] = ["new_shop", "fix_info", "closed", "other"];
const SHOP_TYPES: ReportType[] = ["fix_info", "closed", "other"];

const ReportForm = ({ shopId, shopName, onBack }: ReportFormProps) => {
  const t = useTranslations("report");
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn) === true;
  const nickname = useAppSelector((s) => s.auth.profile?.nickname) ?? null;

  const availableTypes = shopId ? SHOP_TYPES : ALL_TYPES;
  const [reportType, setReportType] = useState<ReportType>(
    shopId ? "fix_info" : "new_shop",
  );
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [contentError, setContentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const hint = shopId
    ? null
    : reportType === "new_shop"
      ? t("hintNewShop")
      : reportType === "fix_info" || reportType === "closed"
        ? t("hintShop")
        : null;

  const validate = useCallback((): boolean => {
    if (content.trim().length < 10) {
      setContentError(t("validationMinLength"));
      return false;
    }
    if (containsProfanity(content.trim())) {
      setContentError(t("profanity"));
      return false;
    }
    setContentError("");
    return true;
  }, [content, t]);

  const handleContentChange = useCallback((value: string) => {
    if (value.length <= 1000) setContent(value);
  }, []);

  const handleNameChange = useCallback((value: string) => {
    setName(value.slice(0, 50));
  }, []);

  const handleContactChange = useCallback((value: string) => {
    setContact(formatKoreanPhone(value).slice(0, 100));
  }, []);

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
            reporter_name: isLoggedIn
              ? (nickname ?? null)
              : name.trim() || null,
            reporter_contact: contact.trim() || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? t("error"));
        }

        setContent("");
        setName("");
        setContact("");
        setReportType(shopId ? "fix_info" : "new_shop");
        setSubmitSuccess(true);
      } catch {
        setSubmitError(t("error"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      reportType,
      content,
      shopId,
      name,
      contact,
      nickname,
      isLoggedIn,
      validate,
      t,
    ],
  );

  return (
    <ReportFormView
      reportType={reportType}
      availableTypes={availableTypes}
      shopName={shopName}
      content={content}
      name={name}
      contact={contact}
      contentError={contentError}
      isSubmitting={isSubmitting}
      submitSuccess={submitSuccess}
      submitError={submitError}
      hint={hint}
      isLoggedIn={isLoggedIn}
      onBack={onBack}
      onTypeChange={setReportType}
      onContentChange={handleContentChange}
      onNameChange={handleNameChange}
      onContactChange={handleContactChange}
      onSubmit={handleSubmit}
    />
  );
};

export default ReportForm;
