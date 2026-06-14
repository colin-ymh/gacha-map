import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateAuthenticatedClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
}));

describe("GET /api/users/badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("배지 정보를 반환한다 (earned/main_badge_id/definitions)", async () => {
    const earnedBadges = [
      {
        id: "badge-1",
        user_id: "user-1",
        badge_definitions: { id: "badge-def-1", name: "first" },
      },
    ];

    const authMock = createSupabaseMock(earnedBadges, null, 1, {
      id: "user-1",
    });

    authMock._chain.single.mockResolvedValueOnce({
      data: { main_badge_id: "badge-1" },
      error: null,
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: authMock,
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/users/badges", {
      method: "GET",
      headers: { authorization: "Bearer tok" },
    });

    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.earned).toHaveLength(1);
    expect(body.earned[0].id).toBe("badge-1");
    expect(body.main_badge_id).toBe("badge-1");
    expect(Array.isArray(body.definitions)).toBe(true);
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const req = new NextRequest("http://localhost/api/users/badges", {
      method: "GET",
    });

    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});
