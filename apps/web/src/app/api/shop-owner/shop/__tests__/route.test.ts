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

const mockVerifyShopOwnerAuth = vi.fn();
vi.mock("@/lib/supabase/shop-owner", () => ({
  verifyShopOwnerAuth: mockVerifyShopOwnerAuth,
}));

const mockContainsProfanity = vi.fn().mockReturnValue(false);
vi.mock("@gacha-map/shared", () => ({
  containsProfanity: mockContainsProfanity,
}));

const mockShop = {
  id: "shop-1",
  name: "우리집 가샤샵",
  address: "서울시 강남구 역삼동",
  lat: 37.498,
  lng: 127.0274,
  description: "최고의 가샤샵",
  phone: "02-1234-5678",
  opening_hours: '{"mon":"09:00-22:00"}',
  is_authorized: true,
  status: "active",
  owner_id: "owner-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function makeRequest(
  method: "GET" | "PATCH" = "GET",
  body?: Record<string, unknown>,
) {
  return new NextRequest("http://localhost/api/shop-owner/shop", {
    method,
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer valid-token",
    },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

describe("GET /api/shop-owner/shop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("샵 정보를 반환한다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(mockShop, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop).toBeDefined();
    expect(body.shop.name).toBe("우리집 가샤샵");
    expect(mock._chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
  });

  it("샵이 없으면 404", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(
      null,
      { message: "No rows", code: "PGRST116" },
      0,
    );
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Shop not found");
  });

  it("인증 실패 시 401을 반환한다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"));

    expect(res.status).toBe(401);
  });

  it("DB 에러 시 500", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const mock = createAdminSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest("GET"));
    const body = await res.json();

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/shop-owner/shop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("허용된 필드를 수정한다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const updatedShop = { ...mockShop, name: "새로운 이름" };
    const mock = createAdminSupabaseMock(updatedShop, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest("PATCH", { name: "새로운 이름" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop.name).toBe("새로운 이름");
  });

  it("빈 name은 400", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest("PATCH", { name: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Name");
  });

  it("name이 100자를 초과하면 400", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest("PATCH", { name: "a".repeat(101) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("100");
  });

  it("비속어가 있으면 400", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    mockContainsProfanity.mockReturnValueOnce(true);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest("PATCH", { description: "비속어" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("profanity");
  });

  it("업데이트할 필드가 없으면 400", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest("PATCH", {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("No valid fields");
  });

  it("인증 실패 시 401을 반환한다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest("PATCH", { name: "test" }));

    expect(res.status).toBe(401);
  });

  it("유효하지 않은 JSON body는 400", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });

    const req = new NextRequest("http://localhost/api/shop-owner/shop", {
      method: "PATCH",
      headers: { authorization: "Bearer valid-token" },
      body: "invalid json",
    }) as unknown as NextRequest;

    const { PATCH } = await import("../route");
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("JSON");
  });

  it("phone과 opening_hours는 제약 없이 업데이트된다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const updatedShop = {
      ...mockShop,
      phone: "02-9999-9999",
      opening_hours: '{"mon":"10:00-23:00"}',
    };
    const mock = createAdminSupabaseMock(updatedShop, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      makeRequest("PATCH", {
        phone: "02-9999-9999",
        opening_hours: '{"mon":"10:00-23:00"}',
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop.phone).toBe("02-9999-9999");
  });

  it("description을 null로 설정할 수 있다", async () => {
    mockVerifyShopOwnerAuth.mockResolvedValueOnce({
      ok: true,
      user: { id: "owner-1" },
    });
    const updatedShop = { ...mockShop, description: null };
    const mock = createAdminSupabaseMock(updatedShop, null, 0);
    mockCreateAdminClient.mockReturnValue(mock);

    const { PATCH } = await import("../route");
    const res = await PATCH(makeRequest("PATCH", { description: null }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop.description).toBeNull();
  });
});
