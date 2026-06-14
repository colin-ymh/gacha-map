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

const mockVerifyShopOwnerAuth = vi.fn();
vi.mock("@/lib/supabase/shop-owner", () => ({
  verifyShopOwnerAuth: mockVerifyShopOwnerAuth,
}));

const mockReviews = [
  {
    id: "review-1",
    shop_id: "shop-1",
    user_id: "user-1",
    content: "좋은 상품이 많아요",
    image_urls: ["https://example.com/img1.jpg"],
    created_at: "2026-06-10T12:00:00Z",
    updated_at: "2026-06-10T12:00:00Z",
    user_profiles: {
      nickname: "가샤팬",
      avatar_url: "https://example.com/avatar.jpg",
    },
  },
  {
    id: "review-2",
    shop_id: "shop-1",
    user_id: "user-2",
    content: "직원이 친절해요",
    image_urls: null,
    created_at: "2026-06-09T10:00:00Z",
    updated_at: "2026-06-09T10:00:00Z",
    user_profiles: {
      nickname: "리뷰어",
      avatar_url: null,
    },
  },
];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/shop-owner/reviews");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url, {
    headers: { authorization: "Bearer valid-token" },
  });
}

describe("GET /api/shop-owner/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("리뷰 목록을 반환한다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(mockReviews, null, 2);
    // First call: get shop
    mock._chain.single.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    // Second call: get reviews (use range terminal)
    mock._chain.range.mockResolvedValueOnce({
      data: mockReviews,
      error: null,
      count: 2,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reviews).toHaveLength(2);
    expect(body.reviews[0].content).toBe("좋은 상품이 많아요");
    expect(body.total).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
  });

  it("offset/limit 파라미터가 적용된다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(mockReviews.slice(0, 1), null, 2);
    mock._chain.single.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mock._chain.range.mockResolvedValueOnce({
      data: mockReviews.slice(0, 1),
      error: null,
      count: 2,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ offset: "5", limit: "10" }));
    const body = await res.json();

    expect(body.offset).toBe(5);
    expect(body.limit).toBe(10);
    expect(mock._chain.range).toHaveBeenCalledWith(5, 14);
  });

  it("limit이 50을 초과하면 50으로 제한된다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock([], null, 0);
    mock._chain.single.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mock._chain.range.mockResolvedValueOnce({
      data: [],
      error: null,
      count: 0,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ limit: "100" }));
    const body = await res.json();

    expect(body.limit).toBe(50);
  });

  it("샵이 없으면 404", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(
      null,
      { message: "No rows", code: "PGRST116" },
      0,
    );
    mock._chain.single.mockResolvedValueOnce({
      data: null,
      error: { message: "No rows", code: "PGRST116" },
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Shop not found");
  });

  it("인증 실패 시 401을 반환한다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
  });

  it("리뷰 조회 DB 에러 시 500", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(null, { message: "DB error" }, 0);
    mock._chain.single.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mock._chain.range.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
      count: 0,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });

  it("offset과 limit이 기본값으로 설정된다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(mockReviews, null, 2);
    mock._chain.single.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mock._chain.range.mockResolvedValueOnce({
      data: mockReviews,
      error: null,
      count: 2,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
  });

  it("offset이 음수이면 0으로 제한된다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(mockReviews, null, 2);
    mock._chain.single.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mock._chain.range.mockResolvedValueOnce({
      data: mockReviews,
      error: null,
      count: 2,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ offset: "-10" }));
    const body = await res.json();

    expect(body.offset).toBe(0);
  });

  it("limit이 1 미만이면 1로 제한된다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(mockReviews.slice(0, 1), null, 2);
    mock._chain.single.mockResolvedValueOnce({
      data: { id: "shop-1" },
      error: null,
    });
    mock._chain.range.mockResolvedValueOnce({
      data: mockReviews.slice(0, 1),
      error: null,
      count: 2,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ limit: "0" }));
    const body = await res.json();

    expect(body.limit).toBe(1);
  });
});
