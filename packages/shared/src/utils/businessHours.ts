import type { BusinessHoursData, DayKey, DaySchedule } from "../types";

export const DAY_KEYS: DayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(t: string): boolean {
  return TIME_RE.test(t);
}

export function parseBusinessHours(
  raw: string | null | undefined,
): BusinessHoursData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "default" in parsed) {
      return parsed as BusinessHoursData;
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeBusinessHours(data: BusinessHoursData): string {
  return JSON.stringify(data);
}

export function formatSchedule(s: DaySchedule | null): string {
  if (!s) return "휴무";
  return `${s.open}~${s.close}`;
}

export function formatBusinessHoursDisplay(
  data: BusinessHoursData | null,
): string {
  if (!data) return "";

  const parts: string[] = [];

  const defaultStr = formatSchedule(data.default);
  parts.push(`기본: ${defaultStr}`);

  if (data.overrides) {
    const dayLabels: Record<DayKey, string> = {
      mon: "월",
      tue: "화",
      wed: "수",
      thu: "목",
      fri: "금",
      sat: "토",
      sun: "일",
    };
    for (const key of DAY_KEYS) {
      if (key in data.overrides) {
        const val = data.overrides[key];
        parts.push(`${dayLabels[key]}: ${formatSchedule(val ?? null)}`);
      }
    }
  }

  return parts.join(" / ");
}
