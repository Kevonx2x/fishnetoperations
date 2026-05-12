import type { SupabaseClient } from "@supabase/supabase-js";

import { coerceLeadId } from "@/lib/viewings";

/** Matches `ReschedulePendingMeta` in `agent-pipeline-tab` (kept local to avoid circular imports). */
export type AgentPipelineReschedulePending = {
  viewingId: string;
  currentScheduledAt: string;
  requestedScheduledAt: string;
};

let viewingsRescheduleColumnHintLogged = false;

/**
 * Same rules as `KanbanDealCardImpl` in `agent-pipeline-tab.tsx`: a lead “needs attention” when the
 * overflow pulse would show (new lead, viewing/reschedule, unviewed uploaded docs, or DM unread).
 */
export function leadNeedsPipelineAttention(args: {
  deal: {
    new_lead_seen_at?: string | null;
    new_viewing_request_seen_at?: string | null;
    viewing_request_id?: string | null;
  };
  reschedulePending?: AgentPipelineReschedulePending | null;
  unviewedUploadedDocCount: number;
  messageUnreadCount: number;
}): boolean {
  const hasVr = Boolean(args.deal.viewing_request_id?.trim());
  const showVrMenuDot =
    (hasVr || Boolean(args.reschedulePending)) && !args.deal.new_viewing_request_seen_at;
  const showLeadMenuDot = !args.deal.new_lead_seen_at;
  const showMsgMenuDot = args.messageUnreadCount > 0;
  return (
    showLeadMenuDot || showVrMenuDot || args.unviewedUploadedDocCount > 0 || showMsgMenuDot
  );
}

export async function fetchUnviewedUploadedDocCountsByLeadId(
  supabase: SupabaseClient,
  leadIds: number[],
): Promise<Record<number, number>> {
  if (leadIds.length === 0) return {};
  const { data, error } = await supabase
    .from("deal_documents")
    .select("lead_id, status, viewed_by_agent_at")
    .in("lead_id", leadIds)
    .in("status", ["pending", "uploaded"]);
  if (error) {
    console.error("[agent-pipeline-attention] deal_documents badge query failed", {
      leadIds: leadIds.length,
      message: error.message,
    });
    return {};
  }
  const unviewedNext: Record<number, number> = {};
  for (const row of (data ?? []) as {
    lead_id: unknown;
    status: string | null;
    viewed_by_agent_at: string | null;
  }[]) {
    const lid = coerceLeadId(row.lead_id);
    if (lid == null) continue;
    const st = (row.status ?? "").trim().toLowerCase();
    if (st === "uploaded" && row.viewed_by_agent_at == null) {
      unviewedNext[lid] = (unviewedNext[lid] ?? 0) + 1;
    }
  }
  return unviewedNext;
}

export async function fetchReschedulePendingByLeadId(
  supabase: SupabaseClient,
  viewingStageLeadIds: number[],
): Promise<Record<number, AgentPipelineReschedulePending>> {
  if (viewingStageLeadIds.length === 0) return {};
  const { data: vwRows, error: vwErr } = await supabase
    .from("viewings")
    .select("id, lead_id, scheduled_at, reschedule_request_id")
    .in("lead_id", viewingStageLeadIds);
  if (vwErr) {
    const missingRescheduleColumn =
      vwErr.code === "42703" && String(vwErr.message ?? "").includes("reschedule_request_id");
    if (missingRescheduleColumn) {
      if (!viewingsRescheduleColumnHintLogged) {
        viewingsRescheduleColumnHintLogged = true;
        console.info(
          "[agent-pipeline-attention] Reschedule UI needs DB migration: run `supabase/migrations/20260502100000_viewings_reschedule_request.sql` (adds viewings.reschedule_request_id).",
        );
      }
    } else {
      console.warn("[agent-pipeline-attention] viewings reschedule fetch failed", vwErr);
    }
    return {};
  }
  if (!vwRows?.length) return {};
  const pendingIds = [
    ...new Set(
      (vwRows as { reschedule_request_id?: string | null }[])
        .map((r) => (r.reschedule_request_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (pendingIds.length === 0) return {};
  const { data: vrRows, error: vrErr } = await supabase
    .from("viewing_requests")
    .select("id, scheduled_at")
    .in("id", pendingIds);
  if (vrErr) {
    console.warn("[agent-pipeline-attention] viewing_requests reschedule fetch failed", vrErr);
    return {};
  }
  const vrMap = new Map(
    ((vrRows ?? []) as { id: string; scheduled_at: string }[]).map((r) => [String(r.id), String(r.scheduled_at)]),
  );
  const out: Record<number, AgentPipelineReschedulePending> = {};
  for (const row of vwRows as {
    id: string;
    lead_id: number | string;
    scheduled_at: string;
    reschedule_request_id: string | null;
  }[]) {
    const rid = String(row.reschedule_request_id ?? "").trim();
    if (!rid) continue;
    const reqAt = vrMap.get(rid);
    if (!reqAt) continue;
    const lid = typeof row.lead_id === "number" ? row.lead_id : Number(row.lead_id);
    if (!Number.isFinite(lid)) continue;
    out[lid] = {
      viewingId: String(row.id),
      currentScheduledAt: String(row.scheduled_at),
      requestedScheduledAt: reqAt,
    };
  }
  return out;
}
