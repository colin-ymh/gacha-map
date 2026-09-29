type GachaNameFields = {
  name_ko?: string | null;
  name_ja?: string | null;
  name?: string | null;
};

const FALLBACK_NAME = "번역 준비중인 상품";

/**
 * name_ko가 비어있으면 name_ja/name(원문 일본어)을 그대로 노출하지 않고
 * 고정 플레이스홀더로 대체한다. 컬렉터 파이프라인 지연/실패 시 안전망.
 */
export function getGachaDisplayName(item: GachaNameFields, fallback?: string): string {
  const ko = item.name_ko?.trim();
  return ko ? ko : (fallback ?? FALLBACK_NAME);
}
