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

const mockFlag = {
  id: "flag-1",
  reviewed_at: "2024-01-03T00:00:00Z",
  reviewed_by: "admin-uid",
};

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/abuse-flags/flag-1", {
    method: "PATCH",
    headers: { authorization: "Bearer valid-token" },
  });
}

const mockParams = { params: Promise.resolve({ id: "flag-1" }) };

describe("PATCH /api/admin/abuse-flags/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("reviewed_at가 설정된 flag를 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockFlag, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest(), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flag).toBeDefined();
    expect(body.flag.reviewed_at).toBe(mockFlag.reviewed_at);
    expect(body.flag.reviewed_by).toBe(mockFlag.reviewed_by);
  });

  it("flag가 없으면 404를 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);
    mock._chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest(), mockParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Not found");
  });

  it("인증 실패 시 401을 반환한다", async () => {
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest(), mockParams);

    expect(res.status).toBe(401);
  });

  it("DB 에러 시 500을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "flag-1" },
      error: null,
    });
    mock._chain.single.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest(), mockParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
