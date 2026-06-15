"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminReportItem, ShopStatus } from "@/types";
import ShopAddFormView, { type ShopFormValues } from "./shop-add-form.view";

interface ShopAddFormProps {
  report: AdminReportItem | null;
  onSuccess: () => void;
}

function buildInitialValues(report: AdminReportItem | null): ShopFormValues {
  return {
    name: report?.proposed_shop_name ?? "",
    address: report?.proposed_address ?? "",
    lat: report?.proposed_lat != null ? String(report.proposed_lat) : "",
    lng: report?.proposed_lng != null ? String(report.proposed_lng) : "",
    description: "",
    phone: "",
    opening_hours: "",
    status: "active",
  };
}

export default function ShopAddForm({ report, onSuccess }: ShopAddFormProps) {
  const [values, setValues] = useState<ShopFormValues>(() =>
    buildInitialValues(report),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFromReport =
    report !== null &&
    (report.proposed_shop_name !== null ||
      report.proposed_lat !== null ||
      report.proposed_lng !== null);

  const handleChange = (field: keyof ShopFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setError("샵 이름은 필수입니다");
      return;
    }
    const lat = parseFloat(values.lat);
    const lng = parseFloat(values.lng);
    if (isNaN(lat) || isNaN(lng)) {
      setError("위도/경도를 올바르게 입력하세요");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/admin/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          name: values.name.trim(),
          address: values.address.trim() || null,
          lat,
          lng,
          description: values.description.trim() || null,
          phone: values.phone.trim() || null,
          opening_hours: values.opening_hours.trim() || null,
          status: values.status as ShopStatus,
          source_report_id: report?.id ?? null,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? `API error: ${response.status}`);
      }

      setSuccess(true);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ShopAddFormView
      values={values}
      isFromReport={isFromReport}
      isSubmitting={isSubmitting}
      success={success}
      error={error}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  );
}
