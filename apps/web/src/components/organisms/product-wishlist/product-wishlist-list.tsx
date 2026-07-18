"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchProductWishlistAsync,
  toggleProductWishlistAsync,
} from "@/store/slices/product-wishlist.slice";
import ProductWishlistListView from "./product-wishlist-list.view";

interface Props {
  onProductSelect?: (productId: string) => void;
  onExplore?: () => void;
}

export default function ProductWishlistList({
  onProductSelect,
  onExplore,
}: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { wishlistedProducts, loading, hasFetched, pendingToggleCount } =
    useAppSelector((s) => s.productWishlist);
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  useEffect(() => {
    if (isLoggedIn === true && !hasFetched && !loading) {
      dispatch(fetchProductWishlistAsync());
    }
  }, [isLoggedIn, hasFetched, loading, dispatch]);

  const handleProductSelect = useCallback(
    (productId: string) => {
      if (onProductSelect) onProductSelect(productId);
      else router.push(`/gacha/${productId}`);
    },
    [onProductSelect, router],
  );

  const handleWishToggle = useCallback(
    (product: (typeof wishlistedProducts)[number]) => {
      dispatch(toggleProductWishlistAsync({ productId: product.id, product }));
    },
    [dispatch],
  );

  const handleExplore = onExplore ?? (() => router.push("/search?type=gacha"));

  return (
    <ProductWishlistListView
      products={wishlistedProducts}
      isLoading={loading}
      pendingToggleCount={pendingToggleCount}
      onProductSelect={handleProductSelect}
      onWishToggle={handleWishToggle}
      onExplore={handleExplore}
    />
  );
}
