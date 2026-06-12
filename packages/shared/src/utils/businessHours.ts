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

const GOOGLE_DAY_KEYS: Record<number, DayKey> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const GOOGLE_TIME_RE = /^([01]\d|2[0-3])[0-5]\d$/;
const ALL_DAY_RE = /(24\s*시간|24\s*hours|open\s*24\s*hours)/i;
const CLOSED_RE = /(휴무|closed|영업\s*안함)/i;

export interface GoogleOpeningHoursData {
  open_now?: boolean;
  weekday_text?: string[];
  periods?: GoogleOpeningPeriod[];
}

export interface GoogleOpeningPeriod {
  open?: GooglePeriodPoint;
  close?: GooglePeriodPoint;
}

interface GooglePeriodPoint {
  day?: number;
  time?: string;
}

export type OpeningHoursInput =
  | string
  | BusinessHoursData
  | GoogleOpeningHoursData
  | null
  | undefined;

export type OpeningHoursKind =
  | "empty"
  | "business"
  | "google"
  | "text"
  | "invalid";

export type ParsedOpeningHours =
  | { kind: "empty" }
  | { kind: "business"; data: BusinessHoursData }
  | { kind: "google"; data: GoogleOpeningHoursData }
  | { kind: "text"; text: string }
  | { kind: "invalid"; reason: string };

export interface NormalizeOpeningHoursResult {
  kind: OpeningHoursKind;
  data: BusinessHoursData | null;
  warnings: string[];
}

export function isValidTime(t: string): boolean {
  return TIME_RE.test(t);
}

export function isValidSchedule(schedule: DaySchedule | null): boolean {
  if (schedule === null) return true;
  if (schedule.allDay === true) return true;
  return isValidTime(schedule.open ?? "") && isValidTime(schedule.close ?? "");
}

function isScheduleInputValid(s: DaySchedule | null | undefined): boolean {
  if (s === null || s === undefined) return true;
  if (s.allDay === true) return true;
  const open = s.open ?? "";
  const close = s.close ?? "";
  if (open.length === 5 && !isValidTime(open)) return false;
  if (close.length === 5 && !isValidTime(close)) return false;
  if (isValidTime(open) && isValidTime(close) && open >= close) return false;
  return true;
}

export function hasBusinessHoursErrors(
  data: BusinessHoursData | null,
): boolean {
  if (!data) return false;
  if (!isScheduleInputValid(data.default)) return true;
  if (data.overrides) {
    for (const day of DAY_KEYS) {
      if (day in data.overrides && !isScheduleInputValid(data.overrides[day]))
        return true;
    }
  }
  return false;
}

export function parseOpeningHoursKind(
  raw: OpeningHoursInput,
): ParsedOpeningHours {
  if (raw === null || raw === undefined) return { kind: "empty" };

  if (typeof raw === "object") {
    return parseOpeningHoursObject(raw);
  }

  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };

  const parsedJson = parseJsonString(trimmed);
  if (parsedJson !== null) {
    if (typeof parsedJson === "string") {
      const nested = parseOpeningHoursKind(parsedJson);
      return nested.kind === "empty"
        ? { kind: "text", text: parsedJson }
        : nested;
    }
    if (typeof parsedJson === "object") {
      return parseOpeningHoursObject(parsedJson);
    }
    return { kind: "invalid", reason: "opening_hours JSON is not an object" };
  }

  return { kind: "text", text: trimmed };
}

function parseOpeningHoursObject(value: object | null): ParsedOpeningHours {
  if (!value || Array.isArray(value)) {
    return { kind: "invalid", reason: "opening_hours must be an object" };
  }

  if ("default" in value) {
    return { kind: "business", data: value as BusinessHoursData };
  }

  if ("periods" in value || "weekday_text" in value) {
    return { kind: "google", data: value as GoogleOpeningHoursData };
  }

  return { kind: "invalid", reason: "unknown opening_hours object shape" };
}

function parseJsonString(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function normalizeOpeningHours(
  raw: OpeningHoursInput,
): NormalizeOpeningHoursResult {
  const parsed = parseOpeningHoursKind(raw);

  if (parsed.kind === "business") {
    return normalizeBusinessHoursData(parsed.data, parsed.kind);
  }

  if (parsed.kind === "google") {
    return normalizeGoogleOpeningHours(parsed.data);
  }

  return {
    kind: parsed.kind,
    data: null,
    warnings:
      parsed.kind === "invalid"
        ? [parsed.reason]
        : parsed.kind === "text"
          ? ["plain text opening_hours is not normalized"]
          : [],
  };
}

export function normalizeOpeningHoursForStorage(
  raw: OpeningHoursInput,
): BusinessHoursData | null {
  return normalizeOpeningHours(raw).data;
}

export function serializeOpeningHours(data: BusinessHoursData): string {
  return JSON.stringify(
    normalizeBusinessHoursData(data, "business").data ?? data,
  );
}

export function serializeBusinessHours(data: BusinessHoursData): string {
  return serializeOpeningHours(data);
}

export function serializeOpeningHoursForStorage(
  raw: OpeningHoursInput,
): string | null {
  const normalized = normalizeOpeningHoursForStorage(raw);
  return normalized ? JSON.stringify(normalized) : null;
}

export function parseBusinessHours(
  raw: OpeningHoursInput,
): BusinessHoursData | null {
  return normalizeOpeningHoursForStorage(raw);
}

function normalizeBusinessHoursData(
  data: BusinessHoursData,
  kind: OpeningHoursKind,
): NormalizeOpeningHoursResult {
  const warnings: string[] = [];
  const normalizedDefault = normalizeSchedule(
    data.default,
    "default",
    warnings,
  );
  const normalizedOverrides: Partial<Record<DayKey, DaySchedule | null>> = {};

  for (const day of DAY_KEYS) {
    if (data.overrides && day in data.overrides) {
      normalizedOverrides[day] = normalizeSchedule(
        data.overrides[day] ?? null,
        day,
        warnings,
      );
    }
  }

  const result: BusinessHoursData = { default: normalizedDefault };
  if (Object.keys(normalizedOverrides).length > 0) {
    result.overrides = normalizedOverrides;
  }

  return { kind, data: result, warnings };
}

function normalizeSchedule(
  schedule: DaySchedule | null | undefined,
  label: string,
  warnings: string[],
): DaySchedule | null {
  if (schedule === null || schedule === undefined) return null;
  if (schedule.allDay === true) return { allDay: true, open: "", close: "" };

  const open = schedule.open?.trim() ?? "";
  const close = schedule.close?.trim() ?? "";
  if (isValidTime(open) && isValidTime(close)) return { open, close };

  warnings.push(`${label}: invalid schedule dropped`);
  return null;
}

function normalizeGoogleOpeningHours(
  data: GoogleOpeningHoursData,
): NormalizeOpeningHoursResult {
  const warnings: string[] = [];
  const periodSchedules = schedulesFromGooglePeriods(
    data.periods ?? [],
    warnings,
  );
  const weekdaySchedules = schedulesFromWeekdayText(
    data.weekday_text ?? [],
    warnings,
  );
  const schedules = periodSchedules ?? weekdaySchedules;

  if (!schedules) {
    return {
      kind: "google",
      data: null,
      warnings: [...warnings, "google opening_hours could not be normalized"],
    };
  }

  return {
    kind: "google",
    data: buildBusinessHoursData(schedules),
    warnings,
  };
}

function schedulesFromGooglePeriods(
  periods: GoogleOpeningPeriod[],
  warnings: string[],
): Partial<Record<DayKey, DaySchedule | null>> | null {
  if (!Array.isArray(periods) || periods.length === 0) return null;

  const byDay: Partial<Record<DayKey, DaySchedule[]>> = {};

  for (const [index, period] of periods.entries()) {
    const day = period.open?.day;
    const time = period.open?.time;
    if (typeof day !== "number" || !GOOGLE_DAY_KEYS[day] || !time) {
      warnings.push(`period ${index}: missing open day/time`);
      continue;
    }

    const dayKey = GOOGLE_DAY_KEYS[day];
    const closeDay = period.close?.day;
    const closeTime = period.close?.time;

    if (isAllDayGooglePeriod(time, closeTime)) {
      byDay[dayKey] = [...(byDay[dayKey] ?? []), allDaySchedule()];
      continue;
    }

    const open = googleTimeToClock(time);
    const close = closeTime ? googleTimeToClock(closeTime) : null;
    if (!open || !close) {
      warnings.push(`period ${index}: invalid open/close time`);
      continue;
    }

    if (closeDay !== undefined && closeDay !== day) {
      warnings.push(`period ${index}: overnight hours truncated to ${dayKey}`);
    }

    byDay[dayKey] = [...(byDay[dayKey] ?? []), { open, close }];
  }

  const result: Partial<Record<DayKey, DaySchedule | null>> = {};
  let hasAny = false;

  for (const day of DAY_KEYS) {
    const schedules = byDay[day];
    if (!schedules || schedules.length === 0) continue;
    result[day] = mergeDaySchedules(day, schedules, warnings);
    hasAny = true;
  }

  return hasAny ? result : null;
}

function isAllDayGooglePeriod(openTime: string, closeTime?: string): boolean {
  return openTime === "0000" && (!closeTime || closeTime === "0000");
}

function googleTimeToClock(value: string): string | null {
  if (!GOOGLE_TIME_RE.test(value)) return null;
  return `${value.slice(0, 2)}:${value.slice(2)}`;
}

function mergeDaySchedules(
  day: DayKey,
  schedules: DaySchedule[],
  warnings: string[],
): DaySchedule {
  if (schedules.some((schedule) => schedule.allDay)) return allDaySchedule();

  const ranges = schedules
    .filter((schedule) => isValidSchedule(schedule))
    .map((schedule) => ({
      open: timeToMinutes(schedule.open ?? "00:00"),
      close: timeToMinutes(schedule.close ?? "00:00"),
    }));

  if (ranges.length === 0) return nullScheduleFallback(warnings, day);
  if (ranges.length > 1) {
    warnings.push(`${day}: multiple Google periods collapsed to one range`);
  }

  const open = Math.min(...ranges.map((range) => range.open));
  const close = Math.max(...ranges.map((range) => range.close));
  return { open: minutesToTime(open), close: minutesToTime(close) };
}

function nullScheduleFallback(warnings: string[], day: DayKey): DaySchedule {
  warnings.push(`${day}: invalid periods replaced with 24 hours`);
  return allDaySchedule();
}

function schedulesFromWeekdayText(
  weekdayText: string[],
  warnings: string[],
): Partial<Record<DayKey, DaySchedule | null>> | null {
  if (!Array.isArray(weekdayText) || weekdayText.length !== 7) return null;

  const result: Partial<Record<DayKey, DaySchedule | null>> = {};
  let hasAny = false;

  weekdayText.forEach((line, index) => {
    const day = DAY_KEYS[index];
    if (!day) return;
    const schedule = parseWeekdayTextSchedule(line);
    if (schedule !== undefined) {
      result[day] = schedule;
      hasAny = true;
    } else {
      warnings.push(`${day}: weekday_text could not be parsed`);
    }
  });

  return hasAny ? result : null;
}

function parseWeekdayTextSchedule(
  line: string,
): DaySchedule | null | undefined {
  const text = line.replace(/^[^:：]+[:：]\s*/, "").trim();
  if (!text) return undefined;
  if (ALL_DAY_RE.test(text)) return allDaySchedule();
  if (CLOSED_RE.test(text)) return null;

  const times = extractTimes(text);
  if (times.length < 2) return undefined;

  return { open: times[0]!, close: times[times.length - 1]! };
}

function extractTimes(text: string): string[] {
  const matches = text.matchAll(
    /(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})(?::|시\s*)?(\d{2})?/g,
  );
  const times: string[] = [];

  for (const match of matches) {
    const hour = Number(match[2]);
    const minute = match[3] ? Number(match[3]) : 0;
    const meridiem = match[1]?.toLowerCase();
    const converted = convertHour(hour, minute, meridiem);
    if (converted) times.push(converted);
  }

  return times;
}

function convertHour(
  hour: number,
  minute: number,
  meridiem: string | undefined,
): string | null {
  if (minute < 0 || minute > 59) return null;

  let normalizedHour = hour;
  if (meridiem === "오후" || meridiem === "pm") {
    normalizedHour = hour === 12 ? 12 : hour + 12;
  } else if (meridiem === "오전" || meridiem === "am") {
    normalizedHour = hour === 12 ? 0 : hour;
  }

  if (normalizedHour < 0 || normalizedHour > 23) return null;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )}`;
}

function buildBusinessHoursData(
  schedules: Partial<Record<DayKey, DaySchedule | null>>,
): BusinessHoursData {
  const daySchedules = DAY_KEYS.map((day) => schedules[day] ?? null);
  const defaultKey = chooseDefaultScheduleKey(daySchedules);
  const defaultSchedule = scheduleFromKey(defaultKey);
  const overrides: Partial<Record<DayKey, DaySchedule | null>> = {};

  DAY_KEYS.forEach((day, index) => {
    const schedule = daySchedules[index] ?? null;
    if (scheduleKey(schedule) !== defaultKey) {
      overrides[day] = cloneSchedule(schedule);
    }
  });

  const result: BusinessHoursData = { default: defaultSchedule };
  if (Object.keys(overrides).length > 0) result.overrides = overrides;
  return result;
}

function chooseDefaultScheduleKey(
  schedules: Array<DaySchedule | null>,
): string {
  const counts = new Map<string, number>();
  for (const schedule of schedules) {
    const key = scheduleKey(schedule);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (a[0] === "closed") return 1;
    if (b[0] === "closed") return -1;
    return a[0].localeCompare(b[0]);
  })[0]![0];
}

function scheduleKey(schedule: DaySchedule | null): string {
  if (!schedule) return "closed";
  if (schedule.allDay) return "allDay";
  return `${schedule.open ?? ""}-${schedule.close ?? ""}`;
}

function scheduleFromKey(key: string): DaySchedule | null {
  if (key === "closed") return null;
  if (key === "allDay") return allDaySchedule();
  const [open, close] = key.split("-");
  return { open, close };
}

function cloneSchedule(schedule: DaySchedule | null): DaySchedule | null {
  if (!schedule) return null;
  if (schedule.allDay) return allDaySchedule();
  return { open: schedule.open, close: schedule.close };
}

function allDaySchedule(): DaySchedule {
  return { allDay: true, open: "", close: "" };
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatSchedule(s: DaySchedule | null): string {
  if (!s) return "휴무";
  if (s.allDay) return "24시간";
  return `${s.open ?? ""}~${s.close ?? ""}`;
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

  const entries: [string, string][] = DAY_KEYS.map((key) => {
    const hasOverride = data.overrides != null && key in data.overrides;
    const schedule = hasOverride
      ? (data.overrides![key] ?? null)
      : data.default;
    return [DAY_LABELS[key], formatSchedule(schedule)];
  });

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

function jsGetDayToDayKeyIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export function getTodayHoursText(raw: OpeningHoursInput): string {
  const data = normalizeOpeningHoursForStorage(raw);
  if (!data) return "";

  const key = DAY_KEYS[jsGetDayToDayKeyIndex(new Date().getDay())];
  const hasOverride = data.overrides != null && key in data.overrides;
  const schedule = hasOverride ? (data.overrides![key] ?? null) : data.default;
  return formatSchedule(schedule);
}

export function formatOpeningHoursDisplay(raw: OpeningHoursInput): string {
  const normalized = normalizeOpeningHoursForStorage(raw);
  return normalized ? formatBusinessHoursDisplay(normalized) : "";
}
