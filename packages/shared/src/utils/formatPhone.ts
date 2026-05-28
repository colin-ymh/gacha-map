const MOBILE_PREFIXES = ["010", "011", "016", "017", "018", "019"];

export function formatKoreanPhone(value: string): string {
  if (value && !/^\d/.test(value)) return value;
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("02")) {
    const d = digits.slice(0, 10);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }

  if (MOBILE_PREFIXES.some((p) => digits.startsWith(p))) {
    const d = digits.slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }

  // 지역번호 (031, 032 등): 3-3-4
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
