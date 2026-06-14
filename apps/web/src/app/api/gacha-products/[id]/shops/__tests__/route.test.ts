import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockShopGachaProducts = [
  {
    shop_id: "shop-1",
    price_krw: 5000,
    shops: {
      id: "shop-1",
      name: "가샤샵 서울",
      address: "서울시 강남구",
    },
  },
  {
    shop_id: "shop-2",
    price_krw: 5500,
    shops: {
      id: "shop-2",
      name: "가샤마트",
      address: "서울시 종로구",
    },
  },
];

function makeRequest(
  productId: string = "prod-1",
  params: Record<string, string> = {},
) {
  const url = new URL(`http://localhost/api/gacha-products/${productId}/shops`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("GET /api/gacha-products/[id]/shops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("상점 목록을 반환한다", async () => {
    const mock = createSupabaseMock(mockShopGachaProducts, null, 2);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shops).toHaveLength(2);
    expect(body.shops[0]).toEqual({
      shop_id: "shop-1",
      shop_name: "가샤샵 서울",
      address: "서울시 강남구",
      image_url: null,
      price_krw: 5000,
    });
    expect(body.total).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
  });

  it("offset/limit 파라미터가 적용된다", async () => {
    const mock = createSupabaseMock(mockShopGachaProducts.slice(0, 1), null, 2);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1", { offset: "10", limit: "5" }), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(body.offset).toBe(10);
    expect(body.limit).toBe(5);
    expect(mock._chain.range).toHaveBeenCalledWith(10, 14);
  });

  it("limit이 100을 초과하면 100으로 제한된다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1", { limit: "200" }), {
      params: Promise.resolve({ id: "prod-1" }),
    });

    const body = await res.json();
    expect(body.limit).toBe(100);
  });

  it("DB 에러 시 500", async () => {
    const mock = createSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });

  it("shops 필드가 null이면 빈 값으로 처리한다", async () => {
    const productWithNullShop = [
      {
        shop_id: "shop-3",
        price_krw: 6000,
        shops: null,
      },
    ];
    const mock = createSupabaseMock(productWithNullShop, null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shops[0].shop_name).toBe("");
    expect(body.shops[0].address).toBeNull();
  });
});
