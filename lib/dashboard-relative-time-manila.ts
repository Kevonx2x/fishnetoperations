import { manilaCalendarAddDays, manilaDateStringFromInstant } from "@/lib/manila-datetime";

const MANILA = "Asia/Manila";

function manilaCalendarDiffDays(laterYmd: string, earlierYmd: string): number {
  const a = new Date(`${laterYmd}T12:00:00+08:00`).getTime();
  const b = new Date(`${earlierYmd}T12:00:00+08:00`).getTime();
  return Math.round((a - b) / 86400000);
}

/**
 * Activity row timestamps: Manila “yesterday”, compact minutes/hours, else short date.
 */
export function formatDashboardRelativeTimeManila(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const then = new Date(t);
  const diffMs = Date.now() - t;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;

  const nowYmd = manilaDateStringFromInstant(new Date());
  const thenYmd = manilaDateStringFromInstant(then);
  const yYesterday = manilaCalendarAddDays(nowYmd, -1);
  if (thenYmd === yYesterday) return "Yesterday";

  const calDiff = manilaCalendarDiffDays(nowYmd, thenYmd);
  if (calDiff > 1 && calDiff < 7) return `${calDiff} days ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: MANILA,
  }).format(then);
}
