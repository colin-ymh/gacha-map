import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));
const fixtures = [
  { id: "translated", name: "ねこ", name_ja: "ねこ", name_ko: "고양이", sort_order: 2, image_url: "cat" },
  { id: "unnamed", name: null, name_ja: null, name_ko: null, sort_order: 14, image_url: "item" },
];
const props = { params: Promise.resolve({ id: "product" }) };
const request = () => new NextRequest("http://localhost/api/gacha-products/product/variants");

function client(error: unknown = null) {
  const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue({data: error ? null : fixtures, error});
  return { from: vi.fn().mockReturnValue(chain) };
}

beforeEach(() => vi.clearAllMocks());

describe("GET variants display names", () => {
  it("serves a stable numbered label to existing apps without changing raw names", async () => {
    const db = client(); createClient.mockResolvedValue(db);
    const { GET } = await import("../route");
    const response = await GET(request(), props);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.variants[0]).toMatchObject({name_ko: "고양이", name_status: "translated"});
    expect(body.variants[1]).toMatchObject({id: "unnamed", name_ko: "구성품 14", display_name: "구성품 14", name_status: "unnamed", image_url: "item"});
    expect(fixtures[1]?.name_ko).toBeNull();
    expect(db.from).toHaveBeenCalledWith("gacha_product_variants");
  });

  it("does not hide database errors behind empty lists", async () => {
    createClient.mockResolvedValue(client({message: "unavailable"}));
    const { GET } = await import("../route");
    const response = await GET(request(), props);
    expect(response.status).toBe(500);
  });
});
