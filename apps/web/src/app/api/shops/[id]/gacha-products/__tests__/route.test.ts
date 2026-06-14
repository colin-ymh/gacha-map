import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createAdminSupabaseMock,
  createSupabaseMock,
} from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateAdminClient = vi.fn();
const mockCreateAuthenticatedClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
}));

vi.mock("@/lib/badges", () => ({
  getWeekStart: vi.fn().mockReturnValue("2026-06-09"),
}));

describe("GET /api/shops/[id]/gacha-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("상품 목록과 user_quick_report를 반환한다", async () => {
    const mockProducts = [
      {
        id: "sgp-1",
        shop_id: "shop-1",
        source: "shop_owner",
        gacha_product_id: "prod-1",
      },
      {
        id: "sgp-2",
        shop_id: "shop-1",
        source: "user_report",
        gacha_product_id: "prod-2",
      },
    ];

    const adminMock = createAdminSupabaseMock(mockProducts);
    const authMock = createSupabaseMock(null, null, 0, { id: "user-1" });

    mockCreateAdminClient.mockReturnValue(adminMock);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: authMock,
      user: { id: "user-1" },
    });

    adminMock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { kind: "positive" }, error: null }) // shop_quick_reports
      .mockResolvedValueOnce({
        data: { contribution_count: 5 },
        error: null,
      }); // user_profiles

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.products).toHaveLength(2);
    expect(data.user_quick_report).toBe("positive");
    expect(data.contribution_count).toBe(5);
  });

  it("인증 없어도 목록 반환 (anon user)", async () => {
    const mockProducts = [
      {
        id: "sgp-1",
        shop_id: "shop-1",
        source: "shop_owner",
      },
    ];

    const adminMock = createAdminSupabaseMock(mockProducts);
    mockCreateAdminClient.mockReturnValue(adminMock);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: null,
    });

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.products).toHaveLength(1);
    expect(data.user_quick_report).toBeNull();
    expect(data.contribution_count).toBeNull();
  });
});

describe("POST /api/shops/[id]/gacha-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("새 레코드 생성 (201)", async () => {
    const adminMock = createAdminSupabaseMock(null);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null }) // shop
      .mockResolvedValueOnce({ data: { id: "prod-1" }, error: null }) // product
      .mockResolvedValueOnce({ data: null, error: null }); // existing = null

    adminMock._chain.single.mockResolvedValueOnce({
      data: {
        id: "rec-1",
        shop_id: "shop-1",
        gacha_product_id: "prod-1",
        price_krw: 5000,
        source: "user_report",
        availability_status: "seen",
      },
      error: null,
    });

    const { POST } = await import("../route");
    const body = JSON.stringify({
      gacha_product_id: "prod-1",
      price_krw: 5000,
    });
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.product.id).toBe("rec-1");
  });

  it("기존 레코드 업데이트 (200)", async () => {
    const adminMock = createAdminSupabaseMock(null);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "shop-1" }, error: null }) // shop
      .mockResolvedValueOnce({ data: { id: "prod-1" }, error: null }) // product
      .mockResolvedValueOnce({ data: { id: "rec-1" }, error: null }); // existing

    adminMock._chain.single.mockResolvedValueOnce({
      data: {
        id: "rec-1",
        shop_id: "shop-1",
        gacha_product_id: "prod-1",
        price_krw: 6000,
        source: "user_report",
      },
      error: null,
    });

    const { POST } = await import("../route");
    const body = JSON.stringify({
      gacha_product_id: "prod-1",
      price_krw: 6000,
    });
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.product.id).toBe("rec-1");
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: null,
    });

    const { POST } = await import("../route");
    const body = JSON.stringify({ gacha_product_id: "prod-1" });
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: "shop-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/Unauthorized/);
  });

  it("샵 없으면 404", async () => {
    const adminMock = createAdminSupabaseMock(null);
    const authMock = createAdminSupabaseMock(null);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: authMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    }); // shop = null

    const { POST } = await import("../route");
    const body = JSON.stringify({ gacha_product_id: "prod-1" });
    const req = new NextRequest(
      "http://localhost/api/shops/shop-missing/gacha-products",
      {
        method: "POST",
        body,
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: "shop-missing" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Shop not found/);
  });
});
