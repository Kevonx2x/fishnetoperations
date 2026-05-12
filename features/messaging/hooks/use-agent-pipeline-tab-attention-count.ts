"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentPipelineReschedulePending } from "@/lib/agent-pipeline-attention";
import {
  fetchReschedulePendingByLeadId,
  fetchUnviewedUploadedDocCountsByLeadId,
  leadNeedsPipelineAttention,
} from "@/lib/agent-pipeline-attention";
import { coerceLeadId } from "@/lib/viewings";
import { useLeadStreamUnreadMap } from "@/features/messaging/hooks/use-lead-stream-unread-map";

export type AgentPipelineAttentionLead = {
  id: number;
  client_id?: string | null;
  new_lead_seen_at?: string | null;
  new_viewing_request_seen_at?: string | null;
  viewing_request_id?: string | null;
  pipeline_stage?: string | null;
};

/**
 * Count of active (non-archived) leads that would show the pipeline card “pulse” dot — same inputs as
 * the kanban card, so the sidebar badge never disagrees with the board.
 */
export function useAgentPipelineTabAttentionCount(
  supabase: SupabaseClient,
  leads: AgentPipelineAttentionLead[],
  streamAgentUserId: string | null,
): number {
  const leadPeers = useMemo(
    () => leads.map((l) => ({ id: l.id, client_id: l.client_id ?? null })),
    [leads],
  );
  const streamUnreadByLeadId = useLeadStreamUnreadMap(streamAgentUserId, leadPeers);

  const leadIdsKey = useMemo(
    () =>
      leads
        .map((l) => coerceLeadId(l.id))
        .filter((id): id is number => id != null)
        .sort((a, b) => a - b)
        .join(","),
    [leads],
  );

  const viewingStageLeadIdsKey = useMemo(
    () =>
      leads
        .filter((l) => String(l.pipeline_stage ?? "").trim().toLowerCase() === "viewing")
        .map((l) => coerceLeadId(l.id))
        .filter((id): id is number => id != null)
        .sort((a, b) => a - b)
        .join(","),
    [leads],
  );

  const [unviewedUploadedByLeadId, setUnviewedUploadedByLeadId] = useState<Record<number, number>>({});
  const [reschedulePendingByLeadId, setReschedulePendingByLeadId] = useState<
    Record<number, AgentPipelineReschedulePending>
  >({});

  useEffect(() => {
    const leadIds = leadIdsKey
      ? leadIdsKey.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
      : [];
    if (leadIds.length === 0) {
      setUnviewedUploadedByLeadId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchUnviewedUploadedDocCountsByLeadId(supabase, leadIds);
      if (!cancelled) setUnviewedUploadedByLeadId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [leadIdsKey, supabase]);

  useEffect(() => {
    const viewingLeadIds = viewingStageLeadIdsKey
      ? viewingStageLeadIdsKey.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
      : [];
    if (viewingLeadIds.length === 0) {
      setReschedulePendingByLeadId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchReschedulePendingByLeadId(supabase, viewingLeadIds);
      if (!cancelled) setReschedulePendingByLeadId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewingStageLeadIdsKey, supabase]);

  return useMemo(() => {
    let n = 0;
    for (const deal of leads) {
      const id = coerceLeadId(deal.id);
      if (id == null) continue;
      if (
        leadNeedsPipelineAttention({
          deal,
          reschedulePending: reschedulePendingByLeadId[id] ?? null,
          unviewedUploadedDocCount: unviewedUploadedByLeadId[id] ?? 0,
          messageUnreadCount: streamUnreadByLeadId[id] ?? 0,
        })
      ) {
        n += 1;
      }
    }
    return n;
  }, [leads, reschedulePendingByLeadId, streamUnreadByLeadId, unviewedUploadedByLeadId]);
}
