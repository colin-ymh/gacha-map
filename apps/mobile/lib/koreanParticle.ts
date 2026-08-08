/**
 * 앞 단어의 받침에 따라 목적격 조사(을/를)를 고른다.
 *
 * 품목명이 한글·일본어·영문이 섞여 들어오므로, 판별 가능한 경우에만 정확히
 * 고르고 나머지는 기본값으로 떨어뜨린다. 조사가 틀려도 문장은 읽히지만,
 * 한글 이름에서 "제크-아인를"처럼 눈에 띄는 오류는 막는다.
 */
export function objectParticle(word: string | null | undefined): "을" | "를" {
  const last = (word ?? "").trim().slice(-1);
  if (!last) return "를";

  const code = last.charCodeAt(0);

  // 한글 음절 — 종성이 있으면 "을"
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 === 0 ? "를" : "을";
  }

  // 숫자 — 읽었을 때의 받침 기준 (영/일/삼/육/칠/팔에 받침이 있다)
  if (last >= "0" && last <= "9") {
    return "013678".includes(last) ? "을" : "를";
  }

  // 그 외(영문·가나 등)는 발음 기준이라 신뢰할 수 없어 기본값을 쓴다.
  return "를";
}
