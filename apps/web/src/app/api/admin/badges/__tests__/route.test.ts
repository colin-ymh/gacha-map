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

const mockBadges = [
  {
    id: "badge-1",
    track: "shop_visits",
    tier: 1,
    name: "Visitor",
    description: "Visit 10 shops",
    icon_url: "https://example.com/visitor.png",
    threshold: 10,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "badge-2",
    track: "shop_visits",
    tier: 2,
    name: "Frequent Visitor",
    description: "Visit 50 shops",
    icon_url: "https://example.com/frequent.png",
    threshold: 50,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/badges", {
    headers: { authorization: "Bearer valid-token" },
  });
}

describe("GET /api/admin/badges", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("배지 목록을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockBadges, null, 2);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.badges).toHaveLength(2);
    expect(body.badges[0].name).toBe("Visitor");
    expect(body.badges[1].name).toBe("Frequent Visitor");
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
