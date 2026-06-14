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

const mockBadge = {
  id: "badge-1",
  track: "shop_visits",
  tier: 1,
  name: "Explorer",
  description: "Visit 25 shops",
  icon_url: "https://example.com/explorer.png",
  threshold: 25,
  updated_at: "2024-01-03T00:00:00Z",
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/badges/badge-1", {
    method: "PATCH",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const mockParams = { params: Promise.resolve({ id: "badge-1" }) };

describe("PATCH /api/admin/badges/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("허용된 필드(name, threshold)를 수정한다", async () => {
    const mock = createAdminSupabaseMock(
      { ...mockBadge, name: "Super Explorer" },
      null,
      1,
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest({ name: "Super Explorer", threshold: 30 }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.badge).toBeDefined();
    expect(mock._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Super Explorer",
        threshold: 30,
        updated_at: expect.any(String),
      }),
    );
  });

  it("빈 body는 400 반환", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({}), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No valid fields to update");
  });

  it("허용되지 않은 필드만 있으면 400 반환", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest({ track: "other_track", tier: 5 }),
      mockParams,
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No valid fields to update");
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
    const res = await PATCH(makeRequest({ name: "Test" }), mockParams);

    expect(res.status).toBe(401);
  });

  it("DB 에러 시 500을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ name: "Test" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
