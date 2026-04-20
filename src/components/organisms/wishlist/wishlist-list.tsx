"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ShopSummary } from "@/types";
import WishlistListView from "./wishlist-list.view";

interface WishlistListProps {
  onBack?: () => void;
  onShopSelect?: (shopId: string) => void;
}

const WishlistList = ({ onBack, onShopSelect }: WishlistListProps) => {
  const router = useRouter();
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsLoggedIn(false);
        setIsLoginPopupOpen(true);
        setIsLoading(false);
        return;
      }
      setIsLoggedIn(true);
      fetch("/api/wishlist")
        .then((res) => res.json())
        .then((data) => setShops(data.shops ?? []))
        .catch(() => setShops([]))
        .finally(() => setIsLoading(false));
    });
  }, []);

  const handleToggle = useCallback(async (shopId: string) => {
    setShops((prev) => prev.filter((s) => s.id !== shopId));
    await fetch(`/api/wishlist/${shopId}`, { method: "DELETE" });
  }, []);

  const handleShopSelect = useCallback(
    (id: string) => {
      if (onShopSelect) onShopSelect(id);
      else router.push(`/shop/${id}`);
    },
    [onShopSelect, router],
  );

  const loginReturnUrl =
    typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <WishlistListView
      shops={shops}
      isLoading={isLoading}
      isLoggedIn={isLoggedIn}
      isLoginPopupOpen={isLoginPopupOpen}
      onBack={onBack}
      onShopSelect={handleShopSelect}
      onWishlistToggle={handleToggle}
      onExplore={() => router.push("/")}
      onLoginPopupClose={() => (onBack ? onBack() : router.back())}
      loginReturnUrl={loginReturnUrl}
    />
  );
};

export default WishlistList;
