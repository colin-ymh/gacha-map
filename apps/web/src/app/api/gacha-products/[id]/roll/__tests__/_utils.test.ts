import { describe, it, expect, vi, afterEach } from "vitest";
import type { GachaProductVariant } from "@gacha-map/shared";
import { pickRandomVariant } from "../_utils";

function makeVariants(): GachaProductVariant[] {
  return ["A", "B", "C"].map((id) => ({
    id,
    product_id: "prod-1",
    name: id,
    name_ko: null,
    name_en: null,
    image_url: null,
    sort_order: 0,
    status: "active",
  }));
}

describe("pickRandomVariant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("가장 최근에 뽑힌 variant도 다시 선택될 수 있다 (중복 회피 없음)", () => {
    const variants = makeVariants();
    // index 2 -> "C", the variant assumed to have just been rolled.
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    const picked = pickRandomVariant(variants);

    expect(picked.id).toBe("C");
  });

  it("모든 인덱스에 대해 균등하게 pool 전체에서 선택한다", () => {
    const variants = makeVariants();

    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickRandomVariant(variants).id).toBe("A");

    vi.spyOn(Math, "random").mockReturnValue(0.34);
    expect(pickRandomVariant(variants).id).toBe("B");

    vi.spyOn(Math, "random").mockReturnValue(0.67);
    expect(pickRandomVariant(variants).id).toBe("C");
  });
});
