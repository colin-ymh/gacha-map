"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchProductWishlistAsync,
  toggleProductWishlistAsync,
  selectProductWishlistedSet,
} from "@/store/slices/product-wishlist.slice";
import { PRIMARY, TEXT_GRAY } from "@/styles/color";

interface Props {
  productId: string;
  productName: string;
}

const Button = styled.button<{ $wished: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.15s;
  color: ${({ $wished }) => ($wished ? PRIMARY : TEXT_GRAY)};
  font-size: 22px;
  line-height: 1;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

export default function GachaWishButton({ productId, productName }: Props) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const hasFetched = useAppSelector((s) => s.productWishlist.hasFetched);
  const pendingToggleCount = useAppSelector(
    (s) => s.productWishlist.pendingToggleCount,
  );
  const wishSet = useAppSelector(selectProductWishlistedSet);
  const isWished = wishSet.has(productId);

  useEffect(() => {
    if (isLoggedIn === true && !hasFetched) {
      dispatch(fetchProductWishlistAsync());
    }
  }, [isLoggedIn, hasFetched, dispatch]);

  function handleClick() {
    if (isLoggedIn === false) {
      router.push("/login");
      return;
    }
    if (pendingToggleCount > 0) return;
    dispatch(
      toggleProductWishlistAsync({
        productId,
      }),
    );
  }

  return (
    <Button
      $wished={isWished}
      onClick={handleClick}
      disabled={pendingToggleCount > 0}
      aria-label={isWished ? "찜 취소" : "찜하기"}
      title={isWished ? "찜 취소" : "찜하기"}
    >
      {isWished ? "♥" : "♡"}
    </Button>
  );
}
