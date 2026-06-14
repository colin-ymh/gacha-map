import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createSupabaseMock,
  createAdminSupabaseMock,
} from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

vi.mock("@gacha-map/shared", () => ({
  containsProfanity: vi.fn().mockReturnValue(false),
}));

const mockCreateAuthenticatedClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

describe("GET /api/shop-applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("신청 목록을 반환한다", async () => {
    const applications = [
      {
        id: "app-1",
        type: "new_shop",
        user_id: "user-1",
        status: "pending",
      },
    ];

    const adminMock = createAdminSupabaseMock(applications);
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "GET",
      headers: { authorization: "Bearer tok" },
    });

    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applications).toHaveLength(1);
    expect(body.applications[0].id).toBe("app-1");
    expect(body.total).toBe(1);
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "GET",
    });

    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/shop-applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("new_shop 신청을 생성한다", async () => {
    const adminMock = createAdminSupabaseMock({ id: "app-1" });
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1" },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({
        type: "new_shop",
        business_registration_number: "123456789",
        representative_name: "대표자",
        phone_number: "01012345678",
        shop_name: "가샤포 가게",
        address: "서울시 강남구",
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("app-1");
  });

  it("claim_shop 신청을 생성한다", async () => {
    const adminMock = createAdminSupabaseMock({ id: "app-1" });
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: adminMock,
      user: { id: "user-1" },
    });
    mockCreateAdminClient.mockReturnValue(adminMock);

    const shopId = "550e8400-e29b-41d4-a716-446655440000";

    adminMock._chain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: shopId, status: "active" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    adminMock._chain.single.mockResolvedValueOnce({
      data: { id: "app-1" },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({
        type: "claim_shop",
        shop_id: shopId,
        business_registration_number: "123456789",
        representative_name: "대표자",
        phone_number: "01012345678",
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("app-1");
  });

  it("잘못된 type이면 400", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createAdminSupabaseMock(null),
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({
        type: "invalid_type",
        business_registration_number: "123456789",
        representative_name: "대표자",
        phone_number: "01012345678",
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("business_registration_number 없으면 400", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createAdminSupabaseMock(null),
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({
        type: "new_shop",
        representative_name: "대표자",
        phone_number: "01012345678",
        shop_name: "가게",
        address: "주소",
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("claim_shop에 잘못된 shop_id UUID면 400", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createAdminSupabaseMock(null),
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({
        type: "claim_shop",
        shop_id: "not-a-uuid",
        business_registration_number: "123456789",
        representative_name: "대표자",
        phone_number: "01012345678",
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("new_shop에 shop_name 없으면 400", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createAdminSupabaseMock(null),
      user: { id: "user-1" },
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer tok",
      },
      body: JSON.stringify({
        type: "new_shop",
        business_registration_number: "123456789",
        representative_name: "대표자",
        phone_number: "01012345678",
        address: "주소",
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("인증 없으면 401", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: createSupabaseMock(null),
      user: null,
    });

    const req = new NextRequest("http://localhost/api/shop-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "new_shop",
        business_registration_number: "123456789",
        representative_name: "대표자",
        phone_number: "01012345678",
        shop_name: "가게",
        address: "주소",
      }),
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});
