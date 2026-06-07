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

const mockShop = {
  id: "shop-1",
  name: "가챠샵 A",
  address: "서울시 강남구",
  lat: 37.5,
  lng: 127.0,
  is_authorized: true,
  status: "hidden",
  created_at: "2024-01-01T00:00:00Z",
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/shops/shop-1", {
    method: "PATCH",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const mockParams = { params: Promise.resolve({ id: "shop-1" }) };

describe("PATCH /api/admin/shops/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { verifyAdminAuth } = await import("@/lib/supabase/admin");
    vi.mocked(verifyAdminAuth).mockResolvedValue({
      ok: true,
      user: { id: "admin-uid" } as never,
    });
  });

  it("status 변경 시 정상 응답을 반환한다", async () => {
    const mock = createAdminSupabaseMock(mockShop, null, 1);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ status: "hidden" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop).toBeDefined();
    expect(mock._chain.update).toHaveBeenCalledWith({
      status: "hidden",
      hidden_reason: "manual",
    });
  });

  it("is_authorized 변경 시 정상 응답을 반환한다", async () => {
    const mock = createAdminSupabaseMock(
      { ...mockShop, is_authorized: true },
      null,
      1,
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ is_authorized: true }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop).toBeDefined();
    expect(mock._chain.update).toHaveBeenCalledWith({ is_authorized: true });
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
    const res = await PATCH(makeRequest({ status: "hidden" }), mockParams);

    expect(res.status).toBe(401);
  });

  it("유효하지 않은 status 값이면 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ status: "archived" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid status/);
  });

  it("업데이트할 필드가 없으면 400을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({}), mockParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/must be provided/);
  });

  it("샵이 없으면 404를 반환한다", async () => {
    const mock = createAdminSupabaseMock(
      null,
      { message: "Not found", code: "PGRST116" },
      0,
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ status: "hidden" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("Supabase 에러 시 500을 반환한다", async () => {
    const mock = createAdminSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest({ status: "hidden" }), mockParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
