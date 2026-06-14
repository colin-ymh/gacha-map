import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn) => fn),
}));

const mockPlacesClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mockPlacesClient(),
}));

const mockPlaces = [
  {
    id: "place-1",
    name: "강남역 가샤샵",
    road_address: "서울시 강남구 역삼동",
    lat: 37.498,
    lng: 127.0274,
    phone: "02-1234-5678",
    category: "shop",
  },
  {
    id: "place-2",
    name: "강남역 대형 마트",
    road_address: "서울시 강남구 강남대로",
    lat: 37.4979,
    lng: 127.0276,
    phone: "02-9876-5432",
    category: "mall",
  },
];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/places");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("GET /api/places", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("장소 목록을 반환한다", async () => {
    const mock = createSupabaseMock(mockPlaces, null, 2);
    mockPlacesClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.places).toHaveLength(2);
    expect(body.places[0].name).toBe("강남역 가샤샵");
    expect(mock._chain.not).toHaveBeenCalledWith("lat", "is", null);
    expect(mock._chain.not).toHaveBeenCalledWith("lng", "is", null);
  });

  it("유효하지 않은 lat 파라미터는 400", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest({ lat: "invalid" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid lat/lng");
  });

  it("유효하지 않은 lng 파라미터는 400", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest({ lng: "invalid" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid lat/lng");
  });

  it("lat은 유효하지만 lng가 없으면 400", async () => {
    const { GET } = await import("../route");
    const res = await GET(makeRequest({ lat: "37.5" }));
    const body = await res.json();

    expect(res.status).toBe(400);
  });

  it("search 파라미터가 있으면 ilike 호출된다", async () => {
    const mock = createSupabaseMock(mockPlaces.slice(0, 1), null, 1);
    mockPlacesClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ search: "가샤" }));

    expect(mock._chain.ilike).toHaveBeenCalledWith("name", "%가샤%");
  });

  it("bbox 파라미터로 지역 필터링한다", async () => {
    const mock = createSupabaseMock(mockPlaces, null, 2);
    mockPlacesClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(
      makeRequest({
        swLat: "37.4",
        swLng: "127.0",
        neLat: "37.6",
        neLng: "127.1",
      }),
    );

    expect(mock._chain.gte).toHaveBeenCalledWith("lat", 37.4);
    expect(mock._chain.lte).toHaveBeenCalledWith("lat", 37.6);
    expect(mock._chain.gte).toHaveBeenCalledWith("lng", 127.0);
    expect(mock._chain.lte).toHaveBeenCalledWith("lng", 127.1);
  });

  it("DB 에러 시 500", async () => {
    const mock = createSupabaseMock(null, { message: "Connection timeout" }, 0);
    mockPlacesClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Connection timeout");
  });

  it("bbox 파라미터 일부만 있으면 무시된다", async () => {
    const mock = createSupabaseMock(mockPlaces, null, 2);
    mockPlacesClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ swLat: "37.4", swLng: "127.0" }));

    expect(mock._chain.gte).not.toHaveBeenCalled();
  });
});
