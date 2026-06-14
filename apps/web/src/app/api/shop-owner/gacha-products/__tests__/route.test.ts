import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("@/lib/supabase/shop-owner", () => ({
  verifyShopOwnerAuth: vi.fn(),
}));

describe("POST /api/shop-owner/gacha-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("새 레코드를 생성한다 (201)", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "prod-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }); // existing = null → insert
    mock._chain.single.mockResolvedValueOnce({
      data: {
        id: "rec-1",
        shop_id: "shop-1",
        gacha_product_id: "prod-1",
        price_krw: 5000,
        availability_status: "available",
        source: "shop_owner",
        created_at: "2026-06-14T00:00:00Z",
        updated_at: "2026-06-14T00:00:00Z",
      },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const body = JSON.stringify({
      gacha_product_id: "prod-1",
      price_krw: 5000,
      availability_status: "available",
    });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.product).toBeDefined();
    expect(data.product.id).toBe("rec-1");
  });

  it("기존 레코드를 업데이트한다 (200)", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "prod-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "rec-1" }, error: null }); // existing
    mock._chain.single.mockResolvedValueOnce({
      data: {
        id: "rec-1",
        shop_id: "shop-1",
        gacha_product_id: "prod-1",
        price_krw: 6000,
        availability_status: "available",
        source: "shop_owner",
      },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const body = JSON.stringify({
      gacha_product_id: "prod-1",
      price_krw: 6000,
    });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.product.id).toBe("rec-1");
  });

  it("gacha_product_id 없으면 400", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const { POST } = await import("../route");
    const body = JSON.stringify({ price_krw: 5000 });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/gacha_product_id is required/);
  });

  it("상품이 없으면 404", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }); // product not found
    mockCreateAdminClient.mockReturnValue(mock);

    const { POST } = await import("../route");
    const body = JSON.stringify({ gacha_product_id: "prod-missing" });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Gacha product not found/);
  });

  it("인증 실패 시 403", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
    });

    const { POST } = await import("../route");
    const body = JSON.stringify({ gacha_product_id: "prod-1" });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/shop-owner/gacha-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("상품 목록을 반환한다", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mockProducts = [
      {
        id: "rec-1",
        shop_id: "shop-1",
        gacha_product_id: "prod-1",
        price_krw: 5000,
        availability_status: "available",
        source: "shop_owner",
      },
    ];
    const mock = createAdminSupabaseMock(mockProducts);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.products).toHaveLength(1);
    expect(data.products[0].id).toBe("rec-1");
  });

  it("샵이 없으면 404", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Shop not found/);
  });

  it("인증 실패 시 403", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
    });

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products",
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});
