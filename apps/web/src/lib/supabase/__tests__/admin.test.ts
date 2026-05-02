import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

function makeRequest(token?: string) {
  const url = new URL("http://localhost/api/admin/shops");
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new NextRequest(url, { headers });
}

function makeProfileChain(role: string | null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: role ? { role } : null,
      error: null,
    }),
  };
  return chain;
}

describe("verifyAdminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Authorization 헤더 없으면 401 반환", async () => {
    const { verifyAdminAuth } = await import("../admin");
    const result = await verifyAdminAuth(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("유효하지 않은 토큰이면 401 반환", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid"),
    });

    const { verifyAdminAuth } = await import("../admin");
    const result = await verifyAdminAuth(makeRequest("bad-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("user_profiles.role이 admin이 아니면 403 반환", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockFrom.mockReturnValue(makeProfileChain("user"));

    const { verifyAdminAuth } = await import("../admin");
    const result = await verifyAdminAuth(makeRequest("valid-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("user_profiles에 레코드가 없으면 403 반환", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockFrom.mockReturnValue(makeProfileChain(null));

    const { verifyAdminAuth } = await import("../admin");
    const result = await verifyAdminAuth(makeRequest("valid-token"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("user_profiles.role이 admin이면 ok:true와 user 반환", async () => {
    const mockUser = { id: "admin-1", email: "admin@test.com" };
    mockGetUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockFrom.mockReturnValue(makeProfileChain("admin"));

    const { verifyAdminAuth } = await import("../admin");
    const result = await verifyAdminAuth(makeRequest("admin-token"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toEqual(mockUser);
    }
  });
});
