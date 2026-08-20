import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test/mocks/supabase";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockProduct = {
  id: "product-1",
  manufacturer: "bandai",
  name: "ガシャポン 商品A",
  name_ja: "ガシャポン 商品A",
  name_ko: null,
  name_en: null,
  jan_code: "4582769979859",
  product_code: null,
  price_jpy: 400,
  release_month: "2026-05-01",
  release_week_text: "2026年5月第4週",
  types_count: 5,
  official_image_url: "https://example.com/product.jpg",
  source_url: "https://www.gashapon.jp/products/detail.php?jan_code=4582769979859",
  source_type: "official",
  status: "active",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  last_seen_at: "2026-05-25T00:00:00Z",
  name_parts: { tags: ["아이돌", "K-POP"], series: null, version: null, product_type: null },
};
const mockProducts = [mockProduct];

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/gacha-products");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe("GET /api/gacha-products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("active 상품 목록과 페이지네이션 메타를 반환한다", async () => {
    const mock = createSupabaseMock(mockProducts, null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(20);
    expect(mock._chain.eq).toHaveBeenCalledWith("status", "active");
  });

  it("manufacturer 필터가 적용된다", async () => {
    const mock = createSupabaseMock(mockProducts, null, 1);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ manufacturer: "bandai" }));

    expect(mock._chain.eq).toHaveBeenCalledWith("manufacturer", "bandai");
  });

  it("q 검색어가 있으면 search_gacha_products RPC를 호출한다", async () => {
    const rpcData = [{ ...mockProduct, total_count: 1 }];
    const mock = createSupabaseMock(rpcData, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ q: "4582" }));
    const body = await res.json();

    expect(mock.rpc).toHaveBeenCalledWith("search_gacha_products", {
      q: "4582",
      p_manufacturer: null,
      p_limit: 20,
      p_offset: 0,
      p_fuzzy: true,
      p_min_similarity: 0.4,
      p_has_variants: false,
    });
    expect(body.products).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("q + manufacturer 필터가 RPC에 함께 전달된다", async () => {
    const rpcData = [{ ...mockProduct, total_count: 1 }];
    const mock = createSupabaseMock(rpcData, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ q: "K-POP", manufacturer: "bandai" }));

    expect(mock.rpc).toHaveBeenCalledWith("search_gacha_products", {
      q: "K-POP",
      p_manufacturer: "bandai",
      p_limit: 20,
      p_offset: 0,
      p_fuzzy: true,
      p_min_similarity: 0.4,
      p_has_variants: false,
    });
  });

  // 회귀 방지: 예전에는 RPC 분기가 PostgREST 쿼리 구성보다 뒤에 있어서
  // has_variants 필터가 PostgREST 쪽에만 걸렸다. q와 함께 오면(모바일 홈의
  // 가챠 핀 검색) 변형 필터가 통째로 무시됐다.
  it("q + has_variants가 함께 오면 RPC에 p_has_variants를 넘긴다", async () => {
    const rpcData = [{ ...mockProduct, total_count: 1 }];
    const mock = createSupabaseMock(rpcData, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    await GET(makeRequest({ q: "치이카와", has_variants: "true" }));

    expect(mock.rpc).toHaveBeenCalledWith(
      "search_gacha_products",
      expect.objectContaining({ p_has_variants: true }),
    );
  });

  // has_variants는 "변형 보유 + 대표 이미지 있음"을 뜻한다(핀 검색용).
  // RPC는 변형 보유 여부만 판정하므로 이미지 조건은 라우트가 맞춘다.
  it("has_variants 검색에서 이미지 없는 상품은 제외하고 total도 함께 줄인다", async () => {
    const rpcData = [
      { ...mockProduct, total_count: 2 },
      {
        ...mockProduct,
        id: "product-2",
        official_image_url: null,
        total_count: 2,
      },
    ];
    const mock = createSupabaseMock(rpcData, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ q: "치이카와", has_variants: "true" }));
    const body = await res.json();

    expect(body.products).toHaveLength(1);
    expect(body.products[0].id).toBe("product-1");
    expect(body.total).toBe(1);
  });

  it("검색 응답에 applied_aliases가 실린다", async () => {
    const aliases = [{ alias: "먼작귀", canonical_terms: ["치이카와"] }];
    const rpcData = [
      { ...mockProduct, total_count: 1, matched_aliases: aliases },
    ];
    const mock = createSupabaseMock(rpcData, null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ q: "먼작귀" }));
    const body = await res.json();

    expect(body.applied_aliases).toEqual(aliases);
  });

  it("q 검색 결과가 없으면 total은 0이다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ q: "없는검색어" }));
    const body = await res.json();

    expect(body.products).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("offset, limit 파라미터가 적용되고 limit은 100으로 제한된다", async () => {
    const mock = createSupabaseMock([], null, 0);
    mockCreateClient.mockReturnValue(mock);

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ offset: "10", limit: "200" }));
    const body = await res.json();

    expect(body.offset).toBe(10);
    expect(body.limit).toBe(100);
    expect(mock._chain.range).toHaveBeenCalledWith(10, 109);
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
