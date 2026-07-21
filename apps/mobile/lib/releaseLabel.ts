import type { GachaProduct } from "@gacha-map/shared";

interface ReleaseLabelSpec {
  key: string;
  params?: Record<string, number>;
}

// release_start_date는 "YYYY-MM-DD" 형태의 plain date 문자열(RPC가 KST 기준으로
// 이미 확정한 값) — 별도 시간대 변환 없이 문자열 파싱만 하면 됨.
function parseMonthDay(dateStr: string): { month: number; day: number } {
  const [, monthStr, dayStr] = dateStr.split("-");
  return { month: parseInt(monthStr, 10), day: parseInt(dayStr, 10) };
}

export function getReleaseLabelSpec(
  item: GachaProduct,
): ReleaseLabelSpec | null {
  const precision = item.release_precision;
  if (!precision) return null;

  if (precision === "unknown") {
    return { key: "roll.releaseLabel.unknown" };
  }

  if (!item.release_start_date) return null;
  const { month, day } = parseMonthDay(item.release_start_date);

  switch (precision) {
    case "exact":
      return { key: "roll.releaseLabel.exact", params: { month, day } };
    case "week":
      return {
        key: "roll.releaseLabel.week",
        params: { month, week: Math.floor((day - 1) / 7) + 1 },
      };
    case "early":
      return { key: "roll.releaseLabel.early", params: { month } };
    case "mid":
      return { key: "roll.releaseLabel.mid", params: { month } };
    case "late":
      return { key: "roll.releaseLabel.late", params: { month } };
    case "month":
      return { key: "roll.releaseLabel.month", params: { month } };
    default:
      return null;
  }
}
