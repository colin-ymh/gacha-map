import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createAdminSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateAdminClient = vi.fn();
const mockCreateAuthenticatedClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => mockCreateAdminClient(),
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
}));

describe("DELETE /api/shops/[id]/gacha-products/[recordId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("레코드를 삭제하고 204를 반환한다", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: { id: "rec-1" },
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { DELETE } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products/rec-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "shop-1", recordId: "rec-1" }),
    });

    expect(res.status).toBe(204);
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: null,
    });

    const { DELETE } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products/rec-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "shop-1", recordId: "rec-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/Unauthorized/);
  });

  it("레코드가 없으면 404", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });

    const mock = createAdminSupabaseMock(null);
    mock._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockCreateAdminClient.mockReturnValue(mock);

    const { DELETE } = await import("../route");
    const req = new NextRequest(
      "http://localhost/api/shops/shop-1/gacha-products/rec-missing",
      { method: "DELETE" },
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "shop-1", recordId: "rec-missing" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/Not found/);
  });
});
