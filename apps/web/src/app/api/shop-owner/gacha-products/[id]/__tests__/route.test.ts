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

describe("PUT /api/shop-owner/gacha-products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("레코드를 업데이트한다", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null }) // shop
      .mockResolvedValueOnce({
        data: { id: "rec-1", price_krw: 5000 },
        error: null,
      }); // record
    mockCreateAdminClient.mockReturnValue(mock);

    const { PUT } = await import("../route");
    const body = JSON.stringify({ price_krw: 6000 });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "PUT", body },
    );

    const res = await PUT(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.product).toBeDefined();
  });

  it("업데이트할 필드가 없으면 400", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const { PUT } = await import("../route");
    const body = JSON.stringify({});
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "PUT", body },
    );

    const res = await PUT(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/No valid fields to update/);
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
    }); // shop = null
    mockCreateAdminClient.mockReturnValue(mock);

    const { PUT } = await import("../route");
    const body = JSON.stringify({ price_krw: 6000 });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "PUT", body },
    );

    const res = await PUT(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Shop not found/);
  });

  it("레코드가 없으면 404", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null }) // shop
      .mockResolvedValueOnce({ data: null, error: null }); // record = null
    mockCreateAdminClient.mockReturnValue(mock);

    const { PUT } = await import("../route");
    const body = JSON.stringify({ price_krw: 6000 });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "PUT", body },
    );

    const res = await PUT(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Not found/);
  });

  it("인증 실패 시 403", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
    });

    const { PUT } = await import("../route");
    const body = JSON.stringify({ price_krw: 6000 });
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "PUT", body },
    );

    const res = await PUT(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/shop-owner/gacha-products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("레코드를 삭제하고 204를 반환한다", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null }) // shop
      .mockResolvedValueOnce({ data: { id: "rec-1" }, error: null }); // deleted record
    mockCreateAdminClient.mockReturnValue(mock);

    const { DELETE } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });

    expect(res.status).toBe(204);
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
    }); // shop = null
    mockCreateAdminClient.mockReturnValue(mock);

    const { DELETE } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Shop not found/);
  });

  it("레코드가 없으면 404", async () => {
    const { verifyShopOwnerAuth } = await import("@/lib/supabase/shop-owner");
    vi.mocked(verifyShopOwnerAuth).mockResolvedValue({
      ok: true,
      user: { id: "owner-uid" } as never,
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null }) // shop
      .mockResolvedValueOnce({ data: null, error: null }); // no record
    mockCreateAdminClient.mockReturnValue(mock);

    const { DELETE } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shop-owner/gacha-products/rec-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "rec-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Not found/);
  });
});
