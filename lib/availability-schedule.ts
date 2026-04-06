import { startOfDay } from "date-fns";

export type WeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DaySchedule = {
  enabled: boolean;
  start?: string;
  end?: string;
};

export type AvailabilitySchedule = Partial<Record<WeekdayKey, DaySchedule>>;

export const WEEKDAY_ORDER: { key: WeekdayKey; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

/** Local date → weekday key (matches saved JSON). */
export function weekdayKeyFromDate(d: Date): WeekdayKey {
  const n = d.getDay();
  const map: WeekdayKey[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[n] ?? "monday";
}

export function isWeekdayDisabledInSchedule(
  schedule: AvailabilitySchedule | null | undefined,
  d: Date,
): boolean {
  const key = weekdayKeyFromDate(d);
  const day = schedule?.[key];
  return day?.enabled === false;
}

/** Hours 8–20 as HH:mm strings (8AM–8PM). */
export const HOUR_OPTIONS: string[] = Array.from({ length: 13 }, (_, i) => {
  const h = 8 + i;
  return `${String(h).padStart(2, "0")}:00`;
});

export function formatHourLabel(hhmm: string): string {
  const [hStr] = hhmm.split(":");
  const h = Number(hStr);
  if (!Number.isFinite(h)) return hhmm;
  const am = h < 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${am ? "AM" : "PM"}`;
}

export function parseSchedule(raw: unknown): AvailabilitySchedule {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as AvailabilitySchedule;
}

export function defaultDaySchedule(): DaySchedule {
  return { enabled: true, start: "09:00", end: "17:00" };
}

export function emptyScheduleDefaults(): Record<WeekdayKey, DaySchedule> {
  const d = defaultDaySchedule();
  return {
    monday: { ...d },
    tuesday: { ...d },
    wednesday: { ...d },
    thursday: { ...d },
    friday: { ...d },
    saturday: { ...d },
    sunday: { ...d },
  };
}

export function mergeScheduleFromDb(raw: unknown): Record<WeekdayKey, DaySchedule> {
  const base = emptyScheduleDefaults();
  const parsed = parseSchedule(raw);
  for (const { key } of WEEKDAY_ORDER) {
    const incoming = parsed[key];
    if (!incoming) continue;
    base[key] = {
      enabled: incoming.enabled !== false,
      start: incoming.start ?? base[key].start,
      end: incoming.end ?? base[key].end,
    };
    if (base[key].enabled === false) {
      base[key] = { enabled: false };
    }
  }
  return base;
}

export function toJsonPayload(rows: Record<WeekdayKey, DaySchedule>): AvailabilitySchedule {
  const out: AvailabilitySchedule = {};
  for (const { key } of WEEKDAY_ORDER) {
    const r = rows[key];
    if (!r.enabled) {
      out[key] = { enabled: false };
    } else {
      out[key] = {
        enabled: true,
        start: r.start ?? "09:00",
        end: r.end ?? "17:00",
      };
    }
  }
  return out;
}

export function compareStartEnd(start: string, end: string): boolean {
  return start < end;
}

/** For calendar: past dates or agent-disabled weekdays. */
export function viewingDateDisabled(
  d: Date,
  schedule: AvailabilitySchedule | null | undefined,
  today: Date = new Date(),
): boolean {
  if (startOfDay(d) < startOfDay(today)) return true;
  return isWeekdayDisabledInSchedule(schedule, d);
}
