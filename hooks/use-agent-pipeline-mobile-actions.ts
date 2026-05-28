"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { PipelineLeadRow, PipelineStageId } from "@/components/dashboard/agent-pipeline-tab";
import {
  getNextPipelineStage,
  pipelineStageToastLabel,
} from "@/lib/agent-pipeline-card-menu";

type UndoEntry = {
  leadId: number;
  patch: Partial<PipelineLeadRow>;
};

type UseAgentPipelineMobileActionsArgs = {
  leadsAgentUserId: string;
  onPatchLead?: (leadId: number, patch: Partial<PipelineLeadRow>) => void;
  onRefresh: () => void | Promise<void>;
  onBeforeMoveToViewing?: (lead: PipelineLeadRow) => void;
};

export function useAgentPipelineMobileActions({
  leadsAgentUserId,
  onPatchLead,
  onRefresh,
  onBeforeMoveToViewing,
}: UseAgentPipelineMobileActionsArgs) {
  const undoTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const clearUndoTimer = useCallback((leadId: number) => {
    const t = undoTimersRef.current.get(leadId);
    if (t) clearTimeout(t);
    undoTimersRef.current.delete(leadId);
  }, []);

  const revertLeadStage = useCallback(
    async (leadId: number, prevSnapshot: Partial<PipelineLeadRow>) => {
      const prevStage = prevSnapshot.pipeline_stage;
      if (!prevStage) return false;
      onPatchLead?.(leadId, prevSnapshot);
      try {
        const res = await fetch("/api/agent/pipeline-set-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ leadId, pipeline_stage: prevStage }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { success?: boolean };
          error?: { message?: string };
        };
        const apiOk = res.ok && json.success === true && json.data?.success === true;
        if (!apiOk) {
          toast.error(json?.error?.message ?? "Could not undo move");
          return false;
        }
        return true;
      } catch {
        toast.error("Could not reach server. Check your connection.");
        return false;
      }
    },
    [onPatchLead],
  );

  const scheduleUndoToast = useCallback(
    (lead: PipelineLeadRow, prevSnapshot: Partial<PipelineLeadRow>, stageLabel: string) => {
      clearUndoTimer(lead.id);
      const toastId = toast.success(`Moved to ${stageLabel}`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            void revertLeadStage(lead.id, prevSnapshot).then((ok) => {
              if (ok) {
                toast.dismiss(toastId);
                toast.message("Change reverted");
              }
            });
          },
        },
      });
      const timer = setTimeout(() => {
        undoTimersRef.current.delete(lead.id);
      }, 5000);
      undoTimersRef.current.set(lead.id, timer);
    },
    [clearUndoTimer, revertLeadStage],
  );

  const moveLeadToStage = useCallback(
    async (lead: PipelineLeadRow, stage: PipelineStageId, opts?: { skipViewingGate?: boolean }) => {
      if (stage === "viewing" && lead.pipeline_stage !== "viewing" && !opts?.skipViewingGate) {
        onBeforeMoveToViewing?.(lead);
        return false;
      }

      if (lead.pipeline_stage === stage) return true;

      const prevSnapshot: Partial<PipelineLeadRow> = {
        pipeline_stage: lead.pipeline_stage,
        updated_at: lead.updated_at ?? null,
        closed_at: lead.closed_at ?? null,
        closed_date: lead.closed_date ?? null,
        closed_by: lead.closed_by ?? null,
        closure_confirmed_by_client: lead.closure_confirmed_by_client ?? null,
      };

      const nowIso = new Date().toISOString();
      const optimisticPatch: Partial<PipelineLeadRow> = {
        pipeline_stage: stage,
        updated_at: nowIso,
      };
      if (stage === "closed") {
        optimisticPatch.closed_at = nowIso;
        optimisticPatch.closed_date = nowIso.slice(0, 10);
        optimisticPatch.closed_by = leadsAgentUserId;
        optimisticPatch.closure_confirmed_by_client = null;
      }
      onPatchLead?.(lead.id, optimisticPatch);

      try {
        const res = await fetch("/api/agent/pipeline-set-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ leadId: lead.id, pipeline_stage: stage }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { success?: boolean };
          error?: { message?: string };
        };
        const apiOk = res.ok && json.success === true && json.data?.success === true;
        if (!apiOk) {
          toast.error(json?.error?.message ?? "Could not move deal");
          onPatchLead?.(lead.id, prevSnapshot);
          return false;
        }
        scheduleUndoToast(lead, prevSnapshot, pipelineStageToastLabel(stage));
        return true;
      } catch {
        toast.error("Could not reach server. Check your connection.");
        onPatchLead?.(lead.id, prevSnapshot);
        return false;
      }
    },
    [leadsAgentUserId, onBeforeMoveToViewing, onPatchLead, scheduleUndoToast],
  );

  const advanceLeadStage = useCallback(
    async (lead: PipelineLeadRow) => {
      const next = getNextPipelineStage(lead.pipeline_stage);
      if (!next) {
        toast.message("Already at the final stage");
        return false;
      }
      return moveLeadToStage(lead, next);
    },
    [moveLeadToStage],
  );

  const archiveLead = useCallback(
    async (lead: PipelineLeadRow) => {
      try {
        const res = await fetch("/api/agent/archive-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ lead_id: lead.id }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Could not archive");
          return false;
        }
        toast.success("Archived");
        await Promise.resolve(onRefresh());
        return true;
      } catch {
        toast.error("Could not reach server. Check your connection.");
        return false;
      }
    },
    [onRefresh],
  );

  const submitDecline = useCallback(
    async (lead: PipelineLeadRow, reasonKey: string) => {
      try {
        const res = await fetch("/api/agent/decline-deal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ lead_id: lead.id, reason_key: reasonKey }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Could not archive this deal");
          return false;
        }
        toast.success("Deal archived");
        await Promise.resolve(onRefresh());
        return true;
      } catch {
        toast.error("Could not reach server. Check your connection.");
        return false;
      }
    },
    [onRefresh],
  );

  const sendDocumentRequest = useCallback(
    async (
      lead: PipelineLeadRow,
      documentItems: { type: string; document_name?: string }[],
    ) => {
      try {
        const res = await fetch("/api/agent/request-client-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ lead_id: lead.id, document_items: documentItems }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Could not send request");
          return false;
        }
        toast.success("Document request sent");
        return true;
      } catch {
        toast.error("Could not reach server. Check your connection.");
        return false;
      }
    },
    [],
  );

  return {
    moveLeadToStage,
    advanceLeadStage,
    archiveLead,
    submitDecline,
    sendDocumentRequest,
  };
}
