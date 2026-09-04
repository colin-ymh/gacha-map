import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GachaBrowseSeries, GachaSeriesKind } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// UI 칩과 kind 값의 대응. '애니메이션' 칩만 두 값을 묶는다.
// unknown 은 어떤 칩에도 넣지 않는다 — '전체'에서만 보인다. 기획서 §6-3.
const KIND_FILTERS: Record<string, GachaSeriesKind[]> = {
  anime: ["anime", "manga"],
  other: ["other"],
  character_brand: ["character_brand"],
  franchise: ["franchise"],
  game: ["game"],
};

function parsePagination(searchParams: URLSearchParams) {
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const rawLimit = parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10,
  );

  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  return { offset, limit };
}

/**
 * GET /api/gacha-browse/series?chip=anime&parentId=...&limit=&offset=
 *
 * chip 생략 = 전체(unknown 포함).
 * parentId 생략 = 루트 시리즈만. 값을 주면 그 시리즈의 자식만.
 *
 * '애니메이션' 칩은 anime 과 manga 두 값을 묶으므로 RPC 를 두 번 부르고 합친다.
 * RPC 는 kind 를 단일 값으로만 받기 때문이다.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chip = searchParams.get("chip");
  const parentId = searchParams.get("parentId");
  const { offset, limit } = parsePagination(searchParams);

  if (chip && !KIND_FILTERS[chip]) {
    return NextResponse.json(
      { error: `unsupported chip: ${chip}` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const kinds = chip ? KIND_FILTERS[chip] : [null];

  // 단일 kind 면 RPC 가 페이지네이션까지 처리한다.
  if (kinds.length === 1) {
    const { data, error } = await supabase.rpc("browse_gacha_series", {
      p_kind: kinds[0],
      p_parent_id: parentId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as (GachaBrowseSeries & {
      total_count: number;
    })[];

    return NextResponse.json({
      series: rows,
      total: rows[0]?.total_count ?? 0,
      offset,
      limit,
    });
  }

  // 여러 kind 를 묶는 칩(애니메이션)은 각각 넉넉히 받아 합친 뒤 잘라낸다.
  // 노출 대상이 수백 건 규모라 이 방식으로 충분하다.
  const results = await Promise.all(
    kinds.map((kind) =>
      supabase.rpc("browse_gacha_series", {
        p_kind: kind,
        p_parent_id: parentId,
        p_limit: MAX_LIMIT * 10,
        p_offset: 0,
      }),
    ),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  const merged = results
    .flatMap((r) => (r.data ?? []) as GachaBrowseSeries[])
    .sort(
      (a, b) =>
        b.rollup_product_count - a.rollup_product_count ||
        a.name_ko.localeCompare(b.name_ko) ||
        a.series_id.localeCompare(b.series_id),
    );

  return NextResponse.json({
    series: merged.slice(offset, offset + limit),
    total: merged.length,
    offset,
    limit,
  });
}
