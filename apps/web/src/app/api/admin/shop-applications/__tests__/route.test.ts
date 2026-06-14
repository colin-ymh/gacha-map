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

const mockApplications = [
  {
    id: "app-1",
    status: "pending",
    type: "new_shop",
    created_at: "2024-01-01T00:00:00Z",
    shops: { name: "테스트샵" },
  },
];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/shop-applications");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    headers: { authorization: "Bearer valid-token" },
  });
}

function makeMockWithRangeChain(
  data: unknown,
  error: { message: string; code?: string } | null = null,
) {
  const mock = createAdminSupabaseMock(data, error, data ? 1 : 0);
  mock._chain.range.mockReturnValue(mock._chain);
  return mock;
}

describe("GET /api/admin/shop-applications", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("신청 목록을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockApplications, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.applications).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(50);
  });

  it("status 필터가 적용된다", async () => {
    const mock = makeMockWithRangeChain(mockApplications, null);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ status: "pending" }));

    expect(mock._chain.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("type 필터가 적용된다", async () => {
    const mock = makeMockWithRangeChain(mockApplications, null);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ type: "new_shop" }));

    expect(mock._chain.eq).toHaveBeenCalledWith("type", "new_shop");
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

  it("유효하지 않은 type은 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock([], null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ type: "invalid_type" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid type/);
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
});
