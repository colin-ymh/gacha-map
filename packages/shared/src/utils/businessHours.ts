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

const DAY_LABELS: Record<DayKey, string> = {
  mon: "월",
  tue: "화",
  wed: "수",
  thu: "목",
  fri: "금",
  sat: "토",
  sun: "일",
};

export function formatBusinessHoursDisplay(
  data: BusinessHoursData | null,
): string {
  if (!data) return "";

  // Build effective schedule for each day
  const entries: [string, string][] = DAY_KEYS.map((key) => {
    const hasOverride = data.overrides != null && key in data.overrides;
    const schedule = hasOverride
      ? (data.overrides![key] ?? null)
      : data.default;
    return [DAY_LABELS[key], formatSchedule(schedule)];
  });

  // Group consecutive days with the same schedule string
  const groups: { days: string[]; schedule: string }[] = [];
  for (const [day, sched] of entries) {
    const last = groups[groups.length - 1];
    if (last && last.schedule === sched) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], schedule: sched });
    }
  }

  return groups
    .map(({ days, schedule }) => {
      const dayStr =
        days.length > 1 ? `${days[0]}~${days[days.length - 1]}` : days[0];
      return `${dayStr} ${schedule}`;
    })
    .join("\n");
}
