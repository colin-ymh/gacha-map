"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminReportItem, ShopStatus } from "@/types";
import ShopAddFormView, {
  type ShopFormValues,
  type GeocodeSuggestion,
} from "./shop-add-form.view";

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

  const [addressQuery, setAddressQuery] = useState(
    report?.proposed_address ?? "",
  );
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFromReport =
    report !== null &&
    (report.proposed_shop_name !== null ||
      report.proposed_lat !== null ||
      report.proposed_lng !== null);

  // When query changes, fetch suggestions (unless coords already resolved)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const hasResolvedCoords = values.lat !== "" && values.lng !== "";
    if (hasResolvedCoords || addressQuery.trim().length < 2) {
      const t = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(t);
    }

    debounceRef.current = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      try {
        const res = await fetch(
          `/api/geocode/forward?query=${encodeURIComponent(addressQuery.trim())}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { results: GeocodeSuggestion[] };
          setSuggestions(data.results ?? []);
        }
      } catch {
        // ignore
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addressQuery, values.lat, values.lng]);

  const handleChange = (field: keyof ShopFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressQueryChange = (q: string) => {
    setAddressQuery(q);
    // Clear resolved coords when user edits the query
    if (values.lat !== "" || values.lng !== "") {
      setValues((prev) => ({ ...prev, address: "", lat: "", lng: "" }));
    }
  };

  const handleSelectSuggestion = (s: GeocodeSuggestion) => {
    const addr = s.roadAddress || s.jibunAddress;
    setValues((prev) => ({
      ...prev,
      address: addr,
      lat: String(s.lat),
      lng: String(s.lng),
    }));
    setAddressQuery(addr);
    setSuggestions([]);
  };

  const handleClearAddress = () => {
    setValues((prev) => ({ ...prev, address: "", lat: "", lng: "" }));
    setAddressQuery("");
    setSuggestions([]);
  };

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setError("샵 이름은 필수입니다");
      return;
    }
    const lat = parseFloat(values.lat);
    const lng = parseFloat(values.lng);
    if (isNaN(lat) || isNaN(lng)) {
      setError("주소를 검색하고 선택해 주세요");
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
      addressQuery={addressQuery}
      onAddressQueryChange={handleAddressQueryChange}
      suggestions={suggestions}
      isFetchingSuggestions={isFetchingSuggestions}
      onSelectSuggestion={handleSelectSuggestion}
      onClearAddress={handleClearAddress}
    />
  );
}
