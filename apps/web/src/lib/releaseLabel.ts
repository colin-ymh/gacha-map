import type { GachaProduct } from "@/types";

interface ReleaseLabelSpec {
  key: string;
  params?: Record<string, number>;
}

// release_start_date는 "YYYY-MM-DD" 형태의 plain date 문자열(collector가 KST 기준으로
// 이미 확정한 값) — 별도 시간대 변환 없이 문자열 파싱만 하면 됨.
function parseYearMonthDay(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
  };
}

export function getReleaseLabelSpec(
  item: Pick<GachaProduct, "release_precision" | "release_start_date">,
): ReleaseLabelSpec | null {
  const precision = item.release_precision;
  if (!precision) return null;

  if (precision === "unknown") {
    return { key: "releaseLabel.unknown" };
  }

  if (!item.release_start_date) return null;
  const { year, month, day } = parseYearMonthDay(item.release_start_date);

  switch (precision) {
    case "exact":
      return { key: "releaseLabel.exact", params: { year, month, day } };
    case "week":
      return {
        key: "releaseLabel.week",
        params: { year, month, week: Math.floor((day - 1) / 7) + 1 },
      };
    case "early":
      return { key: "releaseLabel.early", params: { year, month } };
    case "mid":
      return { key: "releaseLabel.mid", params: { year, month } };
    case "late":
      return { key: "releaseLabel.late", params: { year, month } };
    case "month":
      return { key: "releaseLabel.month", params: { year, month } };
    default:
      return null;
  }
}
