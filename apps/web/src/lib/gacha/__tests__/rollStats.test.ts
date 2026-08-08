import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getUserGachaCollections,
  getProductCollectionDetail,
} from "../rollStats";

/** from(...).select().eq().in().order() 체인을 흉내내고, await 하면 result를 준다 */
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function makeClient(
  tables: Record<string, { data: unknown; error?: unknown }>,
) {
  return {
    from: vi.fn((table: string) =>
      makeChain(tables[table] ?? { data: [], error: null }),
    ),
  } as unknown as SupabaseClient;
}

describe("getUserGachaCollections", () => {
  it("뽑기 기록이 없으면 빈 배열을 반환한다", async () => {
    const client = makeClient({
      gacha_roll_results: { data: [], error: null },
    });

    const result = await getUserGachaCollections(client, "user-1");

    expect(result).toEqual([]);
  });

  it("가챠별 진행률/완성 여부를 집계하고 완성 항목을 앞으로 정렬한다", async () => {
    const client = makeClient({
      gacha_roll_results: {
        data: [
          { product_id: "prod-a", variant_id: "a1" },
          { product_id: "prod-b", variant_id: "b1" },
          { product_id: "prod-b", variant_id: "b2" },
        ],
        error: null,
      },
      gacha_products: {
        data: [
          {
            id: "prod-a",
            name: "A",
            name_ja: null,
            name_ko: "에이",
            official_image_url: "img-a",
          },
          {
            id: "prod-b",
            name: "B",
            name_ja: "ビー",
            name_ko: null,
            official_image_url: "img-b",
          },
        ],
      },
      gacha_product_variants: {
        data: [
          { product_id: "prod-a" },
          { product_id: "prod-b" },
          { product_id: "prod-b" },
          { product_id: "prod-b" },
        ],
      },
    });

    const result = await getUserGachaCollections(client, "user-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      productId: "prod-a",
      productDisplayName: "에이",
      totalVariants: 1,
      collectedCount: 1,
      isComplete: true,
    });
    expect(result[1]).toMatchObject({
      productId: "prod-b",
      productDisplayName: "ビー",
      totalVariants: 3,
      collectedCount: 2,
      isComplete: false,
    });
  });
});

describe("getProductCollectionDetail", () => {
  const ACTIVE_VARIANTS = {
    data: [
      { id: "v1", name: "V1", name_ko: null, image_url: "img-v1" },
      { id: "v2", name: "V2", name_ko: "브이2", image_url: "img-v2" },
    ],
  };

  it("비로그인(userId=null)이면 전체 variant를 미수집 상태로 반환한다", async () => {
    const client = makeClient({
      gacha_product_variants: ACTIVE_VARIANTS,
    });

    const result = await getProductCollectionDetail(client, null, "prod-a");

    expect(result.totalVariants).toBe(2);
    expect(result.collectedCount).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.variants.every((v) => !v.collected && v.count === 0)).toBe(
      true,
    );
  });

  it("모든 active variant를 뽑았으면 완성 처리한다", async () => {
    const client = makeClient({
      gacha_product_variants: ACTIVE_VARIANTS,
      gacha_roll_results: {
        data: [
          { variant_id: "v1" },
          { variant_id: "v2" },
          { variant_id: "v2" },
        ],
      },
    });

    const result = await getProductCollectionDetail(client, "user-1", "prod-a");

    expect(result.collectedCount).toBe(2);
    expect(result.isComplete).toBe(true);
    const v2 = result.variants.find((v) => v.variantId === "v2");
    expect(v2).toMatchObject({ collected: true, count: 2 });
  });

  it("active variant가 하나도 없으면 isComplete는 false다", async () => {
    const client = makeClient({
      gacha_product_variants: { data: [] },
    });

    const result = await getProductCollectionDetail(client, "user-1", "prod-a");

    expect(result.totalVariants).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.variants).toEqual([]);
  });
});
