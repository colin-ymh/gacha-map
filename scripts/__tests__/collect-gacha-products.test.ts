import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  extractProductLinks,
  parseBandaiProduct,
  parseTakaraProduct,
  upsertProduct,
} from "../collect-gacha-products";

function fixture(name: string) {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

describe("collect-gacha-products parser", () => {
  it("Bandai 상품 상세 HTML에서 필드를 파싱한다", () => {
    const product = parseBandaiProduct(
      fixture("bandai-product.html"),
      "https://www.gashapon.jp/products/detail.php?jan_code=4582769979859",
    );

    expect(product.manufacturer).toBe("bandai");
    expect(product.name).toBe("ガシャポン サンプル商品");
    expect(product.jan_code).toBe("4582769979859");
    expect(product.price_jpy).toBe(400);
    expect(product.release_month).toBe("2026-05-01");
    expect(product.release_week_text).toBe("2026年5月第4週");
    expect(product.types_count).toBe(5);
    expect(product.official_image_url).toBe(
      "https://www.gashapon.jp/images/sample-bandai.jpg",
    );
  });

  it("Takara Tomy Arts 상품 상세 HTML에서 fallback key 필드를 파싱한다", () => {
    const product = parseTakaraProduct(
      fixture("takara-product.html"),
      "https://www.takaratomy-arts.co.jp/items/item.html?n=Y900365",
    );

    expect(product.manufacturer).toBe("takara_tomy_arts");
    expect(product.name).toBe("カプセルトイ サンプル商品");
    expect(product.product_code).toBe("Y900365");
    expect(product.price_jpy).toBe(300);
    expect(product.release_month).toBe("2026-06-01");
    expect(product.types_count).toBe(4);
    expect(product.source_product_key).toBe("Y900365");
  });

  it("목록 HTML에서 제조사별 상세 링크를 중복 없이 추출한다", () => {
    const html = `
      <a href="/products/detail.php?jan_code=4582769979859">Bandai</a>
      <a href="/products/detail.php?jan_code=4582769979859">Bandai duplicated</a>
      <a href="/items/item.html?n=Y900365">Takara</a>
    `;

    expect(
      extractProductLinks(html, "https://www.gashapon.jp/products/", "bandai"),
    ).toEqual([
      "https://www.gashapon.jp/products/detail.php?jan_code=4582769979859",
    ]);

    expect(
      extractProductLinks(
        html,
        "https://www.takaratomy-arts.co.jp/items/gacha/",
        "takara_tomy_arts",
      ),
    ).toEqual(["https://www.takaratomy-arts.co.jp/items/item.html?n=Y900365"]);
  });

  it("기존 상품이 있으면 새 row를 만들지 않고 update 후 source를 upsert한다", async () => {
    const product = parseBandaiProduct(
      fixture("bandai-product.html"),
      "https://www.gashapon.jp/products/detail.php?jan_code=4582769979859",
    );
    const findChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "existing-product-id" },
        error: null,
      }),
    };
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "existing-product-id" },
        error: null,
      }),
    };
    const sourceChain = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(findChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(sourceChain);
    const supabase = { from };

    await upsertProduct(supabase as never, product);

    expect(from).toHaveBeenNthCalledWith(1, "gacha_products");
    expect(from).toHaveBeenNthCalledWith(2, "gacha_products");
    expect(from).toHaveBeenNthCalledWith(3, "gacha_product_sources");
    expect(updateChain.update).toHaveBeenCalled();
    expect(sourceChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: "existing-product-id",
        source_name: "bandai_gashapon",
        source_product_key: "4582769979859",
      }),
      { onConflict: "source_name,source_product_key" },
    );
  });
});
