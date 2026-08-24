import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaBrowseCategory, GachaCategoryType } from "@/types";

export const dynamic = "force-dynamic";

// UI에 노출하는 축은 셋뿐이다. line 은 시리즈와 개념이 겹쳐 혼동을 주고,
// origin 은 '일본'이 대부분이라 필터로서 변별력이 없다.
// 노션 기획서 §2 참고.
const BROWSABLE_TYPES: GachaCategoryType[] = [
  "product_type",
  "subject",
  "genre",
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
 * type 을 주면 그 축만, 생략하면 노출 대상 3축을 전부 돌려준다.
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
  // type 미지정이면 line/origin 이 섞여 오므로 여기서 거른다.
  const categories = type
    ? rows
    : rows.filter((c) => BROWSABLE_TYPES.includes(c.category_type));

  return NextResponse.json({ categories });
}
