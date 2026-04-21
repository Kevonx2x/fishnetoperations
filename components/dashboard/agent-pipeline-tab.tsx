"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Eye, FileText, Loader2, MoreHorizontal, User, X } from "lucide-react";
import { toast } from "sonner";
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

export const PIPELINE_STAGES = [
  { id: "lead", label: "Lead" },
  { id: "viewing", label: "Viewing" },
  { id: "offer", label: "Offer" },
  { id: "reservation", label: "Reservation" },
  { id: "closed", label: "Closed" },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

export type PipelineLeadRow = {
  id: number;
  name: string;
  email: string;
  /** Linked client profile id (for document requests). */
  client_id?: string | null;
  pipeline_stage: PipelineStageId;
  property_id: string | null;
  created_at: string;
  updated_at?: string | null;
  pipeline_position?: number | null;
  closing_notes?: string | null;
};

type DocDef = { key: string; label: string };

export const PIPELINE_DOC_CHECKLIST: Record<PipelineStageId, DocDef[]> = {
  lead: [
    { key: "client_id", label: "Client ID (passport/valid ID)" },
    { key: "proof_of_income", label: "Proof of income" },
    { key: "contact_form", label: "Contact form" },
  ],
  viewing: [
    { key: "viewing_confirmation", label: "Signed viewing confirmation" },
    { key: "client_preferences", label: "Client preferences form" },
  ],
  offer: [
    { key: "offer_letter", label: "Offer to buy letter" },
    { key: "proof_of_funds", label: "Proof of funds" },
    { key: "tax_id", label: "Tax Identification Number" },
  ],
  reservation: [
    { key: "reservation_agreement", label: "Reservation agreement" },
    { key: "reservation_fee_receipt", label: "Reservation fee receipt" },
    { key: "post_dated_checks", label: "Post-dated checks (if applicable)" },
  ],
  closed: [
    { key: "contract_to_sell", label: "Contract to sell" },
    { key: "transfer_certificate", label: "Transfer Certificate of Title" },
    { key: "tax_clearance", label: "Tax clearance" },
    { key: "official_receipt", label: "Official receipt" },
  ],
};

const STAGE_ORDER: PipelineStageId[] = ["lead", "viewing", "offer", "reservation", "closed"];

function nextStage(s: PipelineStageId): PipelineStageId | null {
  const i = STAGE_ORDER.indexOf(s);
  if (i < 0 || i >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[i + 1];
}

const MOVE_TO_LABEL: Record<PipelineStageId, string | null> = {
  lead: "Move to Viewing",
  viewing: "Move to Offer",
  offer: "Move to Reservation",
  reservation: "Move to Closed",
  closed: null,
};

const CLIENT_DOC_REQUEST_OPTIONS = [
  { key: "valid_id" as const, label: "Valid ID" },
  { key: "proof_of_funds" as const, label: "Proof of Funds" },
  { key: "visa" as const, label: "Visa Document" },
  { key: "other" as const, label: "Other" },
];

/** Grouped document types for View Documents panel (request + send flows). */
const PANEL_DOC_OPTGROUPS: {
  label: string;
  options: { slug: string; label: string; suggested_for_stage: PipelineStageId }[];
}[] = [
  {
    label: "Viewing",
    options: [{ slug: "valid_id", label: "Valid ID", suggested_for_stage: "viewing" }],
  },
  {
    label: "Offer",
    options: [
      { slug: "proof_of_income", label: "Proof of Income", suggested_for_stage: "offer" },
      { slug: "tin", label: "TIN", suggested_for_stage: "offer" },
    ],
  },
  {
    label: "Reservation",
    options: [
      { slug: "contract_to_sell", label: "Contract to Sell", suggested_for_stage: "reservation" },
      { slug: "reservation_agreement", label: "Reservation Agreement", suggested_for_stage: "reservation" },
    ],
  },
  {
    label: "Closing",
    options: [
      { slug: "deed_of_sale", label: "Deed of Sale", suggested_for_stage: "closed" },
      { slug: "final_docs", label: "Final Docs", suggested_for_stage: "closed" },
    ],
  },
];

const PANEL_DOC_BY_SLUG: Record<
  string,
  { slug: string; label: string; suggested_for_stage: PipelineStageId }
> = Object.fromEntries(
  PANEL_DOC_OPTGROUPS.flatMap((g) => g.options.map((o) => [o.slug, o] as const)),
);

/** When moving into a stage, pre-select this document in Request flow. */
const STAGE_MOVE_SUGGEST_SLUG: Partial<Record<PipelineStageId, string>> = {
  viewing: "valid_id",
  offer: "proof_of_income",
  reservation: "contract_to_sell",
  closed: "deed_of_sale",
};

const PANEL_SELECT_CLASS =
  "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-md";

/** Labels for shared client_documents rows in the pipeline panel */
const CLIENT_SHARED_DOC_TYPE_LABEL: Record<string, string> = {
  valid_id: "Valid ID",
  proof_of_funds: "Proof of Funds",
  visa: "Visa",
  other: "Other",
};

function labelSharedClientDocType(documentType: string): string {
  return CLIENT_SHARED_DOC_TYPE_LABEL[documentType] ?? documentType;
}

function clientDocStatusLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "shared") return "Received";
  if (s === "private") return "Pending";
  if (s === "signed") return "Signed";
  return "Pending";
}

type ClientDocRow = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  created_at: string;
  status: string;
};

type DealDocCheckRow = {
  created_at: string;
  document_type: string;
  status: string;
  required: boolean | null;
  suggested_for_stage: string | null;
  direction: string | null;
};

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function stageBadgeClass(stage: PipelineStageId): string {
  switch (stage) {
    case "lead":
      return "bg-[#2C2C2C]/10 text-[#2C2C2C]/80";
    case "viewing":
      return "bg-[#6B9E6E]/15 text-[#2d5a30]";
    case "offer":
      return "bg-[#D4A843]/25 text-[#8a6d32]";
    case "reservation":
      return "bg-[#6B9E6E]/22 text-[#2d5a30]";
    case "closed":
      return "bg-[#6B9E6E]/20 text-[#2d5a30]";
    default:
      return "bg-[#2C2C2C]/10 text-[#2C2C2C]/80";
  }
}

function stageColumnHeaderClass(stage: PipelineStageId): string {
  switch (stage) {
    case "lead":
      return "bg-white";
    case "viewing":
      return "bg-[#6B9E6E]/10";
    case "offer":
      return "bg-[#D4A843]/12";
    case "reservation":
      return "bg-[#6B9E6E]/16";
    case "closed":
      return "bg-[#6B9E6E] text-white";
    default:
      return "bg-white";
  }
}

function stageDotClass(stage: PipelineStageId): string {
  switch (stage) {
    case "lead":
      return "bg-[#2C2C2C]/35";
    case "viewing":
      return "bg-[#6B9E6E]/70";
    case "offer":
      return "bg-[#D4A843]";
    case "reservation":
      return "bg-[#6B9E6E]";
    case "closed":
      return "bg-[#6B9E6E]";
    default:
      return "bg-[#2C2C2C]/35";
  }
}

function normalizeStage(raw: string | null | undefined): PipelineStageId {
  const s = (raw ?? "lead").trim().toLowerCase();
  if (STAGE_ORDER.includes(s as PipelineStageId)) return s as PipelineStageId;
  return "lead";
}

function sortDealsInStage(a: PipelineLeadRow, b: PipelineLeadRow): number {
  const pa = a.pipeline_position ?? 0;
  const pb = b.pipeline_position ?? 0;
  if (pa !== pb) return pa - pb;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function nextStepForStage(s: PipelineStageId): string {
  switch (s) {
    case "lead":
      return "Follow up with client";
    case "viewing":
      return "Prepare viewing documents";
    case "offer":
      return "Send contract";
    case "reservation":
      return "Confirm reservation details";
    case "closed":
      return "Deal complete";
  }
}

function stageIconFor(raw: string | null | undefined) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "viewing") return <Eye className="h-3 w-3" aria-hidden />;
  if (s === "offer") return <FileText className="h-3 w-3" aria-hidden />;
  if (s === "declined") return <X className="h-3 w-3" aria-hidden />;
  return <User className="h-3 w-3" aria-hidden />;
}

function formatPesoCompact(n: number): string {
  try {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₱${Math.round(n).toLocaleString()}`;
  }
}

function parsePriceToNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function KanbanDealCard({
  deal,
  indexInStage,
  propertyLabel,
  dealValueLine,
  onOpenDocs,
  onBeginStageMove,
  stageMovePrompt,
  onStageMovePromptSkip,
  onStageMovePromptYes,
  menuOpenId,
  setMenuOpenId,
  menuMoveOpen,
  setMenuMoveOpen,
  menuWrapRef,
  onOpenLeadDetails,
  onRequestNotes,
  onRequestDocuments,
  onRequestDecline,
  onMoveToStage,
  moveBusyId,
}: {
  deal: PipelineLeadRow;
  indexInStage: number;
  propertyLabel: (propertyId: string | null) => string;
  dealValueLine: string | null;
  onOpenDocs: (lead: PipelineLeadRow) => void;
  onBeginStageMove: (lead: PipelineLeadRow, targetStage: PipelineStageId, kind: "advance" | "jump") => void;
  stageMovePrompt: {
    lead: PipelineLeadRow;
    targetStage: PipelineStageId;
    kind: "advance" | "jump";
  } | null;
  onStageMovePromptSkip: () => void;
  onStageMovePromptYes: (lead: PipelineLeadRow, targetStage: PipelineStageId) => void;
  menuOpenId: number | null;
  setMenuOpenId: (id: number | null) => void;
  menuMoveOpen: boolean;
  setMenuMoveOpen: (v: boolean) => void;
  menuWrapRef: React.RefObject<HTMLDivElement | null>;
  onOpenLeadDetails: (leadId: number) => void;
  onRequestNotes: (lead: PipelineLeadRow) => void;
  onRequestDocuments: (lead: PipelineLeadRow) => void;
  onRequestDecline: (lead: PipelineLeadRow) => void;
  onMoveToStage: (lead: PipelineLeadRow, stage: PipelineStageId) => void;
  moveBusyId: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(deal.id),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const next = nextStage(deal.pipeline_stage);
  const propLine = propertyLabel(deal.property_id);
  const moveLabel = MOVE_TO_LABEL[deal.pipeline_stage];
  const isHot = indexInStage === 0;
  const menuOpen = menuOpenId === deal.id;
  const updatedIso = (deal.updated_at ?? deal.created_at) as string;
  const updatedAtLabel = formatRelativeTime(updatedIso);
  const otherStages = PIPELINE_STAGES.filter((s) => s.id !== deal.pipeline_stage);

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className={cn(
          "rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm transition",
          isDragging && "scale-[1.02] shadow-xl",
        )}
        onClick={() => onOpenLeadDetails(deal.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpenLeadDetails(deal.id);
        }}
      >
        <div className="touch-none" {...attributes} {...listeners}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/15 text-xs font-bold text-[#6B9E6E]">
                {clientInitials(deal.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", stageDotClass(deal.pipeline_stage))} />
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">{deal.name}</p>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-[#2C2C2C]/55">
                  {deal.property_id ? propLine : propLine}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {dealValueLine ? (
                    <span className="text-xs font-bold text-[#D4A843]">{dealValueLine}</span>
                  ) : null}
                  <span className="text-[10px] font-semibold text-[#2C2C2C]/40">Updated {updatedAtLabel}</span>
                  {isHot ? (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      Hot
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              ref={menuOpen ? menuWrapRef : undefined}
              className="pointer-events-auto relative shrink-0"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="More options"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuMoveOpen(false);
                  setMenuOpenId(menuOpen ? null : deal.id);
                }}
                className="rounded-lg p-1.5 text-[#2C2C2C]/45 hover:bg-black/5 hover:text-[#2C2C2C]/70"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-gray-200 bg-white py-1 text-gray-900 shadow-md">
                  {!menuMoveOpen ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onOpenLeadDetails(deal.id);
                          setMenuOpenId(null);
                        }}
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onRequestNotes(deal);
                          setMenuOpenId(null);
                        }}
                      >
                        Edit Notes
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onRequestDocuments(deal);
                          setMenuOpenId(null);
                        }}
                      >
                        Request Documents
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onRequestDecline(deal);
                          setMenuOpenId(null);
                          setMenuMoveOpen(false);
                        }}
                      >
                        Decline & Archive
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => setMenuMoveOpen(true)}
                        >
                          Move to…
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="max-h-56 overflow-y-auto py-1">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-gray-500 hover:bg-gray-50"
                        onClick={() => setMenuMoveOpen(false)}
                      >
                        ← Back
                      </button>
                      {otherStages.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={moveBusyId === deal.id}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                          onClick={() => {
                            onBeginStageMove(deal, s.id, "jump");
                            setMenuOpenId(null);
                            setMenuMoveOpen(false);
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {next && moveLabel ? (
            <button
              type="button"
              onClick={() => onBeginStageMove(deal, next, "advance")}
              className="rounded-full bg-[#6B9E6E] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#5a8a5d]"
            >
              → {moveLabel}
            </button>
          ) : (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-bold text-[#6B9E6E]">
              ✓ Closed
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenDocs(deal)}
            className="rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
          >
            View Docs
          </button>
        </div>

        {stageMovePrompt?.lead.id === deal.id ? (
          <div className="mt-2 rounded-xl border border-gray-200 bg-amber-50/90 p-3 shadow-sm">
            <p className="text-xs font-semibold text-gray-800">Suggest requesting a document for this stage?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5d8a60]"
                onClick={() => onStageMovePromptYes(stageMovePrompt.lead, stageMovePrompt.targetStage)}
              >
                Yes, Request It
              </button>
              <button
                type="button"
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                onClick={onStageMovePromptSkip}
              >
                Skip
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SortableDealCard({
  deal,
  indexInStage,
  propertyLabel,
  dealValueLine,
  onOpenDocs,
  onBeginStageMove,
  stageMovePrompt,
  onStageMovePromptSkip,
  onStageMovePromptYes,
  menuOpenId,
  setMenuOpenId,
  menuMoveOpen,
  setMenuMoveOpen,
  menuWrapRef,
  onOpenLeadDetails,
  onRequestNotes,
  onRequestDocuments,
  onRequestDecline,
  onMoveToStage,
  moveBusyId,
}: {
  deal: PipelineLeadRow;
  indexInStage: number;
  propertyLabel: (propertyId: string | null) => string;
  dealValueLine: string | null;
  onOpenDocs: (lead: PipelineLeadRow) => void;
  onBeginStageMove: (lead: PipelineLeadRow, targetStage: PipelineStageId, kind: "advance" | "jump") => void;
  stageMovePrompt: {
    lead: PipelineLeadRow;
    targetStage: PipelineStageId;
    kind: "advance" | "jump";
  } | null;
  onStageMovePromptSkip: () => void;
  onStageMovePromptYes: (lead: PipelineLeadRow, targetStage: PipelineStageId) => void;
  menuOpenId: number | null;
  setMenuOpenId: (id: number | null) => void;
  menuMoveOpen: boolean;
  setMenuMoveOpen: (v: boolean) => void;
  menuWrapRef: React.RefObject<HTMLDivElement | null>;
  onOpenLeadDetails: (leadId: number) => void;
  onRequestNotes: (lead: PipelineLeadRow) => void;
  onRequestDocuments: (lead: PipelineLeadRow) => void;
  onRequestDecline: (lead: PipelineLeadRow) => void;
  onMoveToStage: (lead: PipelineLeadRow, stage: PipelineStageId) => void;
  moveBusyId: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(deal.id),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const next = nextStage(deal.pipeline_stage);
  const propLine = propertyLabel(deal.property_id);
  const moveLabel = MOVE_TO_LABEL[deal.pipeline_stage];
  const isHot = indexInStage === 0;
  const menuOpen = menuOpenId === deal.id;
  const isArchived = String((deal as unknown as { pipeline_stage?: unknown }).pipeline_stage ?? "")
    .trim()
    .toLowerCase() === "declined" || deal.pipeline_stage === "closed";
  const updatedIso = (deal.updated_at ?? deal.created_at) as string;
  const updatedMs = new Date(updatedIso).getTime();
  const createdMs = new Date(deal.created_at).getTime();
  const now = Date.now();
  const recentlyActive = Number.isFinite(updatedMs) && now - updatedMs <= 2 * 60 * 60 * 1000;
  const longInStage = Number.isFinite(createdMs) && now - createdMs > 3 * 24 * 60 * 60 * 1000;
  const hotSubtext = recentlyActive
    ? "Client recently active"
    : longInStage
      ? "High priority — needs follow up"
      : "High engagement";

  const otherStages = PIPELINE_STAGES.filter((s) => s.id !== deal.pipeline_stage);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-2xl border border-gray-100 border-l-4 border-l-[#6B9E6E] bg-white p-4 shadow-sm ${
        isDragging ? "scale-105 shadow-xl" : ""
      } ${isArchived ? "opacity-50 grayscale-[30%]" : ""}`}
    >
      <div
        className="touch-none"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/20 text-sm font-semibold text-[#6B9E6E]">
              {clientInitials(deal.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#2C2C2C]">{deal.name}</p>
              <p className="truncate text-xs text-gray-400">{deal.email}</p>
              {dealValueLine ? (
                <p className="mt-1 text-xs font-semibold text-[#D4A843]">{dealValueLine}</p>
              ) : null}
            </div>
          </div>
          <div
            ref={menuOpen ? menuWrapRef : undefined}
            className="pointer-events-auto relative shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {isHot ? (
                <div className="flex flex-col items-end">
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-500">
                    🔥 Hot
                  </span>
                  <span className="mt-0.5 text-[10px] text-gray-400">{hotSubtext}</span>
                </div>
              ) : null}
              <button
                type="button"
                aria-label="More options"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuMoveOpen(false);
                  setMenuOpenId(menuOpen ? null : deal.id);
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>

            {menuOpen ? (
              <div
                className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-gray-200 bg-white py-1 text-gray-900 shadow-md"
              >
                {!menuMoveOpen ? (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => {
                        onOpenLeadDetails(deal.id);
                        setMenuOpenId(null);
                      }}
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => {
                        onRequestNotes(deal);
                        setMenuOpenId(null);
                      }}
                    >
                      Edit Notes
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => {
                        onRequestDocuments(deal);
                        setMenuOpenId(null);
                      }}
                    >
                      Request Documents
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => {
                        onRequestDecline(deal);
                        setMenuOpenId(null);
                        setMenuMoveOpen(false);
                      }}
                    >
                      Decline & Archive
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => setMenuMoveOpen(true)}
                      >
                        Move to…
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="max-h-56 overflow-y-auto py-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-gray-500 hover:bg-gray-50"
                      onClick={() => setMenuMoveOpen(false)}
                    >
                      ← Back
                    </button>
                    {otherStages.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={moveBusyId === deal.id}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                        onClick={() => {
                          onBeginStageMove(deal, s.id, "jump");
                          setMenuOpenId(null);
                          setMenuMoveOpen(false);
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          {deal.property_id ? (
            <Link
              href={`/properties/${deal.property_id}`}
              className="font-medium text-[#6B9E6E] underline-offset-2 hover:underline"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {propLine}
            </Link>
          ) : (
            <p className="font-medium text-[#6B9E6E]">{propLine}</p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stageBadgeClass(deal.pipeline_stage)}`}
          >
            {PIPELINE_STAGES.find((x) => x.id === deal.pipeline_stage)?.label ?? deal.pipeline_stage}
          </span>
          {isArchived ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Archived</span>
          ) : null}
          <span className="text-xs text-gray-400">
            Created {new Date(deal.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
        </div>
        <p className="mt-2 text-xs font-medium text-[#6B9E6E]">→ {nextStepForStage(deal.pipeline_stage)}</p>
      </div>

      <div
        className="mt-4 flex gap-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {next && moveLabel ? (
          <button
            type="button"
            onClick={() => {
              onBeginStageMove(deal, next, "advance");
            }}
            className="flex flex-1 items-center justify-center rounded-xl bg-[#6B9E6E] py-2.5 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
          >
            → {moveLabel}
          </button>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-[#6B9E6E]">
            ✓ Closed
          </div>
        )}
        <button
          type="button"
          onClick={() => onOpenDocs(deal)}
          className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          📄 View Documents
        </button>
      </div>
      {stageMovePrompt?.lead.id === deal.id ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-amber-50/90 p-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-800">
            Suggest requesting a document for this stage?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5d8a60]"
              onClick={() =>
                onStageMovePromptYes(stageMovePrompt.lead, stageMovePrompt.targetStage)
              }
            >
              Yes, Request It
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              onClick={onStageMovePromptSkip}
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DECLINE_REASON_OPTIONS = [
  { key: "unavailable", label: "Property is no longer available" },
  { key: "mismatch", label: "Client requirements don't match" },
  { key: "no_response", label: "No response from client" },
  { key: "other", label: "Other" },
] as const;

export function AgentPipelineTab({
  leads,
  propertyLabel,
  supabase,
  onRefresh,
  onOpenLeadDetails,
  /** `agents.id` for the listing agent whose pipeline is shown (supervisor when logged in as team_member). */
  pipelineAgentId,
  /** When set (team member view), client documents shared with this user id are loaded (supervising agent). */
  clientDocsSharedWithUserId,
}: {
  leads: PipelineLeadRow[];
  propertyLabel: (propertyId: string | null) => string;
  supabase: SupabaseClient;
  onRefresh: () => void;
  onOpenLeadDetails: (leadId: number) => void;
  pipelineAgentId: string;
  clientDocsSharedWithUserId?: string;
}) {
  const [declineDeal, setDeclineDeal] = useState<PipelineLeadRow | null>(null);
  const [declineReasonKey, setDeclineReasonKey] =
    useState<(typeof DECLINE_REASON_OPTIONS)[number]["key"]>("unavailable");
  const [declineBusy, setDeclineBusy] = useState(false);

  const deals = useMemo(() => {
    return leads
      .filter((l) => String(l.pipeline_stage ?? "").toLowerCase() !== "declined")
      .map((l) => ({
        ...l,
        pipeline_stage: normalizeStage(l.pipeline_stage as string),
      }));
  }, [leads]);

  const [dealValueByPropertyId, setDealValueByPropertyId] = useState<Record<string, string>>({});
  const [dealValueNumberByPropertyId, setDealValueNumberByPropertyId] = useState<Record<string, number>>({});

  useEffect(() => {
    const ids = [
      ...new Set(
        deals
          .map((d) => d.property_id)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
      ),
    ];
    if (ids.length === 0) {
      setDealValueByPropertyId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, price, rent_price, listing_type, status")
        .in("id", ids);
      if (cancelled) return;
      if (error) {
        setDealValueByPropertyId({});
        setDealValueNumberByPropertyId({});
        return;
      }
      const next: Record<string, string> = {};
      const nextN: Record<string, number> = {};
      for (const row of (data ?? []) as {
        id: string;
        price: unknown;
        rent_price: unknown;
        listing_type: unknown;
        status: unknown;
      }[]) {
        const lt = String(row.listing_type ?? "").trim().toLowerCase();
        const status = String(row.status ?? "").trim().toLowerCase();
        const isRent = lt === "rent" || status === "for_rent";
        const raw = isRent ? row.rent_price : row.price;
        const n = parsePriceToNumber(raw);
        if (!n) continue;
        nextN[row.id] = n;
        next[row.id] = `${formatPesoCompact(n)}${isRent ? "/mo" : ""}`;
      }
      setDealValueByPropertyId(next);
      setDealValueNumberByPropertyId(nextN);
    })();
    return () => {
      cancelled = true;
    };
  }, [deals, supabase]);

  const [filterStage, setFilterStage] = useState<PipelineStageId>("lead");
  const [docsLead, setDocsLead] = useState<PipelineLeadRow | null>(null);
  const [clientDocRows, setClientDocRows] = useState<ClientDocRow[]>([]);
  const [dealDocCheckRows, setDealDocCheckRows] = useState<DealDocCheckRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsPanelFlow, setDocsPanelFlow] = useState<"idle" | "request" | "send">("idle");
  const [panelDocSlug, setPanelDocSlug] = useState("");
  const [requestRequired, setRequestRequired] = useState(false);
  const [sendRequired, setSendRequired] = useState(false);
  const [sendFileUrls, setSendFileUrls] = useState<string[]>([]);
  const [requestFlowBusy, setRequestFlowBusy] = useState(false);
  const [sendFlowBusy, setSendFlowBusy] = useState(false);
  const [clientDocOpeningId, setClientDocOpeningId] = useState<string | null>(null);
  const [stageMovePrompt, setStageMovePrompt] = useState<{
    lead: PipelineLeadRow;
    targetStage: PipelineStageId;
    kind: "advance" | "jump";
  } | null>(null);
  const [moveLead, setMoveLead] = useState<PipelineLeadRow | null>(null);
  const [moveNote, setMoveNote] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);
  const [optimisticOrderIds, setOptimisticOrderIds] = useState<number[] | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [menuMoveOpen, setMenuMoveOpen] = useState(false);
  const [notesLead, setNotesLead] = useState<PipelineLeadRow | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [moveToStageBusyId, setMoveToStageBusyId] = useState<number | null>(null);
  const [requestDocsLead, setRequestDocsLead] = useState<PipelineLeadRow | null>(null);
  const [reqDocSelections, setReqDocSelections] = useState({
    valid_id: false,
    proof_of_funds: false,
    visa: false,
    other: false,
  });
  const [requestDocsBusy, setRequestDocsBusy] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 800,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 800,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (menuOpenId == null) return;
    const onDoc = (e: MouseEvent) => {
      const el = menuWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setMenuOpenId(null);
        setMenuMoveOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpenId]);

  const submitDecline = useCallback(async () => {
    if (!declineDeal) return;
    setDeclineBusy(true);
    try {
      const res = await fetch("/api/agent/decline-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lead_id: declineDeal.id, reason_key: declineReasonKey }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not archive this deal");
        return;
      }
      toast.success("Deal archived");
      setDeclineDeal(null);
      await onRefresh();
    } finally {
      setDeclineBusy(false);
    }
  }, [declineDeal, declineReasonKey, onRefresh]);

  const counts = useMemo(() => {
    const c: Record<PipelineStageId, number> = {
      lead: 0,
      viewing: 0,
      offer: 0,
      reservation: 0,
      closed: 0,
    };
    for (const d of deals) {
      c[d.pipeline_stage]++;
    }
    return c;
  }, [deals]);

  const baseSorted = useMemo(() => {
    return deals.filter((d) => d.pipeline_stage === filterStage).sort(sortDealsInStage);
  }, [deals, filterStage]);

  const dealsByStage = useMemo(() => {
    const m: Record<PipelineStageId, PipelineLeadRow[]> = {
      lead: [],
      viewing: [],
      offer: [],
      reservation: [],
      closed: [],
    };
    for (const d of deals) m[d.pipeline_stage].push(d);
    for (const s of STAGE_ORDER) m[s] = m[s].slice().sort(sortDealsInStage);
    return m;
  }, [deals]);

  const stageTotals = useMemo(() => {
    const out: Record<PipelineStageId, { count: number; total: number }> = {
      lead: { count: 0, total: 0 },
      viewing: { count: 0, total: 0 },
      offer: { count: 0, total: 0 },
      reservation: { count: 0, total: 0 },
      closed: { count: 0, total: 0 },
    };
    for (const s of STAGE_ORDER) {
      const list = dealsByStage[s];
      out[s].count = list.length;
      let sum = 0;
      for (const d of list) {
        if (!d.property_id) continue;
        const n = dealValueNumberByPropertyId[d.property_id];
        if (typeof n === "number" && Number.isFinite(n)) sum += n;
      }
      out[s].total = sum;
    }
    return out;
  }, [dealsByStage, dealValueNumberByPropertyId]);

  const displayDeals = useMemo(() => {
    if (!optimisticOrderIds) return baseSorted;
    const set = new Set(baseSorted.map((d) => d.id));
    if (
      optimisticOrderIds.length !== baseSorted.length ||
      !optimisticOrderIds.every((id) => set.has(id))
    ) {
      return baseSorted;
    }
    return optimisticOrderIds
      .map((id) => baseSorted.find((d) => d.id === id))
      .filter((d): d is PipelineLeadRow => d != null);
  }, [baseSorted, optimisticOrderIds]);

  useEffect(() => {
    setOptimisticOrderIds(null);
  }, [filterStage]);

  const loadDocs = useCallback(
    async (lead: PipelineLeadRow) => {
      setDocsLoading(true);
      try {
        const { data: dealData, error: dealErr } = await supabase
          .from("deal_documents")
          .select("created_at, document_type, status, required, suggested_for_stage, direction")
          .eq("lead_id", lead.id);

        if (dealErr) {
          toast.error(dealErr.message);
          setDealDocCheckRows([]);
        } else {
          setDealDocCheckRows((dealData ?? []) as DealDocCheckRow[]);
        }

        if (!lead.client_id) {
          setClientDocRows([]);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        const shareUid = clientDocsSharedWithUserId?.trim() || user?.id;
        if (!shareUid) {
          setClientDocRows([]);
          return;
        }

        const { data: clientData, error: clientErr } = await supabase
          .from("client_documents")
          .select("id, document_type, file_url, file_name, created_at, status")
          .eq("client_id", lead.client_id)
          .contains("shared_with", [shareUid]);

        if (clientErr) {
          toast.error(clientErr.message);
          setClientDocRows([]);
          return;
        }
        setClientDocRows((clientData ?? []) as ClientDocRow[]);
      } finally {
        setDocsLoading(false);
      }
    },
    [supabase, clientDocsSharedWithUserId],
  );

  const openDocs = (lead: PipelineLeadRow) => {
    setDocsLead(lead);
    setDocsPanelFlow("idle");
    setPanelDocSlug("");
    setRequestRequired(false);
    setSendRequired(false);
    setSendFileUrls([]);
    setClientDocRows([]);
    setDealDocCheckRows([]);
    void loadDocs(lead);
  };

  const openDocsWithRequestPrefill = (lead: PipelineLeadRow, slug: string) => {
    setDocsLead(lead);
    setDocsPanelFlow("request");
    setPanelDocSlug(PANEL_DOC_BY_SLUG[slug] ? slug : "");
    setRequestRequired(false);
    setSendRequired(false);
    setSendFileUrls([]);
    setClientDocRows([]);
    setDealDocCheckRows([]);
    void loadDocs(lead);
  };

  const openClientDocumentUrl = async (doc: ClientDocRow) => {
    setClientDocOpeningId(doc.id);
    try {
      const res = await fetch("/api/client/get-document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ file_url: doc.file_url }),
      });
      const json = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not open document");
        return;
      }
      if (json.signedUrl) {
        window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setClientDocOpeningId(null);
    }
  };

  const submitPanelRequestFlow = async () => {
    if (!docsLead?.client_id) return;
    const meta = panelDocSlug ? PANEL_DOC_BY_SLUG[panelDocSlug] : undefined;
    if (!meta) {
      toast.error("Select a document type.");
      return;
    }
    setRequestFlowBusy(true);
    try {
      const res = await fetch("/api/agent/pipeline-deal-document-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lead_id: docsLead.id,
          agent_id: pipelineAgentId,
          mode: "request",
          document_type: meta.slug,
          document_name: meta.label,
          required: requestRequired,
          suggested_for_stage: meta.suggested_for_stage,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          toast.error(json.error ?? "This document is already on file for this deal.");
        } else {
          toast.error(json.error ?? "Could not send request");
        }
        return;
      }
      toast.success("Request sent — client notified");
      setPanelDocSlug("");
      setRequestRequired(false);
      await loadDocs(docsLead);
      onRefresh();
    } finally {
      setRequestFlowBusy(false);
    }
  };

  const submitPanelSendFlow = async () => {
    if (!docsLead?.client_id) return;
    const meta = panelDocSlug ? PANEL_DOC_BY_SLUG[panelDocSlug] : undefined;
    if (!meta) {
      toast.error("Select a document type.");
      return;
    }
    const fileUrl = sendFileUrls[0];
    if (!fileUrl) {
      toast.error("Upload a file before sending.");
      return;
    }
    setSendFlowBusy(true);
    try {
      const res = await fetch("/api/agent/pipeline-deal-document-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lead_id: docsLead.id,
          agent_id: pipelineAgentId,
          mode: "send",
          document_type: meta.slug,
          document_name: meta.label,
          file_url: fileUrl,
          required: sendRequired,
          suggested_for_stage: meta.suggested_for_stage,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          toast.error(json.error ?? "This document type already exists for this deal.");
        } else {
          toast.error(json.error ?? "Could not send document");
        }
        return;
      }
      toast.success("Document sent — client notified");
      setPanelDocSlug("");
      setSendRequired(false);
      setSendFileUrls([]);
      await loadDocs(docsLead);
      onRefresh();
    } finally {
      setSendFlowBusy(false);
    }
  };

  const docsLeadLive = useMemo(() => {
    if (!docsLead) return null;
    return deals.find((d) => d.id === docsLead.id) ?? docsLead;
  }, [deals, docsLead]);

  const showRequiredDocsWarning = useMemo(() => {
    if (!docsLeadLive) return false;
    const stage = docsLeadLive.pipeline_stage;
    return dealDocCheckRows.some(
      (row) =>
        row.required === true &&
        row.suggested_for_stage === stage &&
        row.status !== "approved",
    );
  }, [dealDocCheckRows, docsLeadLive]);

  const beginStageMove = (lead: PipelineLeadRow, targetStage: PipelineStageId, kind: "advance" | "jump") => {
    setStageMovePrompt({ lead, targetStage, kind });
  };

  const onStageMovePromptSkip = () => {
    const p = stageMovePrompt;
    if (!p) return;
    setStageMovePrompt(null);
    if (p.kind === "advance") {
      setMoveLead(p.lead);
      setMoveNote("");
    } else {
      void moveDealToStage(p.lead, p.targetStage);
    }
  };

  const onStageMovePromptYes = (lead: PipelineLeadRow, targetStage: PipelineStageId) => {
    setStageMovePrompt(null);
    const slug = STAGE_MOVE_SUGGEST_SLUG[targetStage];
    if (slug) {
      openDocsWithRequestPrefill(lead, slug);
    } else {
      setDocsLead(lead);
      setDocsPanelFlow("request");
      setPanelDocSlug("");
      setRequestRequired(false);
      setSendRequired(false);
      setSendFileUrls([]);
      setClientDocRows([]);
      setDealDocCheckRows([]);
      void loadDocs(lead);
    }
  };

  const confirmMove = async () => {
    if (!moveLead) return;
    setMoveBusy(true);
    try {
      const res = await fetch("/api/agent/pipeline-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leadId: moveLead.id, note: moveNote || null }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not update stage");
        return;
      }
      toast.success("Stage updated");
      setMoveLead(null);
      setMoveNote("");
      onRefresh();
    } finally {
      setMoveBusy(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayDeals.map((d) => d.id);
    const oldIndex = ids.findIndex((id) => String(id) === String(active.id));
    const newIndex = ids.findIndex((id) => String(id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    setOptimisticOrderIds(newOrder);
    try {
      const res = await fetch("/api/agent/pipeline-reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pipeline_stage: filterStage, lead_ids: newOrder }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save order");
        setOptimisticOrderIds(null);
        return;
      }
      onRefresh();
    } finally {
      setOptimisticOrderIds(null);
    }
  };

  const saveClosingNotesOnBlur = async () => {
    if (!notesLead) return;
    setNotesSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({ closing_notes: notesDraft.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", notesLead.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Notes saved");
      setNotesLead(null);
      onRefresh();
    } finally {
      setNotesSaving(false);
    }
  };

  const moveDealToStage = async (lead: PipelineLeadRow, stage: PipelineStageId) => {
    setMoveToStageBusyId(lead.id);
    try {
      const res = await fetch("/api/agent/pipeline-set-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leadId: lead.id, pipeline_stage: stage }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not move deal");
        return;
      }
      toast.success("Deal moved");
      onRefresh();
    } finally {
      setMoveToStageBusyId(null);
    }
  };

  const sendClientDocumentRequest = async () => {
    if (!requestDocsLead) return;
    const document_types = CLIENT_DOC_REQUEST_OPTIONS.filter((o) => reqDocSelections[o.key]).map(
      (o) => o.key,
    );
    if (document_types.length === 0) {
      toast.error("Select at least one document type.");
      return;
    }
    setRequestDocsBusy(true);
    try {
      const res = await fetch("/api/agent/request-client-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lead_id: requestDocsLead.id, document_types }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not send request");
        return;
      }
      toast.success("Document request sent!");
      setRequestDocsLead(null);
    } finally {
      setRequestDocsBusy(false);
    }
  };

  const sortableIds = useMemo(() => displayDeals.map((d) => String(d.id)), [displayDeals]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Pipeline</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
          Track deals from lead to close — documents and stage updates in one place.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 lg:hidden">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Pipeline overview</p>
        <div className="-mx-1 overflow-x-auto pb-1 scrollbar-hide">
          <div className="relative flex min-w-[min(100%,520px)] items-center justify-between gap-1 px-1 sm:min-w-0 sm:gap-0">
            <div className="pointer-events-none absolute left-1 right-1 top-[22px] h-0.5 bg-gray-200" aria-hidden />
            <div
              className="pointer-events-none absolute left-1 top-[22px] h-0.5 bg-[#6B9E6E]"
              style={{
                width: `${
                  PIPELINE_STAGES.length > 1
                    ? (STAGE_ORDER.indexOf(filterStage) / (PIPELINE_STAGES.length - 1)) * 100
                    : 0
                }%`,
              }}
              aria-hidden
            />
            {PIPELINE_STAGES.map((s, idx) => {
              const n = counts[s.id];
              const hasCount = n > 0;
              const active = filterStage === s.id;
              return (
                <div key={s.id} className="flex min-w-0 flex-1 items-center">
                  <div className="flex w-full min-w-[56px] flex-col items-center gap-1.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-white text-sm font-bold shadow-sm ${
                        hasCount ? "border-[#6B9E6E] text-[#6B9E6E]" : "border-gray-300 text-gray-400"
                      } ${active ? "animate-pulse ring-2 ring-[#6B9E6E] ring-offset-2" : ""}`}
                    >
                      {n}
                    </div>
                    <span
                      className={`text-center text-[10px] font-bold sm:text-[11px] ${
                        hasCount ? "text-[#6B9E6E]" : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                    {active ? (
                      <span className="text-[10px] font-medium text-[#6B9E6E]">Current stage</span>
                    ) : null}
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 ? (
                    <div className="mx-0.5 h-0.5 min-w-[8px] flex-1 bg-gray-200 sm:min-w-[12px]" aria-hidden />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-center text-[9px] font-semibold text-gray-500">
          Lead → Viewing → Offer → Reservation → Closed
        </p>
      </div>

      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
        {PIPELINE_STAGES.map((s) => {
          const active = filterStage === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilterStage(s.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                active
                  ? "bg-[#6B9E6E] text-white shadow-sm"
                  : "border border-[#2C2C2C]/20 bg-white text-[#2C2C2C]/75 hover:border-[#6B9E6E]/40"
              }`}
            >
              {s.label}
              <span className={`ml-1.5 tabular-nums ${active ? "text-white/90" : "text-[#2C2C2C]/45"}`}>
                ({counts[s.id]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile / tablet: keep current stacked view */}
      <div className="touch-pan-y space-y-3 overflow-y-auto overscroll-contain max-h-[calc(100vh-280px)] md:max-h-none md:overflow-visible md:touch-auto lg:hidden">
        {displayDeals.length === 0 ? (
          <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center text-sm font-semibold text-[#2C2C2C]/45">
            No deals at this stage.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {displayDeals.map((deal, idx) => (
                <SortableDealCard
                  key={deal.id}
                  deal={deal}
                  indexInStage={idx}
                  propertyLabel={propertyLabel}
                  dealValueLine={deal.property_id ? dealValueByPropertyId[deal.property_id] ?? null : null}
                  onOpenDocs={openDocs}
                  onBeginStageMove={beginStageMove}
                  stageMovePrompt={stageMovePrompt}
                  onStageMovePromptSkip={onStageMovePromptSkip}
                  onStageMovePromptYes={onStageMovePromptYes}
                  menuOpenId={menuOpenId}
                  setMenuOpenId={setMenuOpenId}
                  menuMoveOpen={menuMoveOpen}
                  setMenuMoveOpen={setMenuMoveOpen}
                  menuWrapRef={menuWrapRef}
                  onOpenLeadDetails={onOpenLeadDetails}
                  onRequestNotes={(d) => {
                    setNotesLead(d);
                    setNotesDraft(d.closing_notes ?? "");
                  }}
                  onRequestDocuments={(d) => {
                    if (!d.client_id) {
                      toast.error("This lead is not linked to a client account yet.");
                      return;
                    }
                    setRequestDocsLead(d);
                    setReqDocSelections({
                      valid_id: false,
                      proof_of_funds: false,
                      visa: false,
                      other: false,
                    });
                  }}
                  onRequestDecline={(d) => setDeclineDeal(d)}
                  onMoveToStage={moveDealToStage}
                  moveBusyId={moveToStageBusyId}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Desktop: Pipedrive-style kanban columns */}
      <div className="hidden lg:block">
        <div className="-mx-1 overflow-x-auto bg-[#FAF8F4] px-3 py-3 scrollbar-hide">
          <div className="flex w-max min-w-full items-stretch gap-0">
            {STAGE_ORDER.map((stage, idx) => {
              const label = PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
              const list = dealsByStage[stage];
              const total = stageTotals[stage]?.total ?? 0;
              const count = stageTotals[stage]?.count ?? list.length;
              const ids = list.map((d) => String(d.id));
              const showTotal = total > 0;

              return (
                <div
                  key={stage}
                  className={cn(
                    "w-[320px] shrink-0 px-3",
                    idx > 0 && "border-l border-[#2C2C2C]/10",
                  )}
                >
                  <div
                    className={cn(
                      "sticky top-0 z-10 rounded-2xl border border-[#2C2C2C]/10 px-4 py-3 shadow-sm",
                      stageColumnHeaderClass(stage),
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", stageDotClass(stage))} />
                          <p
                            className={cn(
                              "truncate font-serif text-base font-bold",
                              stage === "closed" ? "text-white" : "text-[#2C2C2C]",
                            )}
                          >
                            {label}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "mt-1 text-xs font-semibold",
                            stage === "closed" ? "text-white/80" : "text-[#2C2C2C]/55",
                          )}
                        >
                          {count} deal{count === 1 ? "" : "s"}
                          {showTotal ? ` · ${formatPesoCompact(total)}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                          stage === "closed"
                            ? "bg-white/15 text-white"
                            : "bg-white text-[#2C2C2C]/70 ring-1 ring-[#2C2C2C]/10",
                        )}
                      >
                        {count}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 min-h-[24px]">
                    {list.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#2C2C2C]/15 bg-white/70 px-3 py-4 text-center text-xs font-semibold text-[#2C2C2C]/45">
                        No deals
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => {
                          const { active, over } = e;
                          if (!over || active.id === over.id) return;
                          // Restrict reorder to within this stage column
                          if (!ids.includes(String(active.id)) || !ids.includes(String(over.id))) return;
                          const oldIndex = ids.findIndex((id) => String(id) === String(active.id));
                          const newIndex = ids.findIndex((id) => String(id) === String(over.id));
                          if (oldIndex < 0 || newIndex < 0) return;
                          const newOrder = arrayMove(ids, oldIndex, newIndex).map((x) => Number(x));
                          setOptimisticOrderIds(newOrder);
                          void (async () => {
                            try {
                              const res = await fetch("/api/agent/pipeline-reorder", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ pipeline_stage: stage, lead_ids: newOrder }),
                              });
                              const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
                              if (!res.ok) {
                                toast.error(json?.error?.message ?? "Could not save order");
                                return;
                              }
                              onRefresh();
                            } finally {
                              setOptimisticOrderIds(null);
                            }
                          })();
                        }}
                      >
                        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2 pb-2">
                            {list.map((deal, i) => (
                              <KanbanDealCard
                                key={deal.id}
                                deal={deal}
                                indexInStage={i}
                                propertyLabel={propertyLabel}
                                dealValueLine={
                                  deal.property_id ? dealValueByPropertyId[deal.property_id] ?? null : null
                                }
                                onOpenDocs={openDocs}
                                onBeginStageMove={beginStageMove}
                                stageMovePrompt={stageMovePrompt}
                                onStageMovePromptSkip={onStageMovePromptSkip}
                                onStageMovePromptYes={onStageMovePromptYes}
                                menuOpenId={menuOpenId}
                                setMenuOpenId={setMenuOpenId}
                                menuMoveOpen={menuMoveOpen}
                                setMenuMoveOpen={setMenuMoveOpen}
                                menuWrapRef={menuWrapRef}
                                onOpenLeadDetails={onOpenLeadDetails}
                                onRequestNotes={(d) => {
                                  setNotesLead(d);
                                  setNotesDraft(d.closing_notes ?? "");
                                }}
                                onRequestDocuments={(d) => {
                                  if (!d.client_id) {
                                    toast.error("This lead is not linked to a client account yet.");
                                    return;
                                  }
                                  setRequestDocsLead(d);
                                  setReqDocSelections({
                                    valid_id: false,
                                    proof_of_funds: false,
                                    visa: false,
                                    other: false,
                                  });
                                }}
                                onRequestDecline={(d) => setDeclineDeal(d)}
                                onMoveToStage={moveDealToStage}
                                moveBusyId={moveToStageBusyId}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {moveLead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => !moveBusy && setMoveLead(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-xl"
            >
              <p className="font-serif text-lg font-bold text-[#2C2C2C]">Advance deal</p>
              <p className="mt-2 text-sm text-[#2C2C2C]/70">
                <span className="font-semibold text-[#2C2C2C]">
                  {PIPELINE_STAGES.find((x) => x.id === moveLead.pipeline_stage)?.label}
                </span>
                {" → "}
                <span className="font-semibold text-[#6B9E6E]">
                  {nextStage(moveLead.pipeline_stage)
                    ? PIPELINE_STAGES.find((x) => x.id === nextStage(moveLead.pipeline_stage))?.label
                    : ""}
                </span>
              </p>
              <label className="mt-4 block text-xs font-bold text-[#2C2C2C]/55">
                Notes (optional)
                <textarea
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 px-3 py-2 text-sm font-medium text-[#2C2C2C] outline-none ring-[#6B9E6E]/0 transition focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/25"
                  placeholder="Internal note for your team…"
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={moveBusy}
                  onClick={() => setMoveLead(null)}
                  className="rounded-full px-4 py-2 text-sm font-bold text-[#2C2C2C]/55 hover:bg-[#FAF8F4]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={moveBusy}
                  onClick={() => void confirmMove()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {moveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {notesLead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[72] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => !notesSaving && setNotesLead(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-xl"
            >
              <p className="font-serif text-lg font-bold text-[#2C2C2C]">Closing notes</p>
              <p className="mt-1 text-xs text-gray-500">{notesLead.name}</p>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => void saveClosingNotesOnBlur()}
                rows={5}
                className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/20"
                placeholder="Notes saved to this lead on blur…"
                disabled={notesSaving}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  onClick={() => setNotesLead(null)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {requestDocsLead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[73] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => !requestDocsBusy && setRequestDocsLead(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-xl"
            >
              <p className="font-serif text-lg font-bold text-[#2C2C2C]">
                Request documents from {requestDocsLead.name}
              </p>
              <div className="mt-4 space-y-3">
                {CLIENT_DOC_REQUEST_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[#2C2C2C]"
                  >
                    <input
                      type="checkbox"
                      checked={reqDocSelections[opt.key]}
                      onChange={(e) =>
                        setReqDocSelections((s) => ({ ...s, [opt.key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={requestDocsBusy}
                  onClick={() => setRequestDocsLead(null)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-[#2C2C2C]/60 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={requestDocsBusy}
                  onClick={() => void sendClientDocumentRequest()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5a8a5d] disabled:opacity-50"
                >
                  {requestDocsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {docsLead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] flex justify-end bg-black/35"
            onClick={() => setDocsLead(null)}
          >
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-full max-w-md flex-col border-l border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#2C2C2C]/10 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-serif font-bold text-[#2C2C2C]">Documents</p>
                  <p className="truncate text-xs font-medium text-[#2C2C2C]/50">{docsLead.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocsLead(null)}
                  className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#FAF8F4]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {showRequiredDocsWarning ? (
                  <div
                    role="status"
                    className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-950 shadow-sm"
                  >
                    Some required documents for this stage have not been received yet. You can still
                    move the deal forward when you&apos;re ready.
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!docsLead.client_id}
                    onClick={() => {
                      setDocsPanelFlow("request");
                      setPanelDocSlug("");
                      setRequestRequired(false);
                    }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold shadow-sm transition ${
                      docsPanelFlow === "request"
                        ? "border-[#6B9E6E] bg-[#6B9E6E] text-white"
                        : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    Request Document
                  </button>
                  <button
                    type="button"
                    disabled={!docsLead.client_id}
                    onClick={() => {
                      setDocsPanelFlow("send");
                      setPanelDocSlug("");
                      setSendRequired(false);
                      setSendFileUrls([]);
                    }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold shadow-sm transition ${
                      docsPanelFlow === "send"
                        ? "border-[#6B9E6E] bg-[#6B9E6E] text-white"
                        : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    Send Document
                  </button>
                </div>

                {!docsLead.client_id ? (
                  <p className="mt-4 rounded-xl border border-[#2C2C2C]/10 bg-white p-3 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm">
                    No client account linked to this deal — link a client to send or request documents.
                  </p>
                ) : docsPanelFlow === "request" ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-md">
                    <label
                      className="block text-xs font-semibold text-gray-700"
                      htmlFor="panel-request-doc-type"
                    >
                      Document type
                    </label>
                    <select
                      id="panel-request-doc-type"
                      value={panelDocSlug}
                      onChange={(e) => setPanelDocSlug(e.target.value)}
                      className={PANEL_SELECT_CLASS}
                    >
                      <option value="">Choose a document…</option>
                      {PANEL_DOC_OPTGROUPS.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.options.map((o) => (
                            <option key={o.slug} value={o.slug}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                        checked={requestRequired}
                        onChange={(e) => setRequestRequired(e.target.checked)}
                      />
                      Required (must be received before progressing to the next stage)
                    </label>
                    <button
                      type="button"
                      disabled={!panelDocSlug || requestFlowBusy}
                      onClick={() => void submitPanelRequestFlow()}
                      className="mt-4 w-full rounded-full bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {requestFlowBusy ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        "Submit Request"
                      )}
                    </button>
                  </div>
                ) : docsPanelFlow === "send" ? (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-md">
                    <label
                      className="block text-xs font-semibold text-gray-700"
                      htmlFor="panel-send-doc-type"
                    >
                      Document type
                    </label>
                    <select
                      id="panel-send-doc-type"
                      value={panelDocSlug}
                      onChange={(e) => setPanelDocSlug(e.target.value)}
                      className={PANEL_SELECT_CLASS}
                    >
                      <option value="">Choose a document…</option>
                      {PANEL_DOC_OPTGROUPS.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.options.map((o) => (
                            <option key={o.slug} value={o.slug}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                        checked={sendRequired}
                        onChange={(e) => setSendRequired(e.target.checked)}
                      />
                      Required (must be received before progressing to the next stage)
                    </label>
                    <p className="mt-3 text-xs font-semibold text-gray-600">File</p>
                    <div className="mt-1">
                      <CloudinaryUpload
                        value={sendFileUrls}
                        onUpload={setSendFileUrls}
                        maxFiles={1}
                        disabled={sendFlowBusy}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!panelDocSlug || sendFileUrls.length === 0 || sendFlowBusy}
                      onClick={() => void submitPanelSendFlow()}
                      className="mt-4 w-full rounded-full bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {sendFlowBusy ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        "Send Document"
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-center text-xs font-semibold text-gray-500">
                    Choose Request Document or Send Document above.
                  </p>
                )}

                <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Client Documents
                </p>
                {docsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" />
                  </div>
                ) : !docsLead.client_id ? (
                  <p className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm">
                    No client account linked to this deal
                  </p>
                ) : clientDocRows.length === 0 ? (
                  <p className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 text-sm font-semibold text-[#2C2C2C]/65 shadow-sm">
                    No documents shared yet. Use Request Documents to ask the client.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {clientDocRows.map((cd) => {
                      const statusLabel = clientDocStatusLabel(cd.status);
                      const statusClass =
                        statusLabel === "Received"
                          ? "bg-emerald-100 text-emerald-900 font-semibold"
                          : statusLabel === "Signed"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-amber-100 text-amber-900";
                      const matchCreatedAt =
                        dealDocCheckRows
                          .filter((r) => {
                            const t = (r.document_type ?? "").trim();
                            if (!t) return false;
                            return t === cd.document_type || t.endsWith(`:${cd.document_type}`);
                          })
                          .map((r) => r.created_at)
                          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ??
                        null;
                      const createdAtLabel = matchCreatedAt
                        ? formatRelativeTime(matchCreatedAt)
                        : formatRelativeTime(cd.created_at);
                      return (
                        <li
                          key={cd.id}
                          className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-[#2C2C2C]">
                              {labelSharedClientDocType(cd.document_type)}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          {cd.file_name ? (
                            <p className="mt-1 truncate text-xs font-medium text-[#2C2C2C]/60">
                              {cd.file_name}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px] font-semibold text-[#2C2C2C]/45">
                            {createdAtLabel}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-400">
                            {(statusLabel === "Pending" ? "Requested " : "Uploaded ") + formatRelativeTime(cd.created_at)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={clientDocOpeningId === cd.id}
                              onClick={() => void openClientDocumentUrl(cd)}
                              className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4] disabled:opacity-50"
                            >
                              {clientDocOpeningId === cd.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              View
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {declineDeal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => !declineBusy && setDeclineDeal(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-xl"
            >
              <p className="font-serif text-lg font-bold text-[#2C2C2C]">Decline this deal?</p>
              <p className="mt-2 text-sm text-[#2C2C2C]/70">
                This will notify{" "}
                <span className="font-semibold text-[#2C2C2C]">
                  {declineDeal.name.trim() || "the client"}
                </span>{" "}
                that you are no longer pursuing this inquiry.
              </p>
              <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                Reason
                <select
                  value={declineReasonKey}
                  onChange={(e) =>
                    setDeclineReasonKey(e.target.value as (typeof DECLINE_REASON_OPTIONS)[number]["key"])
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-md"
                >
                  {DECLINE_REASON_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={declineBusy}
                  onClick={() => void submitDecline()}
                  className="flex-1 rounded-full bg-[#2C2C2C] py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
                >
                  {declineBusy ? "…" : "Send Decline & Archive"}
                </button>
                <button
                  type="button"
                  disabled={declineBusy}
                  onClick={() => setDeclineDeal(null)}
                  className="flex-1 rounded-full border border-[#2C2C2C]/15 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
