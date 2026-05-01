const MANILA = "Asia/Manila";

/** `YYYY-MM-DD` in Asia/Manila for a given instant. */
export function manilaDateStringFromInstant(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/** Add whole calendar days in Philippines (no DST). `ymd` must be `YYYY-MM-DD`. */
export function manilaCalendarAddDays(ymd: string, deltaDays: number): string {
  const ms = new Date(`${ymd}T12:00:00+08:00`).getTime() + deltaDays * 86400000;
  return manilaDateStringFromInstant(new Date(ms));
}

export function manilaWeekdayShortFromInstant(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: MANILA }).format(d);
}

/** Weekday for a Manila calendar day given as `YYYY-MM-DD`. */
export function manilaWeekdayShortFromYmd(ymd: string): string {
  return manilaWeekdayShortFromInstant(new Date(`${ymd}T12:00:00+08:00`));
}

export function manilaMonthDayLabelFromInstant(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: MANILA,
  }).format(d);
}

export function manilaTimeLabel12hFromInstant(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** `HH:mm` (24h) in Asia/Manila for a given instant. */
export function manilaTimeStringFromInstant(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

/** Build timestamptz ISO for storage: user date + time interpreted as Philippines (+08:00). */
export function manilaLocalDateTimeToOffsetIso(dateYmd: string, timeHm: string): string {
  const t = timeHm.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new Error("Invalid time");
  const hh = String(Number(m[1])).padStart(2, "0");
  const mm = m[2];
  if (Number(m[1]) > 23 || Number(mm) > 59) throw new Error("Invalid time");
  return `${dateYmd}T${hh}:${mm}:00+08:00`;
}

/** Normalize user `H:mm`, `HH:mm`, or `HH:mm:ss` (from some browsers) to `HH:mm`, or return null. */
export function normalizeTimeHmForInput(raw: string): string | null {
  const t = raw.trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

const MANILA_SHORT_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** 0 = Sunday … 6 = Saturday for a Manila calendar day `YYYY-MM-DD`. */
export function manilaDowIndexFromYmd(ymd: string): number {
  const w = manilaWeekdayShortFromYmd(ymd);
  return MANILA_SHORT_DOW[w] ?? 0;
}

/** Manila `YYYY-MM-DD` of the Sunday that starts the week containing `ymd`. */
export function manilaStartOfWeekSundayYmd(ymd: string): string {
  return manilaCalendarAddDays(ymd, -manilaDowIndexFromYmd(ymd));
}

export function manilaDayOfMonthFromYmd(ymd: string): number {
  const n = Number(ymd.slice(8, 10));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Minutes since midnight in Manila for this instant (for calendar layout). */
export function manilaMinutesSinceMidnightFromInstant(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/** e.g. "May 2026" for a Manila calendar day. */
export function manilaMonthYearFromYmd(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: MANILA,
  }).format(new Date(`${ymd}T12:00:00+08:00`));
}

/** Inclusive 7-day week label in Manila, starting `weekStartYmd` (Sunday of that week). */
export function manilaWeekRangeLabel(weekStartYmd: string): string {
  const weekEndYmd = manilaCalendarAddDays(weekStartYmd, 6);
  const startD = new Date(`${weekStartYmd}T12:00:00+08:00`);
  const endD = new Date(`${weekEndYmd}T12:00:00+08:00`);

  const y1 = weekStartYmd.slice(0, 4);
  const y2 = weekEndYmd.slice(0, 4);
  const m1 = weekStartYmd.slice(5, 7);
  const m2 = weekEndYmd.slice(5, 7);

  const dayNum = (d: Date) =>
    Number(
      new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: MANILA }).format(d),
    );

  if (y1 !== y2) {
    const left = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: MANILA,
    }).format(startD);
    const right = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: MANILA,
    }).format(endD);
    return `${left} – ${right}`;
  }

  if (m1 === m2) {
    const longMonth = new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: MANILA,
    }).format(startD);
    const dStart = dayNum(startD);
    const dEnd = dayNum(endD);
    const year = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: MANILA,
    }).format(startD);
    return `${longMonth} ${dStart} – ${dEnd}, ${year}`;
  }

  const left = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: MANILA,
  }).format(startD);
  const right = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: MANILA,
  }).format(endD);
  return `${left} – ${right}`;
}
