import type { SupabaseClient } from "@supabase/supabase-js";
import { manilaHourNumericFromInstant } from "@/lib/manila-datetime";

/**
 * Overlap uses half-open intervals `[start, end)` where `end = scheduled + slot + buffer`.
 * Leading buffer before `scheduled_at` is not applied to existing rows so spacing matches QA
 * (e.g. 2:00 PM with 45m slot + 60m buffer frees before 4:00 PM starts).
 */

/** Busy window: viewing from `scheduled_at` through slot + trailing buffer (PH calendar spacing). */
export const DEFAULT_VIEWING_SLOT_MINUTES = 45;
export const DEFAULT_VIEWING_BUFFER_MINUTES = 60;
export const DEFAULT_VIEWING_DAY_START_HOUR = 9;
export const DEFAULT_VIEWING_DAY_END_HOUR = 19;

export type ViewingSlotAgentSettings = {
  viewing_slot_minutes: number;
  viewing_buffer_minutes: number;
  viewing_day_start_hour: number;
  viewing_day_end_hour: number;
};

const TERMINAL_VIEWING_STATUSES = new Set(["cancelled", "completed", "no_show"]);

export function coerceViewingSlotAgentSettings(row: {
  viewing_slot_minutes?: number | null;
  viewing_buffer_minutes?: number | null;
  viewing_day_start_hour?: number | null;
  viewing_day_end_hour?: number | null;
} | null): ViewingSlotAgentSettings {
  const slot = row?.viewing_slot_minutes;
  const buf = row?.viewing_buffer_minutes;
  const sh = row?.viewing_day_start_hour;
  const eh = row?.viewing_day_end_hour;
  const out = {
    viewing_slot_minutes:
      typeof slot === "number" && Number.isFinite(slot) && [30, 45, 60, 90].includes(slot)
        ? slot
        : DEFAULT_VIEWING_SLOT_MINUTES,
    viewing_buffer_minutes:
      typeof buf === "number" && Number.isFinite(buf) && [0, 30, 60, 120].includes(buf)
        ? buf
        : DEFAULT_VIEWING_BUFFER_MINUTES,
    viewing_day_start_hour:
      typeof sh === "number" && Number.isFinite(sh) && sh >= 6 && sh <= 12 ? sh : DEFAULT_VIEWING_DAY_START_HOUR,
    viewing_day_end_hour:
      typeof eh === "number" && Number.isFinite(eh) && eh >= 16 && eh <= 22 ? eh : DEFAULT_VIEWING_DAY_END_HOUR,
  };
  if (out.viewing_day_end_hour <= out.viewing_day_start_hour) {
    out.viewing_day_end_hour = DEFAULT_VIEWING_DAY_END_HOUR;
  }
  return out;
}

function formatHourAmManila(hour24: number): string {
  const d = new Date(`2000-01-01T${String(hour24).padStart(2, "0")}:00:00+08:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Manila clock hour (0–23) on `scheduled_at` instant. */
export function manilaHourFromScheduledIso(scheduledAtIso: string): number {
  return manilaHourNumericFromInstant(new Date(scheduledAtIso));
}

export function validateViewingStartManilaBusinessHours(
  scheduledAtIso: string,
  settings: ViewingSlotAgentSettings,
): { ok: true } | { ok: false; message: string } {
  const d = new Date(scheduledAtIso);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, message: "Invalid viewing time." };
  }
  const hour = manilaHourFromScheduledIso(scheduledAtIso);
  if (hour < settings.viewing_day_start_hour) {
    return {
      ok: false,
      message: `Viewings can’t start before ${formatHourAmManila(settings.viewing_day_start_hour)}. Please pick a later time.`,
    };
  }
  if (hour >= settings.viewing_day_end_hour) {
    return {
      ok: false,
      message: `Viewings can’t start at or after ${formatHourAmManila(settings.viewing_day_end_hour)}. Please pick an earlier time.`,
    };
  }
  return { ok: true };
}

/** End timestamp (exclusive) of busy period: start + slot + buffer. */
function viewingBusyEndMs(scheduledMs: number, slotMinutes: number, bufferMinutes: number): number {
  return scheduledMs + slotMinutes * 60_000 + bufferMinutes * 60_000;
}

function viewingIntervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export type ViewingSlotConflict =
  | { ok: true }
  | { ok: false; reason: "outside_hours"; message: string; status: 400 }
  | { ok: false; reason: "overlap"; status: 409; viewingId: string; scheduledAt: string };

/**
 * Ensures proposed time is within Manila business hours and does not overlap another active viewing
 * for the same calendar owner (`agent_id` or `broker_id` on leads).
 */
export async function assertViewingSlotAvailable(
  admin: SupabaseClient,
  args: {
    ownerUserId: string;
    scheduledAtIso: string;
    settings: ViewingSlotAgentSettings;
    /** When updating this viewing, ignore it for overlap. */
    excludeViewingId?: string | null;
  },
): Promise<ViewingSlotConflict> {
  const scheduled = new Date(args.scheduledAtIso);
  const pMs = scheduled.getTime();
  if (Number.isNaN(pMs)) {
    return { ok: false, reason: "outside_hours", message: "Invalid viewing time.", status: 400 };
  }

  const hours = validateViewingStartManilaBusinessHours(args.scheduledAtIso, args.settings);
  if (!hours.ok) {
    return { ok: false, reason: "outside_hours", message: hours.message, status: 400 };
  }

  const slot = args.settings.viewing_slot_minutes;
  const buf = args.settings.viewing_buffer_minutes;
  const pStart = pMs;
  const pEnd = viewingBusyEndMs(pMs, slot, buf);

  const { data: leadRows, error: leadErr } = await admin
    .from("leads")
    .select("id")
    .or(`agent_id.eq.${args.ownerUserId},broker_id.eq.${args.ownerUserId}`);
  if (leadErr) {
    console.error("[viewing-slot-conflict] leads fetch failed", leadErr);
    return {
      ok: false,
      reason: "outside_hours",
      message: "Could not verify availability. Try again.",
      status: 400,
    };
  }

  const leadIds = ((leadRows ?? []) as { id: number }[])
    .map((r) => r.id)
    .filter((id) => Number.isFinite(id));
  if (leadIds.length === 0) return { ok: true };

  const { data: viewRows, error: vErr } = await admin
    .from("viewings")
    .select("id, scheduled_at, status")
    .in("lead_id", leadIds);
  if (vErr) {
    console.error("[viewing-slot-conflict] viewings fetch failed", vErr);
    return {
      ok: false,
      reason: "outside_hours",
      message: "Could not verify availability. Try again.",
      status: 400,
    };
  }

  for (const raw of viewRows ?? []) {
    const row = raw as { id: string; scheduled_at: string; status?: string | null };
    const id = String(row.id ?? "").trim();
    if (!id || (args.excludeViewingId && id === args.excludeViewingId)) continue;
    const st = String(row.status ?? "").toLowerCase();
    if (TERMINAL_VIEWING_STATUSES.has(st)) continue;

    const eMs = new Date(String(row.scheduled_at)).getTime();
    if (Number.isNaN(eMs)) continue;
    const eEnd = viewingBusyEndMs(eMs, slot, buf);

    if (viewingIntervalsOverlap(pStart, pEnd, eMs, eEnd)) {
      return {
        ok: false,
        reason: "overlap",
        status: 409,
        viewingId: id,
        scheduledAt: String(row.scheduled_at),
      };
    }
  }

  return { ok: true };
}

export async function fetchAgentViewingSlotSettings(
  admin: SupabaseClient,
  agentUserId: string,
): Promise<ViewingSlotAgentSettings> {
  const { data, error } = await admin
    .from("agents")
    .select("viewing_slot_minutes, viewing_buffer_minutes, viewing_day_start_hour, viewing_day_end_hour")
    .eq("user_id", agentUserId)
    .maybeSingle();
  if (error) {
    console.warn("[viewing-slot-conflict] agents settings fetch failed", error);
  }
  return coerceViewingSlotAgentSettings((data as Record<string, unknown> | null) ?? null);
}
