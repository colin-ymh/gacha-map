"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { formatKoreanPhone } from "@gacha-map/shared";
import ShopApplicationFormView from "./shop-application-form.view";

interface ShopApplicationFormProps {
  shopId?: string;
  shopName?: string;
  shopAddress?: string;
  onBack: () => void;
}

const ShopApplicationForm = ({
  shopId,
  shopName,
  shopAddress,
  onBack,
}: ShopApplicationFormProps) => {
  const t = useTranslations("shopApplication");
  const isClaim = !!shopId;

  const [bizReg, setBizReg] = useState("");
  const [repName, setRepName] = useState("");
  const [phone, setPhone] = useState("");
  const [shopNameInput, setShopNameInput] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};

    if (!bizReg.trim()) next.bizReg = t("validationBizReg");
    if (!repName.trim()) next.repName = t("validationRepName");
    if (!phone.trim()) next.phone = t("validationPhone");

    if (!isClaim) {
      if (!shopNameInput.trim()) next.shopName = t("validationShopName");
      if (!address.trim()) next.address = t("validationAddress");
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [bizReg, repName, phone, shopNameInput, address, isClaim, t]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError("");
      setSubmitSuccess(false);

      try {
        const res = await fetch("/api/shop-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: isClaim ? "claim_shop" : "new_shop",
            shop_id: shopId ?? null,
            business_registration_number: bizReg.trim(),
            representative_name: repName.trim(),
            phone_number: phone.trim(),
            shop_name: isClaim ? null : shopNameInput.trim(),
            address: isClaim ? null : address.trim(),
            message: message.trim() || null,
          }),
        });

        if (res.status === 409) {
          setSubmitError(t("errorDuplicate"));
          return;
        }

        if (!res.ok) {
          throw new Error();
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
      shopId,
      bizReg,
      repName,
      phone,
      shopNameInput,
      address,
      message,
      t,
    ],
  );

  return (
    <ShopApplicationFormView
      isClaim={isClaim}
      shopName={shopName}
      shopAddress={shopAddress}
      bizReg={bizReg}
      repName={repName}
      phone={phone}
      shopNameInput={shopNameInput}
      address={address}
      message={message}
      errors={errors}
      isSubmitting={isSubmitting}
      submitSuccess={submitSuccess}
      submitError={submitError}
      onBack={onBack}
      onBizRegChange={setBizReg}
      onRepNameChange={setRepName}
      onPhoneChange={(v) => setPhone(formatKoreanPhone(v))}
      onShopNameChange={setShopNameInput}
      onAddressChange={setAddress}
      onMessageChange={setMessage}
      onSubmit={handleSubmit}
    />
  );
};

export default ShopApplicationForm;
