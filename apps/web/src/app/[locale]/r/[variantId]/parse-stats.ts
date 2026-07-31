/**
 * 공유 링크의 variantId 세그먼트를 파싱한다.
 *
 * 통계를 URL에 담는 이유: gacha_roll_results는 RLS가 본인만 읽도록 막고 있어
 * 로그인하지 않은 OG 봇이 조회할 수 없다. 링크에 variantId만 있어서 누가 뽑았는지도
 * 알 수 없으므로, 값을 링크에 실어 보내는 것 외에 방법이 없다.
 *
 * 형식:
 *   /r/{uuid}                    — 통계 없음 (기존 링크, 계속 지원)
 *   /r/{uuid}-{시도횟수}-{보유수}  — 통계 포함
 *
 * 별도 경로 세그먼트를 쓰지 않는 이유: optional catch-all은 URL의 마지막이어야 해서
 * 그 아래에 opengraph-image를 둘 수 없다. UUID는 36자 고정이라 접미사를 안전하게 자른다.
 *
 * URL 값이라 위조할 수 있다. 자랑용 표시일 뿐 신뢰 경계가 아니며,
 * 권한 판단이나 저장에 절대 쓰지 않는다.
 */
export interface SharedStats {
  tries: number;
  owned: number;
}

export interface ParsedSlug {
  variantId: string | null;
  stats: SharedStats | null;
}

const UUID_LEN = 36;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 말도 안 되는 숫자가 카드 레이아웃을 깨지 않도록 상한을 둔다.
const MAX = 999_999;

export function parseSlug(slug: string): ParsedSlug {
  const id = slug.slice(0, UUID_LEN);
  if (!UUID_RE.test(id)) return { variantId: null, stats: null };

  const rest = slug.slice(UUID_LEN);
  if (!rest) return { variantId: id, stats: null };

  const m = /^-(\d{1,6})-(\d{1,6})$/.exec(rest);
  if (!m) return { variantId: id, stats: null };

  const tries = Number(m[1]);
  const owned = Number(m[2]);
  if (tries < 1 || owned < 1 || tries > MAX || owned > MAX) {
    return { variantId: id, stats: null };
  }
  // 뽑은 횟수가 전체 시도보다 많을 수는 없다.
  if (owned > tries) return { variantId: id, stats: null };

  return { variantId: id, stats: { tries, owned } };
}
