"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import LoginPopup from "@/components/organisms/auth/login-popup";
import ShopApplicationForm from "@/components/organisms/shop-application/shop-application-form";
import type { Shop } from "@/types";

interface Props {
  shopId?: string;
}

export default function ShopApplicationPageContent({ shopId }: Props) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
  const [shop, setShop] = useState<Pick<Shop, "name" | "address"> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsLoggedIn(false);
        setIsLoginPopupOpen(true);
        return;
      }
      setIsLoggedIn(true);

      if (shopId) {
        fetch(`/api/shops/${shopId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.shop) setShop(data.shop);
          })
          .catch(() => null);
      }
    });
  }, [shopId]);

  const handleBack = () => router.back();

  if (isLoginPopupOpen && !isLoggedIn) {
    const returnUrl =
      typeof window !== "undefined"
        ? window.location.href
        : "/shop-application";
    return <LoginPopup onClose={() => router.back()} returnUrl={returnUrl} />;
  }

  if (isLoggedIn === null) return null;

  return (
    <ShopApplicationForm
      shopId={shopId}
      shopName={shop?.name}
      shopAddress={shop?.address ?? undefined}
      onBack={handleBack}
    />
  );
}
