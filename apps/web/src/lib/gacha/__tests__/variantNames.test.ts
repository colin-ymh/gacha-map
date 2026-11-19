import { describe, expect, it } from "vitest";
import { getVariantDisplayName, getVariantNameStatus, withVariantDisplayName } from "../variantNames";

describe("variant display names", () => {
  it("keeps translated Korean and English brand names", () => {
    expect(getVariantDisplayName({ name_ko: "  흰 고양이  ", sort_order: 7 })).toBe("흰 고양이");
    expect(getVariantDisplayName({ name_ko: "miffy", sort_order: 2 })).toBe("miffy");
  });

  it("uses the stored order rather than renumbering a filtered result", () => {
    expect(getVariantDisplayName({ name_ko: null, sort_order: 14 })).toBe("구성품 14");
    expect(getVariantDisplayName({ name_ko: " ", sort_order: 3 })).toBe("구성품 3");
  });

  it("distinguishes a missing translation from an unnamed item", () => {
    expect(getVariantNameStatus({ name: null, name_ja: null, name_ko: null })).toBe("unnamed");
    expect(getVariantNameStatus({ name_ja: "ねこ", name_ko: null })).toBe("translation_pending");
    expect(getVariantNameStatus({ name: "구성품 이미지 2", name_ko: "구성품 2" })).toBe("translation_pending");
    expect(getVariantNameStatus({ name_ko: "번역 준비중인 상품" })).toBe("translation_pending");
  });

  it("does not expose untranslated Japanese or accept invalid ordinals", () => {
    expect(getVariantDisplayName({ name: "ねこ", name_ko: "고양이 ｶﾞﾁｬ", sort_order: 8 })).toBe("구성품 8");
    for (const sort_order of [0, -1, 1.5, NaN, undefined]) {
      expect(getVariantDisplayName({ sort_order })).toBe("구성품");
    }
  });

  it("supports localized copy without changing the number", () => {
    expect(getVariantDisplayName({ sort_order: 12 }, (n) => `Item ${n}`, "Item")).toBe("Item 12");
  });

  it("presents legacy-compatible fields without changing the stored object", () => {
    const raw = Object.freeze({ id: "v", name: null, name_ko: null, sort_order: 5 });
    expect(withVariantDisplayName(raw)).toMatchObject({ id: "v", name_ko: "구성품 5", display_name: "구성품 5", name_status: "unnamed", translated_name_ko: null });
    expect(raw.name_ko).toBeNull();
  });
});
