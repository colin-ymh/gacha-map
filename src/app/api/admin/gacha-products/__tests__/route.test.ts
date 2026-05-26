import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  verifyAdminAuth: vi.fn(),
}));

const mockProducts = [
  {
    id: "product-1",
    manufacturer: "bandai",
    name: "ガシャポン 商品A",
    normalized_name: "ガシャポン 商品a",
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
  const url = new URL("http://localhost/api/admin/gacha-products");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url, {
    headers: { authorization: "Bearer valid-token" },
  });
}

describe("GET /api/admin/gacha-products", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("어드민 상품 목록을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockProducts, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(mock._chain.eq).toHaveBeenCalledWith("status", "active");
  });

  it("인증 실패 시 401을 반환한다", async () => {
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
  });

  it("유효하지 않은 status는 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock([], null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ status: "invalid" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid status/);
  });

  it("q 검색어가 적용된다", async () => {
    const mock = createAdminSupabaseMock(mockProducts, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ q: "상품" }));

    expect(mock._chain.or).toHaveBeenCalledWith(
      "name.ilike.%상품%,name_ja.ilike.%상품%,name_ko.ilike.%상품%,name_en.ilike.%상품%,jan_code.ilike.%상품%,product_code.ilike.%상품%",
    );
  });
});
