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

const mockProduct = {
  id: "product-1",
  manufacturer: "bandai",
  name: "수정된 상품",
  normalized_name: "수정된 상품",
  name_ja: "ガシャポン 商品A",
  name_ko: "수정된 상품",
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
  status: "hidden",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  last_seen_at: "2026-05-25T00:00:00Z",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/gacha-products/product-1", {
    method: "PATCH",
    headers: { authorization: "Bearer valid-token" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/gacha-products/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("허용된 필드를 수정한다", async () => {
    const mock = createAdminSupabaseMock(mockProduct, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "수정된 상품", status: "hidden" }), {
      params: Promise.resolve({ id: "product-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.product.id).toBe("product-1");
    expect(mock._chain.update).toHaveBeenCalledWith({
      name: "수정된 상품",
      normalized_name: "수정된 상품",
      status: "hidden",
    });
  });

  it("빈 body는 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockProduct, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: "product-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/At least one/);
  });

  it("유효하지 않은 status는 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockProduct, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ status: "deleted" }), {
      params: Promise.resolve({ id: "product-1" }),
    });

    expect(res.status).toBe(400);
  });
});
