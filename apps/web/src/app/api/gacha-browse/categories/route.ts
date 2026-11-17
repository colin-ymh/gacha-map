import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaBrowseCategory, GachaCategoryType } from "@/types";

export const dynamic = "force-dynamic";

// 노션 기획서 §2 참고.
//
// line 은 원래 "시리즈와 개념이 겹쳐 혼동을 준다"는 이유로 빠져 있었다. 겹침의 정체는
// 오네무탄·메지루시 같은 가챠 종류가 gacha_series 와 gacha_categories 양쪽에 동시에
// 있던 것이었고, 2026-09-04 에 toy_line 시리즈를 archive 하고 browse_gacha_series 에서
// 걸러내면서 해소됐다. 이제 노출한다.
//
// origin 은 '일본'이 1,355건이라 필터로서 변별력이 없어 계속 제외한다.
const BROWSABLE_TYPES: GachaCategoryType[] = [
  "product_type",
  "subject",
  "genre",
  "line",
];

function parseType(raw: string | null): GachaCategoryType | null {
  if (!raw) return null;
  return BROWSABLE_TYPES.includes(raw as GachaCategoryType)
    ? (raw as GachaCategoryType)
    : null;
}

/**
 * GET /api/gacha-browse/categories?type=product_type
 *
 * type 을 주면 그 축만, 생략하면 노출 대상 4축을 전부 돌려준다.
 * 상품 수 0인 카테고리는 RPC 단에서 이미 빠진다.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type");

  if (rawType && !parseType(rawType)) {
    return NextResponse.json(
      { error: `unsupported category type: ${rawType}` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const type = parseType(rawType);

  const { data, error } = await supabase.rpc("browse_gacha_categories", {
    p_category_type: type,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as GachaBrowseCategory[];
  // type 미지정이면 origin 이 섞여 오므로 여기서 거른다.
  const categories = type
    ? rows
    : rows.filter((c) => BROWSABLE_TYPES.includes(c.category_type));

  return NextResponse.json({ categories });
}
