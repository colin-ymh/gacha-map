import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockShop = {
  id: "shop-1",
  name: "가챠샵 A",
  address: "서울시 강남구",
  lat: 37.5,
  lng: 127.0,
  description: "가챠 전문점",
  is_authorized: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function makeRequest(id: string) {
  const url = new URL(`http://localhost/api/shops/${id}`);
  return new NextRequest(url);
}

async function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/shops/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("존재하는 ID 조회 시 200과 샵 데이터를 반환한다", async () => {
    const mock = createSupabaseMock(mockShop);
    mockCreateClient.mockReturnValue(mock);
    mockCreateAdminClient.mockReturnValue(createSupabaseMock(null, null, 1));

    const { GET } = await import("../route");
    const res = await GET(makeRequest("shop-1"), await makeParams("shop-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shop).toEqual({
      ...mockShop,
      wishlist_count: 1,
      representative_image_url: null,
    });
  });

  it("존재하지 않는 ID 조회 시 404를 반환한다", async () => {
    const mock = createSupabaseMock(null, {
      message: "No rows found",
      code: "PGRST116",
    });
    mockCreateClient.mockReturnValue(mock);
    mockCreateAdminClient.mockReturnValue(createSupabaseMock(null, null, 0));

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest("nonexistent"),
      await makeParams("nonexistent"),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Shop not found");
  });

  it("Supabase 일반 에러 시 500을 반환한다", async () => {
    const mock = createSupabaseMock(null, {
      message: "Connection failed",
      code: "500",
    });
    mockCreateClient.mockReturnValue(mock);
    mockCreateAdminClient.mockReturnValue(createSupabaseMock(null, null, 0));

    const { GET } = await import("../route");
    const res = await GET(makeRequest("shop-1"), await makeParams("shop-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Connection failed");
  });

  it("eq('id', id)와 eq('status', 'active')가 모두 호출된다", async () => {
    const mock = createSupabaseMock(mockShop);
    mockCreateClient.mockReturnValue(mock);
    mockCreateAdminClient.mockReturnValue(createSupabaseMock(null, null, 0));

    const { GET } = await import("../route");
    await GET(makeRequest("shop-1"), await makeParams("shop-1"));

    expect(mock._chain.eq).toHaveBeenCalledWith("id", "shop-1");
    expect(mock._chain.eq).toHaveBeenCalledWith("status", "active");
  });
});
