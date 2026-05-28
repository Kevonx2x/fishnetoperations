"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ArrowRightCircle,
  CircleCheck,
  FileText,
  MessageSquare,
  X,
} from "lucide-react";
import { PIPELINE_STAGES, type PipelineLeadRow, type PipelineStageId } from "@/components/dashboard/agent-pipeline-tab";
import {
  getAgentPipelineCardMenuKeys,
  pipelineMoveToStageLabel,
  type AgentPipelineCardMenuKey,
} from "@/lib/agent-pipeline-card-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ActionRow = {
  key: AgentPipelineCardMenuKey;
  label: string;
  icon: ReactNode;
  tone?: "default" | "sage" | "danger";
  onClick: () => void;
};

type Props = {
  deal: PipelineLeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessages: (deal: PipelineLeadRow) => void;
  onRequestDocuments: (deal: PipelineLeadRow) => void;
  onMarkWon: (deal: PipelineLeadRow) => void;
  onMarkLost: (deal: PipelineLeadRow) => void;
  onArchive: (deal: PipelineLeadRow) => void;
  onDeclineArchive: (deal: PipelineLeadRow) => void;
  onMoveToStage: (deal: PipelineLeadRow, stage: PipelineStageId) => void;
};

export function PipelineMobileActionSheet({
  deal,
  open,
  onOpenChange,
  onMessages,
  onRequestDocuments,
  onMarkWon,
  onMarkLost,
  onArchive,
  onDeclineArchive,
  onMoveToStage,
}: Props) {
  const [movePickerOpen, setMovePickerOpen] = useState(false);

  const menuKeys = useMemo(
    () => (deal ? getAgentPipelineCardMenuKeys(String(deal.pipeline_stage)) : new Set()),
    [deal],
  );

  const otherStages = useMemo(() => {
    if (!deal) return [];
    return PIPELINE_STAGES.filter((s) => s.id !== deal.pipeline_stage);
  }, [deal]);

  const rows: ActionRow[] = useMemo(() => {
    if (!deal) return [];
    const list: ActionRow[] = [];
    if (menuKeys.has("messages") && deal.client_id?.trim()) {
      list.push({
        key: "messages",
        label: "Messages",
        icon: <MessageSquare className="size-5 text-[#6B9E6E]" aria-hidden />,
        onClick: () => {
          onOpenChange(false);
          setMovePickerOpen(false);
          onMessages(deal);
        },
      });
    }
    if (menuKeys.has("requestDocuments")) {
      list.push({
        key: "requestDocuments",
        label: "Request Documents",
        icon: <FileText className="size-5 text-[#6B9E6E]" aria-hidden />,
        onClick: () => {
          onOpenChange(false);
          setMovePickerOpen(false);
          onRequestDocuments(deal);
        },
      });
    }
    if (menuKeys.has("markWon")) {
      list.push({
        key: "markWon",
        label: "Mark as Won",
        icon: <CircleCheck className="size-5 text-[#6B9E6E]" aria-hidden />,
        tone: "sage",
        onClick: () => {
          onOpenChange(false);
          setMovePickerOpen(false);
          onMarkWon(deal);
        },
      });
    }
    if (menuKeys.has("markClosed")) {
      list.push({
        key: "markClosed",
        label: "Mark as Won",
        icon: <CircleCheck className="size-5 text-[#6B9E6E]" aria-hidden />,
        tone: "sage",
        onClick: () => {
          onOpenChange(false);
          setMovePickerOpen(false);
          onMarkWon(deal);
        },
      });
    }
    if (menuKeys.has("markLost")) {
      list.push({
        key: "markLost",
        label: "Mark as Lost",
        icon: <X className="size-5 text-red-600" aria-hidden />,
        tone: "danger",
        onClick: () => {
          onOpenChange(false);
          setMovePickerOpen(false);
          onMarkLost(deal);
        },
      });
    }
    if (menuKeys.has("agentArchive")) {
      list.push({
        key: "agentArchive",
        label: "Archive",
        icon: <Archive className="size-5 text-[#888888]" aria-hidden />,
        onClick: () => {
          onOpenChange(false);
          setMovePickerOpen(false);
          onArchive(deal);
        },
      });
    }
    if (menuKeys.has("declineArchive")) {
      list.push({
        key: "declineArchive",
        label: "Decline & Archive",
        icon: <Archive className="size-5 text-red-600" aria-hidden />,
        tone: "danger",
        onClick: () => {
          onOpenChange(false);
          setMovePickerOpen(false);
          onDeclineArchive(deal);
        },
      });
    }
    if (menuKeys.has("moveTo")) {
      list.push({
        key: "moveTo",
        label: "Move to…",
        icon: <ArrowRightCircle className="size-5 text-[#6B9E6E]" aria-hidden />,
        onClick: () => setMovePickerOpen(true),
      });
    }
    return list;
  }, [
    deal,
    menuKeys,
    onArchive,
    onDeclineArchive,
    onMarkLost,
    onMarkWon,
    onMessages,
    onOpenChange,
    onRequestDocuments,
  ]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setMovePickerOpen(false);
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[100] bg-black/45"
        className="z-[100] flex max-h-[85dvh] flex-col rounded-t-2xl border-[#2C2C2C]/10 bg-white px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-[#2C2C2C]"
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[#2C2C2C]/15" aria-hidden />
        <SheetHeader className="shrink-0 px-4 text-left">
          <SheetTitle className="font-sans text-base font-semibold text-[#2C2C2C]">
            {movePickerOpen ? "Move to stage" : deal?.name ?? "Deal actions"}
          </SheetTitle>
          <SheetDescription className="sr-only">Pipeline deal actions</SheetDescription>
        </SheetHeader>

        {movePickerOpen && deal ? (
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
            <button
              type="button"
              className="mb-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-[#888888] active:bg-[#F3F0EA]"
              onClick={() => setMovePickerOpen(false)}
            >
              ← Back
            </button>
            {otherStages.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-[#2C2C2C] active:bg-[#F3F0EA]"
                onClick={() => {
                  onMoveToStage(deal, s.id);
                  onOpenChange(false);
                  setMovePickerOpen(false);
                }}
              >
                <ArrowRightCircle className="size-5 shrink-0 text-[#6B9E6E]" aria-hidden />
                {pipelineMoveToStageLabel(s.id)}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
            {rows.map((row) => (
              <button
                key={row.key}
                type="button"
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-[#2C2C2C] active:bg-[#F3F0EA]",
                  row.tone === "sage" && "text-[#2C5F32]",
                  row.tone === "danger" && "text-red-600",
                )}
                onClick={row.onClick}
              >
                {row.icon}
                {row.label}
              </button>
            ))}
            <button
              type="button"
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold text-[#888888] active:bg-[#F3F0EA]"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
