"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatKoreanPhone, containsProfanity } from "@gacha-map/shared";
import type { ReportType } from "@/types";
import { useAppSelector } from "@/store/hooks";
import ReportFormView from "./report-form.view";
import type { LocationPickerResult } from "./report-location-picker";

export interface SelectedShop {
  id: string;
  name: string;
  address: string | null;
}

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
  const [proposedShopName, setProposedShopName] = useState("");
  const [proposedLocation, setProposedLocation] =
    useState<LocationPickerResult | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedShop, setSelectedShop] = useState<SelectedShop | null>(null);
  const [shopQuery, setShopQuery] = useState("");
  const [shopResults, setShopResults] = useState<SelectedShop[]>([]);
  const [shopSearchLoading, setShopSearchLoading] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [shopNameError, setShopNameError] = useState("");
  const [contentError, setContentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isNewShop = reportType === "new_shop";

  const needsShopSearch =
    !shopId && (reportType === "fix_info" || reportType === "closed");

  const hint = needsShopSearch && !selectedShop ? t("hintShop") : null;

  useEffect(() => {
    if (!needsShopSearch || !shopQuery.trim()) {
      const t = setTimeout(() => setShopResults([]), 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(async () => {
      setShopSearchLoading(true);
      try {
        const res = await fetch(
          `/api/shops?q=${encodeURIComponent(shopQuery.trim())}&limit=10`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            shops?: { id: string; name: string; address: string | null }[];
          };
          setShopResults(data.shops ?? []);
        }
      } catch {
        // ignore
      } finally {
        setShopSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [shopQuery, needsShopSearch]);

  const validate = useCallback((): boolean => {
    if (isNewShop) {
      if (!proposedShopName.trim()) {
        setShopNameError(t("shopNameRequired"));
        return false;
      }
      setShopNameError("");
      if (content.trim().length > 0 && containsProfanity(content.trim())) {
        setContentError(t("profanity"));
        return false;
      }
      setContentError("");
      return true;
    }
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
  }, [isNewShop, proposedShopName, content, t]);

  const handleContentChange = useCallback((value: string) => {
    if (value.length <= 1000) setContent(value);
  }, []);

  const handleNameChange = useCallback((value: string) => {
    setName(value.slice(0, 50));
  }, []);

  const handleContactChange = useCallback((value: string) => {
    setContact(formatKoreanPhone(value).slice(0, 100));
  }, []);

  const handleShopQueryChange = useCallback(
    (value: string) => {
      setShopQuery(value);
      if (selectedShop) setSelectedShop(null);
    },
    [selectedShop],
  );

  const handleShopSelect = useCallback((shop: SelectedShop) => {
    setSelectedShop(shop);
    setShopQuery(shop.name);
    setShopResults([]);
  }, []);

  const handleShopClear = useCallback(() => {
    setSelectedShop(null);
    setShopQuery("");
    setShopResults([]);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError("");
      setSubmitSuccess(false);

      try {
        const body: Record<string, unknown> = {
          report_type: reportType,
          content: content.trim(),
          shop_id: shopId ?? selectedShop?.id ?? null,
          reporter_name: isLoggedIn ? (nickname ?? null) : name.trim() || null,
          reporter_contact: contact.trim() || null,
        };
        if (isNewShop) {
          body.proposed_shop_name = proposedShopName.trim();
          if (proposedLocation) {
            body.proposed_address = proposedLocation.address;
            body.proposed_lat = proposedLocation.lat;
            body.proposed_lng = proposedLocation.lng;
          }
        }
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? t("error"));
        }

        setContent("");
        setProposedShopName("");
        setProposedLocation(null);
        setSelectedShop(null);
        setShopQuery("");
        setShopResults([]);
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
      isNewShop,
      proposedShopName,
      proposedLocation,
      content,
      shopId,
      selectedShop,
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
      proposedShopName={proposedShopName}
      proposedLocation={proposedLocation}
      showLocationPicker={showLocationPicker}
      name={name}
      contact={contact}
      shopNameError={shopNameError}
      contentError={contentError}
      isSubmitting={isSubmitting}
      submitSuccess={submitSuccess}
      submitError={submitError}
      hint={hint}
      isLoggedIn={isLoggedIn}
      onBack={onBack}
      onTypeChange={setReportType}
      onContentChange={handleContentChange}
      onProposedShopNameChange={setProposedShopName}
      onLocationSelect={(result) => {
        setProposedLocation(result);
        setShowLocationPicker(false);
      }}
      onOpenLocationPicker={() => setShowLocationPicker(true)}
      onCloseLocationPicker={() => setShowLocationPicker(false)}
      needsShopSearch={needsShopSearch}
      selectedShop={selectedShop}
      shopQuery={shopQuery}
      shopResults={shopResults}
      shopSearchLoading={shopSearchLoading}
      onShopQueryChange={handleShopQueryChange}
      onShopSelect={handleShopSelect}
      onShopClear={handleShopClear}
      onNameChange={handleNameChange}
      onContactChange={handleContactChange}
      onSubmit={handleSubmit}
    />
  );
};

export default ReportForm;
