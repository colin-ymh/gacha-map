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

const mockProducts = [
  {
    id: "product-1",
    manufacturer: "bandai",
    name: "ガシャポン 商品A",
    name_ja: "ガシャポン 商品A",
    name_ko: null,
    name_en: null,
    jan_code: "4582769979859",
    product_code: null,
    price_jpy: 400,
    release_month: "2026-05-01",
    release_week_text: "2026年5月第4週",
    types_count: 5,
    official_image_url: "https://example.com/product.jpg",
    source_url: "https://www.gashapon.jp/products/detail.php?jan_code=4582769979859",
    source_type: "official",
    status: "active",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    last_seen_at: "2026-05-25T00:00:00Z",
  },
];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/gacha-products");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("GET /api/gacha-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("active 상품 목록과 페이지네이션 메타를 반환한다", async () => {
    const mock = createSupabaseMock(mockProducts, null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
    expect(mock._chain.eq).toHaveBeenCalledWith("status", "active");
  });

  it("manufacturer 필터가 적용된다", async () => {
    const mock = createSupabaseMock(mockProducts, null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ manufacturer: "bandai" }));

    expect(mock._chain.eq).toHaveBeenCalledWith("manufacturer", "bandai");
  });

  it("q 검색어가 상품명과 코드 필드에 적용된다", async () => {
    const mock = createSupabaseMock(mockProducts, null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ q: "4582" }));

    expect(mock._chain.or).toHaveBeenCalledWith(
      "name.ilike.%4582%,name_ja.ilike.%4582%,name_ko.ilike.%4582%,name_en.ilike.%4582%,jan_code.ilike.%4582%,product_code.ilike.%4582%",
    );
  });

  it("offset, limit 파라미터가 적용되고 limit은 100으로 제한된다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ offset: "10", limit: "200" }));
    const body = await res.json();

    expect(body.offset).toBe(10);
    expect(body.limit).toBe(100);
    expect(mock._chain.range).toHaveBeenCalledWith(10, 109);
  });

  it("Supabase 에러 시 500을 반환한다", async () => {
    const mock = createSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
