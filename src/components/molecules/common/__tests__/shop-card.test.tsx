import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { render } from "@/test/render";
import ShopCard from "../shop-card";
import type { Shop } from "@/types";

const baseShop: Shop = {
  id: "shop-1",
  name: "테스트 가챠샵",
  address: "서울시 강남구 테헤란로 1",
  lat: 37.5,
  lng: 127.0,
  description: null,
  tags: ["뽑기", "피규어"],
  image_urls: ["https://example.com/img.jpg"],
  status: "approved",
  is_authorized: true,
  place_id: null,
  reported_by: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("ShopCard", () => {
  it("샵 이름과 주소를 렌더링한다", () => {
    render(<ShopCard shop={baseShop} />);
    expect(screen.getByText("테스트 가챠샵")).toBeInTheDocument();
    expect(screen.getByText("서울시 강남구 테헤란로 1")).toBeInTheDocument();
  });

  it("태그 목록을 렌더링한다", () => {
    render(<ShopCard shop={baseShop} />);
    // Tag 컴포넌트가 `#label` 형태로 렌더링하므로 regex로 확인
    expect(screen.getByText(/#뽑기/)).toBeInTheDocument();
    expect(screen.getByText(/#피규어/)).toBeInTheDocument();
  });

  it("이미지가 있으면 img 태그를 렌더링한다", () => {
    render(<ShopCard shop={baseShop} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/img.jpg");
    expect(img).toHaveAttribute("alt", "테스트 가챠샵");
  });

  it("image_urls가 비어 있으면 img 태그를 렌더링하지 않는다", () => {
    const shop = { ...baseShop, image_urls: [] };
    render(<ShopCard shop={shop} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("태그가 없으면 태그 영역을 렌더링하지 않는다", () => {
    const shop = { ...baseShop, tags: [] };
    render(<ShopCard shop={shop} />);
    expect(screen.queryByText("뽑기")).not.toBeInTheDocument();
  });

  it("찜 버튼 클릭 시 onWishlistToggle이 shopId와 함께 호출된다", () => {
    const onToggle = vi.fn();
    render(<ShopCard shop={baseShop} onWishlistToggle={onToggle} />);
    const wishlistBtn = screen.getByRole("button");
    fireEvent.click(wishlistBtn);
    expect(onToggle).toHaveBeenCalledWith("shop-1");
  });

  it("wishlisted=true이면 속이 찬 하트를 표시한다", () => {
    render(<ShopCard shop={baseShop} wishlisted={true} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("♥");
  });

  it("wishlisted=false이면 빈 하트를 표시한다", () => {
    render(<ShopCard shop={baseShop} wishlisted={false} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toBe("♡");
  });

  it("카드 클릭 시 onSelect가 shopId와 함께 호출된다", () => {
    const onSelect = vi.fn();
    render(<ShopCard shop={baseShop} onSelect={onSelect} />);
    // 카드 전체 영역 클릭 (최상위 div)
    const card = screen.getByText("테스트 가챠샵").closest("div[class]")!;
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith("shop-1");
  });
});
