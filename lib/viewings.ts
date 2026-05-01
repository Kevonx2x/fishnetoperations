import type { SupabaseClient } from "@supabase/supabase-js";
import {
  manilaDateStringFromInstant,
  manilaMonthDayLabelFromInstant,
  manilaTimeLabel12hFromInstant,
  manilaWeekdayShortFromInstant,
} from "@/lib/manila-datetime";

/** PostgREST may return bigint / FK columns as string; normalize for maps and `.in()`. */
export function coerceLeadId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface ParsedViewing {
  id: string;
  leadId: number;
  /** Original `scheduled_at` string from the API (stable round-trip). */
  scheduledAtRaw: string;
  /** Instant in the runtime’s local timezone (from `new Date(scheduled_at)`). */
  scheduledAt: Date;
  dateKey: string;
  timeLabel: string;
  dayLabel: string;
  fullDateLabel: string;
  status: string;
  propertyName: string;
  clientName: string;
}

function normalizeViewingStatus(raw: string | null | undefined): string {
  const s = String(raw ?? "scheduled").toLowerCase();
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  return "scheduled";
}

export function parseViewing(raw: {
  id: string | number;
  lead_id: number | string;
  scheduled_at: string;
  status?: string | null;
  propertyName?: string;
  clientName?: string;
}): ParsedViewing {
  const leadId = coerceLeadId(raw.lead_id);
  if (leadId == null) {
    throw new Error("parseViewing: invalid lead_id");
  }

  const scheduledAtRaw = String(raw.scheduled_at ?? "");
  const d = new Date(scheduledAtRaw);

  /** Calendar day / labels in Asia/Manila so they match stored `+08:00` viewings and the sidebar strip. */
  const dateKey = manilaDateStringFromInstant(d);
  const timeLabel = manilaTimeLabel12hFromInstant(d);
  const dayLabel = manilaWeekdayShortFromInstant(d);
  const fullDateLabel = manilaMonthDayLabelFromInstant(d);

  return {
    id: String(raw.id),
    leadId,
    scheduledAtRaw,
    scheduledAt: d,
    dateKey,
    timeLabel,
    dayLabel,
    fullDateLabel,
    status: normalizeViewingStatus(raw.status),
    propertyName: raw.propertyName?.trim() || "Unknown",
    clientName: raw.clientName?.trim() || "Unknown",
  };
}

export type FetchAgentViewingsOptions = {
  /** When true, excludes rows where status is `cancelled` (matches sidebar / pipeline). */
  excludeCancelled?: boolean;
  /** Optional cap on rows returned (after ordering). */
  limit?: number;
};

export async function fetchAgentViewings(
  supabase: SupabaseClient,
  agentId: string,
  rangeStart?: Date,
  rangeEnd?: Date,
  options?: FetchAgentViewingsOptions,
): Promise<ParsedViewing[]> {
  const excludeCancelled = options?.excludeCancelled ?? false;

  if (!agentId.trim()) return [];

  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, client_id, property_id")
    .eq("agent_id", agentId)
    .eq("pipeline_stage", "viewing")
    .eq("archived_by_client", false);

  if (leadsErr || !leads?.length) return [];

  const leadIds = (leads as { id: unknown }[])
    .map((l) => coerceLeadId(l.id))
    .filter((id): id is number => id != null);
  if (!leadIds.length) return [];

  let query = supabase
    .from("viewings")
    .select("id, lead_id, scheduled_at, status")
    .in("lead_id", leadIds)
    .order("scheduled_at", { ascending: true });

  if (rangeStart) query = query.gte("scheduled_at", rangeStart.toISOString());
  if (rangeEnd) query = query.lt("scheduled_at", rangeEnd.toISOString());
  if (excludeCancelled) query = query.neq("status", "cancelled");
  const lim = options?.limit;
  if (typeof lim === "number" && Number.isFinite(lim) && lim > 0) query = query.limit(lim);

  const { data: viewings, error: viewingsErr } = await query;
  if (viewingsErr || !viewings?.length) return [];

  const propertyIds = [
    ...new Set(
      (leads as { property_id: string | null }[])
        .map((l) => l.property_id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  ];
  const clientIds = [
    ...new Set(
      (leads as { client_id: string | null }[])
        .map((l) => l.client_id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  ];

  const { data: properties } = propertyIds.length
    ? await supabase.from("properties").select("id, name").in("id", propertyIds)
    : { data: [] as { id: string; name: string | null }[] | null };

  const { data: clients } = clientIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", clientIds)
    : { data: [] as { id: string; full_name: string | null }[] | null };

  const propMap = Object.fromEntries(
    ((properties ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name]),
  );
  const clientMap = Object.fromEntries(
    ((clients ?? []) as { id: string; full_name: string | null }[]).map((c) => [c.id, c.full_name]),
  );
  const leadMap = new Map<number, { property_id: string | null; client_id: string | null }>();
  for (const l of leads as { id: unknown; property_id: string | null; client_id: string | null }[]) {
    const id = coerceLeadId(l.id);
    if (id != null) leadMap.set(id, l);
  }

  const rows = viewings as { id: number | string; lead_id: unknown; scheduled_at: string; status: string | null }[];
  const parsed: ParsedViewing[] = [];
  for (const v of rows) {
    const lid = coerceLeadId(v.lead_id);
    if (lid == null || !v.scheduled_at) continue;
    const lead = leadMap.get(lid);
    try {
      parsed.push(
        parseViewing({
          id: v.id,
          lead_id: lid,
          scheduled_at: v.scheduled_at,
          status: v.status,
          propertyName: (lead?.property_id ? propMap[lead.property_id] : null) ?? undefined,
          clientName: (lead?.client_id ? clientMap[lead.client_id] : null) ?? undefined,
        }),
      );
    } catch {
      /* skip malformed row */
    }
  }
  return parsed;
}
