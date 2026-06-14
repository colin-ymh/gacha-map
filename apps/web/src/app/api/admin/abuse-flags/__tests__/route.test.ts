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

const mockFlags = [
  {
    id: "flag-1",
    user_id: "user-1",
    flag_type: "inappropriate",
    detail: "This shop appears to be closed",
    created_at: "2024-01-01T00:00:00Z",
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    id: "flag-2",
    user_id: "user-2",
    flag_type: "spam",
    detail: "Duplicate listing",
    created_at: "2024-01-02T00:00:00Z",
    reviewed_at: "2024-01-03T00:00:00Z",
    reviewed_by: "admin-1",
  },
];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/abuse-flags");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, {
    headers: { authorization: "Bearer valid-token" },
  });
}

describe("GET /api/admin/abuse-flags", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("목록을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockFlags, null, 2);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flags).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.hasMore).toBe(false);
  });

  it("reviewed=true 필터가 적용된다", async () => {
    const mock = createAdminSupabaseMock([mockFlags[1]], null, 1);
    mock._chain.range.mockReturnValue(mock._chain);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ reviewed: "true" }));

    expect(mock._chain.not).toHaveBeenCalledWith("reviewed_at", "is", null);
  });

  it("reviewed=false 필터가 적용된다", async () => {
    const mock = createAdminSupabaseMock([mockFlags[0]], null, 1);
    mock._chain.range.mockReturnValue(mock._chain);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ reviewed: "false" }));

    expect(mock._chain.is).toHaveBeenCalledWith("reviewed_at", null);
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

  it("DB 에러 시 500을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
