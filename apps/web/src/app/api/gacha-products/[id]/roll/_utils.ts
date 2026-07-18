export const DAILY_LIMIT = 9999;

function kstDate(offsetDays = 0): { y: number; m: string; d: string } {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() + offsetDays);
  return {
    y: kst.getFullYear(),
    m: String(kst.getMonth() + 1).padStart(2, "0"),
    d: String(kst.getDate()).padStart(2, "0"),
  };
}

export function todayKSTMidnight(): string {
  const { y, m, d } = kstDate(0);
  return `${y}-${m}-${d}T00:00:00+09:00`;
}

export function tomorrowKSTString(): string {
  const { y, m, d } = kstDate(1);
  return `${y}-${m}-${d}T00:00:00+09:00`;
}
