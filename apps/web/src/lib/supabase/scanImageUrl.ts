import { createAdminClient } from "./server";

export const SCAN_IMAGES_BUCKET = "scan-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1시간 — 어드민이 목록을 열어두는 시간 기준

/** `image_url` 컬럼에 담긴 값의 해석 결과. */
export type ScanImageRef =
  /** 우리 버킷 객체. `path`는 버킷 내부 경로. */
  | { kind: "bucket"; path: string }
  /** 우리 버킷이 아닌 외부 http(s) URL. 삭제할 파일이 없다. */
  | { kind: "external" }
  /** 해석 불가. 함부로 지우거나 서명하면 안 된다. */
  | { kind: "unknown" };

/**
 * `image_url` 값을 해석한다. 아래 세 형태를 모두 받는다.
 *
 * - public URL   `https://<ref>.supabase.co/storage/v1/object/public/scan-images/<uid>/<ts>.jpg`
 * - signed URL   위와 같되 `?token=...`이 붙은 형태
 * - object path  `scan-images/<uid>/<ts>.jpg` 또는 `<uid>/<ts>.jpg`
 *
 * object path 형태를 함께 받는 이유: 버킷 비공개 전환 과정에서 저장 포맷을
 * public URL → object path로 바꾸는 것이 예정돼 있다. 파서가 URL만 알면 그 전환
 * 시점에 조용히 실패한다 — 특히 purge가 파일을 못 지운 채 참조만 끊어 고아 파일을
 * 남긴다. 그래서 읽는 쪽이 두 포맷을 모두 감당하도록 미리 넓혀 둔다.
 */
export function parseScanImageRef(value: string): ScanImageRef {
  const trimmed = value.trim();
  if (!trimmed) return { kind: "unknown" };

  const marker = `/${SCAN_IMAGES_BUCKET}/`;
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const path = trimmed.slice(idx + marker.length).split("?")[0];
    return path.length > 0
      ? { kind: "bucket", path: decodeURIComponent(path) }
      : { kind: "unknown" };
  }

  if (/^https?:\/\//i.test(trimmed)) return { kind: "external" };

  // object path. `scan-images/<uid>/<ts>.jpg`처럼 버킷 접두사가 붙어 오는 경우와
  // `<uid>/<ts>.jpg`처럼 없는 경우를 모두 같은 경로로 정규화한다.
  // (위 marker 검사는 `/scan-images/`라 접두사로 시작하는 문자열과는 매칭되지 않는다.)
  const bare = trimmed
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${SCAN_IMAGES_BUCKET}/`), "")
    .split("?")[0];
  if (bare.includes("/") && !bare.includes("://")) {
    return { kind: "bucket", path: decodeURIComponent(bare) };
  }

  return { kind: "unknown" };
}

/**
 * 스캔 이미지 URL들을 signed URL로 교체한다.
 *
 * `scan-images`는 사용자가 촬영한 사진이고 경로에 userId가 들어가므로 공개 버킷으로
 * 두면 URL만 알면 누구나 열람할 수 있다. 어드민 화면은 signed URL로 본다.
 *
 * 버킷이 아직 public이어도 signed URL은 정상 동작하므로, 버킷 비공개 전환보다
 * 먼저 배포해도 안전하다.
 *
 * 서명에 실패한 항목은 `null`로 만든다. 원본 URL을 그대로 흘리면 비공개 전환 이후
 * 깨진 링크가 되고, 전환 전에는 공개 URL이 노출되기 때문이다. 두 소비처 모두
 * null을 플레이스홀더로 처리한다.
 */
export async function signScanImageUrls<T extends { image_url: string | null }>(
  rows: T[],
): Promise<T[]> {
  const wanted = new Set<string>();
  for (const row of rows) {
    if (!row.image_url) continue;
    const ref = parseScanImageRef(row.image_url);
    if (ref.kind === "bucket") wanted.add(ref.path);
  }

  if (wanted.size === 0) return rows;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(SCAN_IMAGES_BUCKET)
    .createSignedUrls([...wanted], SIGNED_URL_TTL_SECONDS);

  const signedByPath = new Map<string, string>();
  if (error) {
    console.error("[signScanImageUrls] failed:", error.message);
  } else {
    for (const item of data ?? []) {
      // 개별 실패 시 item.error가 채워지고 signedUrl이 비어 있다.
      if (item.path && item.signedUrl)
        signedByPath.set(item.path, item.signedUrl);
    }
  }

  return rows.map((row) => {
    if (!row.image_url) return row;
    const ref = parseScanImageRef(row.image_url);
    // 우리 버킷이 아니면 손대지 않는다.
    if (ref.kind !== "bucket") return row;
    return { ...row, image_url: signedByPath.get(ref.path) ?? null };
  });
}
