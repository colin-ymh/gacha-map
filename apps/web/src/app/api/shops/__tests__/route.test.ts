import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test/mocks/supabase";

// next/headers mock (cookies 사용 차단)
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// @/lib/supabase/server mock
const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockShops = [
  {
    id: "shop-1",
    name: "가챠샵 A",
    address: "서울시 강남구",
    lat: 37.5,
    lng: 127.0,
    tags: ["뽑기", "피규어"],
    image_urls: ["https://example.com/img1.jpg"],
    is_authorized: true,
  },
  {
    id: "shop-2",
    name: "가챠샵 B",
    address: "서울시 마포구",
    lat: 37.55,
    lng: 126.9,
    tags: ["뽑기"],
    image_urls: [],
    is_authorized: false,
  },
];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/shops");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

describe("GET /api/shops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 요청 시 shops 목록과 total을 반환한다", async () => {
    const mock = createSupabaseMock(mockShops, null, 2);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shops).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
  });

  it("bbox 파라미터가 일부만 있으면 400을 반환한다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ swLat: "37.0" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid bbox/);
  });

  it("bbox 좌표가 숫자가 아니면 400을 반환한다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(
      makeRequest({
        swLat: "abc",
        swLng: "127.0",
        neLat: "38.0",
        neLng: "128.0",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid bbox/);
  });

  it("유효한 bbox로 조회하면 쿼리에 gte/lte 필터가 적용된다", async () => {
    const mock = createSupabaseMock([mockShops[0]], null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(
      makeRequest({
        swLat: "37.0",
        swLng: "126.5",
        neLat: "38.0",
        neLng: "127.5",
      }),
    );

    expect(mock._chain.gte).toHaveBeenCalledWith("lat", 37.0);
    expect(mock._chain.lte).toHaveBeenCalledWith("lat", 38.0);
    expect(mock._chain.gte).toHaveBeenCalledWith("lng", 126.5);
    expect(mock._chain.lte).toHaveBeenCalledWith("lng", 127.5);
  });

  it("검색어 q가 있으면 or 필터가 적용된다", async () => {
    const mock = createSupabaseMock([mockShops[0]], null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ q: "강남" }));

    expect(mock._chain.or).toHaveBeenCalledWith(
      "name.ilike.%강남%,address.ilike.%강남%",
    );
  });

  it("tag 파라미터가 있으면 contains 필터가 적용된다", async () => {
    const mock = createSupabaseMock([mockShops[0]], null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ tag: "피규어" }));

    expect(mock._chain.contains).toHaveBeenCalledWith("tags", ["피규어"]);
  });

  it("offset, limit 파라미터가 정상 적용된다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ offset: "10", limit: "5" }));
    const body = await res.json();

    expect(body.offset).toBe(10);
    expect(body.limit).toBe(5);
    expect(mock._chain.range).toHaveBeenCalledWith(10, 14);
  });

  it("limit이 100을 초과하면 100으로 클램프된다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ limit: "200" }));
    const body = await res.json();

    expect(body.limit).toBe(100);
  });

  it("Supabase 에러 시 500을 반환한다", async () => {
    const mock = createSupabaseMock(null, { message: "DB error" }, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB error");
  });
});
