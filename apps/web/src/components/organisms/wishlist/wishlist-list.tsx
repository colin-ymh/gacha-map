"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchWishlistAsync,
  removeFromWishlistAsync,
} from "@/store/slices/wishlist.slice";
import WishlistListView from "./wishlist-list.view";

interface WishlistListProps {
  onBack?: () => void;
  onShopSelect?: (shopId: string) => void;
  onExplore?: () => void;
}

const WishlistList = ({
  onBack,
  onShopSelect,
  onExplore,
}: WishlistListProps) => {
  const router = useRouter();
  const t = useTranslations("wishlist");
  const dispatch = useAppDispatch();

  const {
    wishlistShops: shops,
    loading: isLoading,
    hasFetched,
  } = useAppSelector((s) => s.wishlist);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  useEffect(() => {
    if (isLoggedIn === true && !hasFetched && !isLoading) {
      dispatch(fetchWishlistAsync());
    }
  }, [isLoggedIn, hasFetched, isLoading, dispatch]);

  const [locallyRemovedIds, setLocallyRemovedIds] = useState<Set<string>>(
    new Set(),
  );

  const handleToggle = useCallback(
    (shopId: string) => {
      setLocallyRemovedIds((prev) => new Set([...prev, shopId]));
      dispatch(removeFromWishlistAsync(shopId));
    },
    [dispatch],
  );

  const handleShopSelect = useCallback(
    (id: string) => {
      if (onShopSelect) onShopSelect(id);
      else router.push(`/shop/${id}`);
    },
    [onShopSelect, router],
  );

  const handleBack = onBack ?? (() => router.push("/mypage"));
  const backLabel = onBack ? t("backToMap") : t("backToMypage");
  const handleExplore = onExplore ?? (() => router.push("/"));

  const loginReturnUrl =
    typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <WishlistListView
      shops={shops}
      locallyRemovedIds={locallyRemovedIds}
      isLoading={isLoading}
      isLoggedIn={isLoggedIn}
      isLoginPopupOpen={isLoggedIn === false}
      onBack={handleBack}
      backLabel={backLabel}
      onShopSelect={handleShopSelect}
      onWishlistToggle={handleToggle}
      onExplore={handleExplore}
      onLoginPopupClose={() => handleBack()}
      loginReturnUrl={loginReturnUrl}
    />
  );
};

export default WishlistList;
