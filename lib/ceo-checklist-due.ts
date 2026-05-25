export const CEO_CHECKLIST_CADENCES = [
  "daily",
  "weekly_monday",
  "weekly_friday",
  "monthly",
  "quarterly",
  "once",
] as const;

export type CeoChecklistCadence = (typeof CEO_CHECKLIST_CADENCES)[number];

export type CeoDueStatus = "not_due" | "due_today" | "overdue";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeekday(d: Date, weekday: number): Date {
  const day = startOfLocalDay(d);
  const dow = day.getDay();
  const diff = dow >= weekday ? dow - weekday : dow + (7 - weekday);
  day.setDate(day.getDate() - diff);
  return day;
}

function calendarQuarter(d: Date): number {
  return Math.floor(d.getMonth() / 3);
}

export function isCeoChecklistDue(
  cadence: string,
  lastCompletedAt: string | null,
  now = new Date(),
): boolean {
  if (cadence === "once") return lastCompletedAt == null;

  const last = lastCompletedAt ? new Date(lastCompletedAt) : null;
  const todayStart = startOfLocalDay(now);

  switch (cadence) {
    case "daily":
      return !last || last < todayStart;
    case "weekly_monday": {
      const lastMon = startOfWeekday(now, 1);
      return !last || last < lastMon;
    }
    case "weekly_friday": {
      const lastFri = startOfWeekday(now, 5);
      return !last || last < lastFri;
    }
    case "monthly":
      return (
        !last ||
        last.getFullYear() !== now.getFullYear() ||
        last.getMonth() !== now.getMonth()
      );
    case "quarterly":
      return (
        !last ||
        last.getFullYear() !== now.getFullYear() ||
        calendarQuarter(last) !== calendarQuarter(now)
      );
    default:
      return false;
  }
}

/** Green / gold / red due indicator for checklist rows. */
export function ceoChecklistDueStatus(
  cadence: string,
  lastCompletedAt: string | null,
  now = new Date(),
): CeoDueStatus {
  if (cadence === "once") {
    return lastCompletedAt == null ? "due_today" : "not_due";
  }

  if (!isCeoChecklistDue(cadence, lastCompletedAt, now)) {
    return "not_due";
  }

  const last = lastCompletedAt ? new Date(lastCompletedAt) : null;
  const todayStart = startOfLocalDay(now);

  switch (cadence) {
    case "daily": {
      if (!last) return "overdue";
      const yesterday = new Date(todayStart);
      yesterday.setDate(yesterday.getDate() - 1);
      return last < yesterday ? "overdue" : "due_today";
    }
    case "weekly_monday":
      return now.getDay() === 1 ? "due_today" : "overdue";
    case "weekly_friday":
      return now.getDay() === 5 ? "due_today" : "overdue";
    case "monthly":
      return now.getDate() <= 7 ? "due_today" : "overdue";
    case "quarterly": {
      const monthInQ = now.getMonth() % 3;
      return monthInQ === 0 && now.getDate() <= 14 ? "due_today" : "overdue";
    }
    default:
      return "due_today";
  }
}

export function cadenceGroupLabel(cadence: string): string {
  switch (cadence) {
    case "daily":
      return "Daily";
    case "weekly_monday":
      return "Weekly (Monday)";
    case "weekly_friday":
      return "Weekly (Friday)";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "once":
      return "Once";
    default:
      return cadence;
  }
}

export const CADENCE_GROUP_ORDER: string[] = [
  "daily",
  "weekly_monday",
  "weekly_friday",
  "monthly",
  "quarterly",
  "once",
];
