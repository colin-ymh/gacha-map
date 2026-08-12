import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";
// Supabase pg_cron(pg_net)이 호출할 때 쓰는 별도 secret.
// send-notifications와 동일한 규약을 따른다.
const DB_CRON_SECRET = process.env.DB_CRON_SECRET || "";

const BUCKET = "scan-images";
const BATCH_LIMIT = 200;
const HARD_RETENTION_DAYS = 90;
// 조사가 끝난 것으로 보는 상태. pending/searching/needs_review는 아직 이미지가 필요하다.
const TERMINAL_STATUSES = ["imported", "no_match", "failed"];

/**
 * Cron 인증 검증 (send-notifications와 동일)
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) return false;

  if (CRON_SECRET.length > 0 && token === CRON_SECRET) return true;
  if (DB_CRON_SECRET.length > 0 && token === DB_CRON_SECRET) return true;
  return false;
}

/**
 * public/signed storage URL에서 버킷 내부 경로만 뽑아낸다.
 * 예: https://<ref>.supabase.co/storage/v1/object/public/scan-images/<uid>/<ts>.jpg
 *  -> <uid>/<ts>.jpg
 */
function toStoragePath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - HARD_RETENTION_DAYS * 86_400_000,
  ).toISOString();

  // 조사가 끝났거나(상태 terminal), 끝나지 않았어도 보존 상한을 넘긴 건
  const { data: rows, error: selectError } = await supabase
    .from("gacha_product_discovery_requests")
    .select("id, observation_id, image_url, status, created_at")
    .not("image_url", "is", null)
    .or(`status.in.(${TERMINAL_STATUSES.join(",")}),created_at.lt.${cutoff}`)
    .limit(BATCH_LIMIT);

  if (selectError) {
    console.error("[PurgeScanImages] select error:", selectError);
    return NextResponse.json({ error: "select_failed" }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ purged: 0, skipped: 0 });
  }

  const paths: string[] = [];
  const purgedIds: string[] = [];
  const purgedObservationIds: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const path = row.image_url ? toStoragePath(row.image_url) : null;
    if (!path) {
      // 버킷 밖 URL이면 파일 삭제 대상이 아니다. 참조만 정리한다.
      skipped += 1;
      purgedIds.push(row.id);
      if (row.observation_id) purgedObservationIds.push(row.observation_id);
      continue;
    }
    paths.push(path);
    purgedIds.push(row.id);
    if (row.observation_id) purgedObservationIds.push(row.observation_id);
  }

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);
    if (removeError) {
      console.error("[PurgeScanImages] remove error:", removeError.message);
      return NextResponse.json({ error: "remove_failed" }, { status: 500 });
    }
  }

  // 파일을 지운 뒤에만 참조를 끊는다. 순서가 반대면 고아 파일이 남는다.
  const { error: drUpdateError } = await supabase
    .from("gacha_product_discovery_requests")
    .update({ image_url: null })
    .in("id", purgedIds);

  if (drUpdateError) {
    console.error("[PurgeScanImages] discovery update error:", drUpdateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  if (purgedObservationIds.length > 0) {
    const { error: obsUpdateError } = await supabase
      .from("gacha_product_observations")
      .update({ image_url: null })
      .in("id", purgedObservationIds);
    if (obsUpdateError) {
      // 파일과 discovery 참조는 이미 정리됐다. 다음 실행에서 재시도되지 않으므로 로그만 남긴다.
      console.error(
        "[PurgeScanImages] observation update error:",
        obsUpdateError,
      );
    }
  }

  console.log(
    `[PurgeScanImages] purged=${paths.length} refsCleared=${purgedIds.length} skipped=${skipped}`,
  );

  return NextResponse.json({
    purged: paths.length,
    refsCleared: purgedIds.length,
    skipped,
    hasMore: rows.length === BATCH_LIMIT,
  });
}
