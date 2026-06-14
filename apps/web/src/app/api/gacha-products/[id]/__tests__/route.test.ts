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

const mockProduct = {
  id: "prod-1",
  manufacturer: "bandai",
  name: "原名",
  name_ja: "日本名",
  name_ko: "한국명",
  name_en: null,
  jan_code: "4582769979859",
  product_code: null,
  price_jpy: 400,
  release_month: "2026-05-01",
  release_week_text: "2026년5월제4주",
  types_count: 5,
  official_image_url: "https://example.com/product.jpg",
  source_url:
    "https://www.gashapon.jp/products/detail.php?jan_code=4582769979859",
  source_type: "official",
  status: "active",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  last_seen_at: "2026-05-25T00:00:00Z",
};

function makeRequest(id: string = "prod-1") {
  return new NextRequest(new URL(`http://localhost/api/gacha-products/${id}`));
}

describe("GET /api/gacha-products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("상품을 반환한다 (display_name = name_ko)", async () => {
    const mock = createSupabaseMock(mockProduct, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.product).toBeDefined();
    expect(body.product.display_name).toBe("한국명");
    expect(mock._chain.eq).toHaveBeenCalledWith("status", "active");
  });

  it("name_ko가 없으면 name_ja를 사용한다", async () => {
    const productNoKo = { ...mockProduct, name_ko: null };
    const mock = createSupabaseMock(productNoKo, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(body.product.display_name).toBe("日本名");
  });

  it("name_ko와 name_ja가 없으면 name을 사용한다", async () => {
    const productFallback = {
      ...mockProduct,
      name_ko: null,
      name_ja: null,
    };
    const mock = createSupabaseMock(productFallback, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(body.product.display_name).toBe("原名");
  });

  it("상품이 없으면 404 (PGRST116)", async () => {
    const mock = createSupabaseMock(
      null,
      { message: "No rows", code: "PGRST116" },
      0,
    );
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Gacha product not found");
  });

  it("DB 에러 시 500", async () => {
    const mock = createSupabaseMock(null, { message: "Connection failed" }, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("prod-1"), {
      params: Promise.resolve({ id: "prod-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Connection failed");
  });
});
