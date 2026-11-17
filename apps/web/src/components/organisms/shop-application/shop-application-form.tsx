"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  formatBizReg,
  formatKoreanPhone,
  validateBizReg,
} from "@gacha-map/shared";
import {
  useShopApplicationCandidates,
  type ShopApplicationCandidate,
} from "@gacha-map/shared/src/hooks/useShopApplicationCandidates";
import ShopApplicationFormView from "./shop-application-form.view";

declare global {
  interface Window {
    // Daum Postcode SDK. 공식 타입 패키지가 없어 admin/shop-add-form.tsx와
    // 동일하게 any로 둔다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    daum: any;
  }
}

interface ShopApplicationFormProps {
  shopId?: string;
  shopName?: string;
  shopAddress?: string;
  onBack: () => void;
}

type Coords = { lat: number; lng: number; address: string | null };

async function lookupShops(query: string, signal: AbortSignal) {
  const res = await fetch(
    `/api/shop-applications/shop-candidates?q=${encodeURIComponent(query)}`,
    { signal },
  );
  if (!res.ok) throw new Error("Shop lookup failed");
  const data: { candidates: ShopApplicationCandidate[] } = await res.json();
  return data.candidates;
}

/**
 * 서버가 내려주는 error code -> i18n 키.
 * 서버(apps/web/src/app/api/shop-applications/route.ts)의 fail() code와 1:1이다.
 * 모르는 code는 generic 문구로 폴백한다.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  biz_reg_invalid_length: "errorBizRegLength",
  biz_reg_invalid_checksum: "errorBizRegChecksum",
  consent_required: "errorConsentRequired",
  geocode_failed: "errorGeocodeFailed",
  shop_already_owned: "errorShopAlreadyOwned",
  shop_not_active: "errorShopNotActive",
  shop_not_found: "errorShopNotFound",
  document_required: "errorDocumentRequired",
  document_too_large: "errorDocumentTooLarge",
  document_invalid_type: "errorDocumentInvalidType",
  too_many_documents: "errorTooManyDocuments",
  document_upload_failed: "errorDocumentUploadFailed",
  profanity: "errorProfanity",
};

/** business-docs 버킷과 동일한 상한 (apps/web/src/app/api/shop-applications/route.ts). */
const MAX_DOCUMENTS = 3;
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const ShopApplicationForm = ({
  shopId,
  shopName,
  shopAddress,
  onBack,
}: ShopApplicationFormProps) => {
  const t = useTranslations("shopApplication");
  const [selectedShop, setSelectedShop] =
    useState<ShopApplicationCandidate | null>(null);
  const candidateShop = shopId ? null : selectedShop;
  const targetShopId = shopId || candidateShop?.id;
  const isClaim = !!targetShopId;
  const [composingName, setComposingName] = useState(false);

  const [bizReg, setBizReg] = useState("");
  const [repName, setRepName] = useState("");
  const [phone, setPhone] = useState("");
  const [shopNameInput, setShopNameInput] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const candidates = useShopApplicationCandidates(
    shopNameInput,
    !isClaim && !composingName && !submitSuccess,
    lookupShops,
  );

  const [coords, setCoords] = useState<Coords | null>(null);
  const geocodeRequest = useRef<AbortController | null>(null);
  const [geocodeState, setGeocodeState] = useState<
    "idle" | "loading" | "failed"
  >("idle");

  const [documents, setDocuments] = useState<File[]>([]);
  const [documentPreviews, setDocumentPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // cleanup 이펙트가 []뿐이면 마운트 시점의 documentPreviews(빈 배열)를 클로저로
  // 캡처해서, 언마운트 시 아무것도 revoke하지 못하고 object URL이 샌다.
  // ref는 렌더 중에 쓰지 않고(react-hooks/refs) 별도 이펙트에서만 갱신한다.
  const documentPreviewsRef = useRef<string[]>([]);
  useEffect(() => {
    documentPreviewsRef.current = documentPreviews;
  }, [documentPreviews]);

  // 미리보기 URL은 이 컴포넌트가 만들었으니 이 컴포넌트가 정리한다.
  useEffect(() => {
    return () => {
      documentPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Daum Postcode(우편번호 서비스) 스크립트 로드. admin/shop-add-form.tsx와 동일한
  // 패턴이다. 자유 텍스트 입력 + 라이브 지오코딩 대신 이 위젯으로 정확한
  // 도로명주소를 고르게 한다 — Kakao Local 주소검색 API 단독으로는 건물명 매칭·
  // 지번/도로명 폴백이 Daum Postcode만큼 정교하지 않고, 사업자가 매일 보는
  // "그 팝업"이 아니라 신뢰도도 떨어진다. 타이핑 중 매 pause마다 지오코딩을
  // 호출하던 이전 방식(불완전한 주소로도 API를 쏘던 낭비)도 이걸로 없어진다:
  // 주소는 위젯이 확정해서 주고, 지오코딩은 그 결과로 딱 1번만 호출한다.
  useEffect(() => {
    if (shopId) return;
    const script = document.createElement("script");
    script.src =
      "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
    return () => {
      geocodeRequest.current?.abort();
      document.head.removeChild(script);
    };
  }, [shopId]);

  const handleSearchAddress = useCallback(() => {
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: async (data: {
        roadAddress: string;
        jibunAddress: string;
      }) => {
        const addr = data.roadAddress || data.jibunAddress;
        if (!addr) return;

        geocodeRequest.current?.abort();
        const controller = new AbortController();
        geocodeRequest.current = controller;
        setAddress(addr);
        setCoords(null);
        setErrors((prev) => ({ ...prev, address: "", location: "" }));

        setGeocodeState("loading");
        try {
          const res = await fetch(
            `/api/geocode/forward?query=${encodeURIComponent(addr)}`,
            { signal: controller.signal },
          );
          if (!res.ok) throw new Error("Geocoding failed");
          const json = (await res.json()) as {
            results?: Array<{
              lat: number;
              lng: number;
              roadAddress?: string;
              jibunAddress?: string;
            }>;
          };
          if (controller.signal.aborted) return;
          const first = json.results?.[0];
          if (first) {
            setCoords({
              lat: first.lat,
              lng: first.lng,
              address: first.roadAddress ?? first.jibunAddress ?? null,
            });
            setGeocodeState("idle");
          } else {
            setCoords(null);
            setGeocodeState("failed");
          }
        } catch {
          if (controller.signal.aborted) return;
          setCoords(null);
          setGeocodeState("failed");
        }
      },
    }).open();
  }, []);

  const handleFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const next: string[] = [];
      const accepted: File[] = [];
      let error: string | null = null;

      for (const file of Array.from(files)) {
        if (accepted.length + documents.length >= MAX_DOCUMENTS) break;
        if (file.size > MAX_DOC_BYTES) {
          error = t("errorDocumentTooLarge");
          continue;
        }
        if (!ALLOWED_DOC_TYPES.includes(file.type)) {
          error = t("errorDocumentInvalidType");
          continue;
        }
        accepted.push(file);
        next.push(URL.createObjectURL(file));
      }

      if (accepted.length > 0) {
        setDocuments((prev) => [...prev, ...accepted].slice(0, MAX_DOCUMENTS));
        setDocumentPreviews((prev) =>
          [...prev, ...next].slice(0, MAX_DOCUMENTS),
        );
        setErrors((prev) => ({ ...prev, documents: "" }));
      }
      if (error) {
        setErrors((prev) => ({ ...prev, documents: error! }));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [documents.length, t],
  );

  const removeDocument = useCallback((index: number) => {
    setDocumentPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};

    if (!bizReg.trim()) {
      next.bizReg = t("validationBizReg");
    } else if (validateBizReg(bizReg)) {
      next.bizReg = t("validationBizRegInvalid");
    }

    if (!repName.trim()) next.repName = t("validationRepName");
    if (!phone.trim()) next.phone = t("validationPhone");

    if (!isClaim) {
      if (!shopNameInput.trim()) next.shopName = t("validationShopName");
      if (!address.trim()) next.address = t("validationAddress");
      if (!coords) next.location = t("validationLocation");
      if (documents.length === 0) next.documents = t("validationDocuments");
    }

    if (!consent) next.consent = t("validationConsent");

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [
    bizReg,
    repName,
    phone,
    shopNameInput,
    address,
    isClaim,
    coords,
    documents.length,
    consent,
    t,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError("");
      setSubmitSuccess(false);

      try {
        const payload: Record<string, unknown> = {
          type: isClaim ? "claim_shop" : "new_shop",
          shop_id: targetShopId ?? null,
          business_registration_number: bizReg.trim(),
          representative_name: repName.trim(),
          phone_number: phone.trim(),
          shop_name: isClaim ? null : shopNameInput.trim(),
          address: isClaim ? null : address.trim(),
          message: message.trim() || null,
          consent_privacy: true,
        };
        if (!isClaim) {
          payload.lat = coords?.lat;
          payload.lng = coords?.lng;
        }

        let res: Response;
        if (documents.length > 0) {
          const form = new FormData();
          form.append("payload", JSON.stringify(payload));
          documents.forEach((file) => form.append("documents", file));
          res = await fetch("/api/shop-applications?version=2", {
            method: "POST",
            body: form,
          });
        } else {
          res = await fetch("/api/shop-applications?version=2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            code?: string;
          } | null;
          const key = body?.code ? ERROR_CODE_KEYS[body.code] : undefined;
          setSubmitError(key ? t(key) : t("error"));
          return;
        }

        setSubmitSuccess(true);
      } catch {
        setSubmitError(t("error"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      validate,
      isClaim,
      targetShopId,
      bizReg,
      repName,
      phone,
      shopNameInput,
      address,
      message,
      coords,
      documents,
      t,
    ],
  );

  return (
    <ShopApplicationFormView
      isClaim={isClaim}
      shopName={candidateShop?.name ?? shopName}
      shopAddress={candidateShop ? candidateShop.address ?? undefined : shopAddress}
      candidates={candidates}
      onNameCompositionChange={setComposingName}
      onCandidateSelect={(shop) => {
        if (!isSubmitting && shop.claimable) {
          setSelectedShop(shop);
          setErrors({});
          setSubmitError("");
        }
      }}
      onCandidateCancel={candidateShop ? () => {
        setSelectedShop(null);
        setErrors({});
        setSubmitError("");
      } : undefined}
      bizReg={bizReg}
      repName={repName}
      phone={phone}
      shopNameInput={shopNameInput}
      address={address}
      message={message}
      consent={consent}
      coords={coords}
      geocodeState={geocodeState}
      documentPreviews={documentPreviews}
      fileInputRef={fileInputRef}
      errors={errors}
      isSubmitting={isSubmitting}
      submitSuccess={submitSuccess}
      submitError={submitError}
      onBack={onBack}
      onBizRegChange={(v) => setBizReg(formatBizReg(v))}
      onRepNameChange={setRepName}
      onPhoneChange={(v) => setPhone(formatKoreanPhone(v))}
      onShopNameChange={setShopNameInput}
      onSearchAddress={handleSearchAddress}
      onMessageChange={setMessage}
      onConsentChange={setConsent}
      onFilesSelected={handleFilesSelected}
      onRemoveDocument={removeDocument}
      onSubmit={handleSubmit}
    />
  );
};

export default ShopApplicationForm;
