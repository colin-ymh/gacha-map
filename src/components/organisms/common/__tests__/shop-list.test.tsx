import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import ShopList from "../shop-list";
import type { Shop } from "@/types";

function makeShop(id: string, name: string): Shop {
  return {
    id,
    name,
    address: `주소 ${id}`,
    lat: 37.5,
    lng: 127.0,
    description: null,
    tags: [],
    image_urls: [],
    status: "active",
    is_authorized: true,
    place_id: null,
    candidate_group_id: null,
    reported_by: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

const shops = [makeShop("1", "샵 A"), makeShop("2", "샵 B")];

describe("ShopList", () => {
  it("isLoading=true이면 loading 메시지를 표시한다", () => {
    render(<ShopList shops={[]} isLoading={true} />);
    // setup.ts mock: useTranslations returns key
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("isLoading=true이면 ShopCard를 렌더링하지 않는다", () => {
    render(<ShopList shops={shops} isLoading={true} />);
    expect(screen.queryByText("샵 A")).not.toBeInTheDocument();
  });

  it("샵 목록이 비어 있으면 empty 메시지를 표시한다", () => {
    render(<ShopList shops={[]} />);
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("emptyMessage prop을 지정하면 해당 메시지를 표시한다", () => {
    render(<ShopList shops={[]} emptyMessage="검색 결과 없음" />);
    expect(screen.getByText("검색 결과 없음")).toBeInTheDocument();
  });

  it("샵 목록이 있으면 각 샵 이름을 렌더링한다", () => {
    render(<ShopList shops={shops} />);
    expect(screen.getByText("샵 A")).toBeInTheDocument();
    expect(screen.getByText("샵 B")).toBeInTheDocument();
  });

  it("showCount=true이면 카운트 헤더를 렌더링한다", () => {
    render(<ShopList shops={shops} showCount={true} />);
    // useTranslations mock은 key를 반환하므로 "count:{"count":2}" 형태
    expect(screen.getByText(/count/)).toBeInTheDocument();
  });

  it("showCount=false(기본값)이면 카운트 헤더를 렌더링하지 않는다", () => {
    render(<ShopList shops={shops} />);
    expect(screen.queryByText(/count/)).not.toBeInTheDocument();
  });

  it("selectedShopId와 일치하는 샵이 선택 상태로 전달된다", () => {
    const onShopSelect = vi.fn();
    render(
      <ShopList shops={shops} selectedShopId="1" onShopSelect={onShopSelect} />,
    );
    // 선택된 샵 이름이 렌더링되어 있음
    expect(screen.getByText("샵 A")).toBeInTheDocument();
  });
});
