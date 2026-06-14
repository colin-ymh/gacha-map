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

describe("PUT /api/users/badges/main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("메인 배지를 설정한다", async () => {
    const authMock = createSupabaseMock({ id: "badge-1" });

    authMock._chain.single.mockResolvedValueOnce({
      data: { id: "badge-1" },
      error: null,
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: authMock,
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/users/badges/main", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({ badge_id: "badge-1" }),
    });

    const { PUT } = await import("../route");
    const res = await PUT(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("badge_id=null로 메인 배지를 해제한다", async () => {
    const authMock = createSupabaseMock(null);

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: authMock,
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/users/badges/main", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({ badge_id: null }),
    });

    const { PUT } = await import("../route");
    const res = await PUT(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("배지가 없으면 404", async () => {
    const authMock = createSupabaseMock(null);

    authMock._chain.single.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: authMock,
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/users/badges/main", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({ badge_id: "non-existent-badge" }),
    });

    const { PUT } = await import("../route");
    const res = await PUT(req);

    expect(res.status).toBe(404);
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const req = new NextRequest("http://localhost/api/users/badges/main", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge_id: "badge-1" }),
    });

    const { PUT } = await import("../route");
    const res = await PUT(req);

    expect(res.status).toBe(401);
  });
});
