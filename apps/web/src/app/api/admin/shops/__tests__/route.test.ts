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

const mockShops = [
  {
    id: "shop-1",
    name: "가챠샵 A",
    address: "서울시 강남구",
    lat: 37.5,
    lng: 127.0,
    tags: ["피규어"],
    is_authorized: true,
    status: "active",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "shop-2",
    name: "가챠샵 B",
    address: "서울시 마포구",
    lat: 37.55,
    lng: 126.9,
    tags: [],
    is_authorized: false,
    status: "active",
    created_at: "2024-01-02T00:00:00Z",
  },
];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/shops");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    headers: { authorization: "Bearer valid-token" },
  });
}

describe("GET /api/admin/shops", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("정상 요청 시 shops 목록과 total을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockShops, null, 2);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shops).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(50);
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

  it("status=active 파라미터 필터가 적용된다", async () => {
    const mock = createAdminSupabaseMock(mockShops, null, 2);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ status: "active" }));

    expect(mock._chain.eq).toHaveBeenCalledWith("status", "active");
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

  it("q 검색어가 있으면 or 필터가 적용된다", async () => {
    const mock = createAdminSupabaseMock([mockShops[0]], null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ q: "강남" }));

    expect(mock._chain.or).toHaveBeenCalledWith(
      "name.ilike.%강남%,address.ilike.%강남%",
    );
  });

  it("offset, limit 파라미터가 정상 적용된다", async () => {
    const mock = createAdminSupabaseMock([], null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ offset: "10", limit: "5" }));
    const body = await res.json();

    expect(body.offset).toBe(10);
    expect(body.limit).toBe(5);
    expect(mock._chain.range).toHaveBeenCalledWith(10, 14);
  });

  it("limit이 100을 초과하면 100으로 클램프된다", async () => {
    const mock = createAdminSupabaseMock([], null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ limit: "200" }));
    const body = await res.json();

    expect(body.limit).toBe(100);
  });

  it("Supabase 에러 시 500을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
