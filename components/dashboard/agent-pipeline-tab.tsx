"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
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
import {
  Archive,
  ArrowRightCircle,
  Calendar,
  CircleCheck,
  Eye,
  FileText,
  Filter,
  Handshake,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pin,
  Pencil,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/relative-time";
import { propertyCanonicalCity } from "@/lib/normalize-city";
import { cn } from "@/lib/utils";
import { isClientDocumentType, labelForClientDocType } from "@/lib/client-documents";

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
  pinned?: boolean | null;
  pinned_at?: string | null;
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
const KANBAN_STAGE_ORDER: PipelineStageId[] = ["lead", "viewing", "offer", "reservation", "closed"];

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
  id: string;
  created_at: string;
  document_type: string;
  document_name: string | null;
  file_url: string | null;
  file_name: string | null;
  status: string;
  required: boolean | null;
  suggested_for_stage: string | null;
  direction: string | null;
  viewed_by_agent_at: string | null;
};

function labelDealPipelineDoc(row: DealDocCheckRow): string {
  const name = row.document_name?.trim();
  if (name) return name;
  const t = (row.document_type ?? "").trim();
  if (!t) return "Document";
  const base = t.startsWith("other:") ? "other" : t;
  if (isClientDocumentType(base)) return labelForClientDocType(base);
  return t;
}

function dealDocPipelineStatusLabel(status: string, fileUrl: string | null | undefined): string {
  const s = status.trim().toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "uploaded" && fileUrl?.trim()) return "Received";
  if (s === "uploaded") return "Uploaded";
  if (s === "pending") return "Awaiting client";
  return status;
}

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

type PipelineSortMode =
  | "last_activity_desc"
  | "last_activity_asc"
  | "date_added_desc"
  | "date_added_asc"
  | "name_asc"
  | "name_desc"
  | "city_asc"
  | "city_desc";

type PropertyMeta = { city: string; location: string };

function tsOr0(raw: string | null | undefined): number {
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function leadLastActivityTs(lead: PipelineLeadRow): number {
  return tsOr0(lead.updated_at ?? lead.created_at);
}

function leadDateAddedTs(lead: PipelineLeadRow): number {
  return tsOr0(lead.created_at);
}

function leadPinnedFirst(a: PipelineLeadRow, b: PipelineLeadRow): number {
  const ap = Boolean(a.pinned);
  const bp = Boolean(b.pinned);
  if (ap !== bp) return ap ? -1 : 1;

  if (ap && bp) {
    const at = tsOr0(a.pinned_at);
    const bt = tsOr0(b.pinned_at);
    if (at !== bt) return bt - at;
  }

  return 0;
}

/** Sort deals within a stage. Pinned always win; then apply selected sort; then manual position. */
function sortDealsInStage(params: {
  sortMode: PipelineSortMode;
  propertyMetaById: Record<string, PropertyMeta>;
}): (a: PipelineLeadRow, b: PipelineLeadRow) => number {
  const { sortMode, propertyMetaById } = params;
  return (a, b) => {
    const pinCmp = leadPinnedFirst(a, b);
    if (pinCmp !== 0) return pinCmp;

    const propA = a.property_id ? propertyMetaById[a.property_id] : undefined;
    const propB = b.property_id ? propertyMetaById[b.property_id] : undefined;
    const cityA = (propA?.city ?? "").toLocaleLowerCase();
    const cityB = (propB?.city ?? "").toLocaleLowerCase();
    const nameA = (a.name ?? "").toLocaleLowerCase();
    const nameB = (b.name ?? "").toLocaleLowerCase();

    switch (sortMode) {
      case "last_activity_desc": {
        const d = leadLastActivityTs(b) - leadLastActivityTs(a);
        if (d !== 0) return d;
        break;
      }
      case "last_activity_asc": {
        const d = leadLastActivityTs(a) - leadLastActivityTs(b);
        if (d !== 0) return d;
        break;
      }
      case "date_added_desc": {
        const d = leadDateAddedTs(b) - leadDateAddedTs(a);
        if (d !== 0) return d;
        break;
      }
      case "date_added_asc": {
        const d = leadDateAddedTs(a) - leadDateAddedTs(b);
        if (d !== 0) return d;
        break;
      }
      case "name_asc": {
        const d = nameA.localeCompare(nameB);
        if (d !== 0) return d;
        break;
      }
      case "name_desc": {
        const d = nameB.localeCompare(nameA);
        if (d !== 0) return d;
        break;
      }
      case "city_asc": {
        const d = cityA.localeCompare(cityB);
        if (d !== 0) return d;
        break;
      }
      case "city_desc": {
        const d = cityB.localeCompare(cityA);
        if (d !== 0) return d;
        break;
      }
    }

    const pa = a.pipeline_position ?? 0;
    const pb = b.pipeline_position ?? 0;
    if (pa !== pb) return pa - pb;
    return leadDateAddedTs(b) - leadDateAddedTs(a);
  };
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

/** Column accent (mockup): Lead & Reservation sage, Viewing charcoal, Offer gold, Closed charcoal. */
function stageBarHex(stage: PipelineStageId): string {
  switch (stage) {
    case "lead":
      return "#6B9E6E";
    case "viewing":
      return "#2C2C2C";
    case "offer":
      return "#D4A843";
    case "reservation":
      return "#6B9E6E";
    case "closed":
      return "#2C2C2C";
    default:
      return "#2C2C2C";
  }
}

function pipelineColumnEmptyIcon(stage: PipelineStageId) {
  const ring =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FAF8F4] ring-1 ring-[#2C2C2C]/08";
  const ic = "h-5 w-5 text-[#2C2C2C]/30";
  switch (stage) {
    case "lead":
      return (
        <span className={ring}>
          <User className={ic} aria-hidden />
        </span>
      );
    case "viewing":
      return (
        <span className={ring}>
          <Calendar className={ic} aria-hidden />
        </span>
      );
    case "offer":
      return (
        <span className={ring}>
          <FileText className={ic} aria-hidden />
        </span>
      );
    case "reservation":
      return (
        <span className={ring}>
          <Handshake className={ic} aria-hidden />
        </span>
      );
    case "closed":
      return (
        <span className={ring}>
          <CircleCheck className={ic} aria-hidden />
        </span>
      );
    default:
      return (
        <span className={ring}>
          <User className={ic} aria-hidden />
        </span>
      );
  }
}

function KanbanDealCard({
  deal,
  indexInStage,
  propertyLabel,
  dealValueLine,
  pinned,
  uploadedRequestedDocCount,
  unviewedUploadedDocCount,
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
  onTogglePin,
  onMoveToStage,
  moveBusyId,
}: {
  deal: PipelineLeadRow;
  indexInStage: number;
  propertyLabel: (propertyId: string | null) => string;
  dealValueLine: string | null;
  pinned: boolean;
  /** Client-uploaded pipeline documents (requested row, status uploaded). */
  uploadedRequestedDocCount: number;
  /** Subset of uploaded client docs the agent has not acknowledged in the drawer yet. */
  unviewedUploadedDocCount: number;
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
  onTogglePin: (lead: PipelineLeadRow) => void;
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
  const menuOpen = menuOpenId === deal.id;
  const otherStages = PIPELINE_STAGES.filter((s) => s.id !== deal.pipeline_stage);
  const anyMenuOpen = menuOpenId != null;

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [menuOpenUp, setMenuOpenUp] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      setMenuAnchorRect(null);
      setMenuOpenUp(false);
      return;
    }

    const update = () => {
      const el = menuButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuAnchorRect(rect);
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuOpenUp(spaceBelow < 250);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [menuOpen]);

  const styleWithZ = {
    ...style,
    zIndex: isDragging ? 50 : menuOpen ? 9998 : style.zIndex,
  } as const;

  return (
    <div ref={setNodeRef} style={styleWithZ} className="relative">
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "relative rounded-lg border border-[#2C2C2C]/10 bg-white p-3 shadow-sm transition",
          next ? "pb-10" : "",
          "cursor-grab",
          isDragging && "scale-[1.02] rotate-[0.6deg] cursor-grabbing shadow-xl",
        )}
        onClick={() => onOpenLeadDetails(deal.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onOpenLeadDetails(deal.id);
        }}
      >
        <div className="touch-none pr-10">
          {/* Row 1: Title + Menu */}
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLeadDetails(deal.id);
              }}
            >
              <p
                className="font-sans text-[14px] font-bold leading-snug text-[#2C2C2C]"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {propLine}
              </p>
            </button>

            <div className="pointer-events-auto shrink-0">
              {/* Pinned top-right controls */}
              <div
                ref={menuOpen ? menuWrapRef : undefined}
                className="absolute right-2 top-2 z-10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {pinned ? <Pin className="absolute -right-0.5 -top-0.5 h-4 w-4 text-[#6B9E6E]" aria-label="Pinned" /> : null}
                <button
                  type="button"
                  aria-label="More options"
                  aria-expanded={menuOpen}
                  data-kanban-menu-button="true"
                  ref={menuButtonRef}
                  onClick={() => {
                    setMenuMoveOpen(false);
                    setMenuOpenId(menuOpen ? null : deal.id);
                  }}
                  className={cn(
                    "rounded-lg p-1.5 text-[#2C2C2C]/45 focus-visible:outline-none focus-visible:ring-0",
                    !menuOpen && "hover:bg-black/5 hover:text-[#2C2C2C]/70",
                    menuOpen && "bg-transparent text-[#2C2C2C]/55",
                    "active:bg-transparent",
                  )}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>

                {menuOpen && menuAnchorRect && typeof document !== "undefined"
                  ? createPortal(
                      <AnimatePresence>
                        <motion.div
                          data-kanban-portal-menu="true"
                          initial={{ opacity: 0, y: menuOpenUp ? 4 : -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: menuOpenUp ? 4 : -4 }}
                          transition={{ duration: 0.12 }}
                          style={{
                            position: "fixed",
                            top: menuOpenUp ? menuAnchorRect.top - 8 : menuAnchorRect.bottom + 8,
                            left: Math.max(12, Math.min(window.innerWidth - 12 - 200, menuAnchorRect.right - 200)),
                            transform: menuOpenUp ? "translateY(-100%)" : undefined,
                          }}
                          className="z-[9999] w-[200px] max-w-[calc(100vw-24px)] rounded-lg border border-[#E5E5E5] bg-white p-1.5 text-[#2C2C2C] shadow-lg"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!menuMoveOpen ? (
                            <div className="space-y-0.5">
                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => {
                                  onTogglePin(deal);
                                  setMenuOpenId(null);
                                }}
                              >
                                <Pin
                                  className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                  aria-hidden
                                />
                                {pinned ? "Unpin" : "Pin to top"}
                              </button>
                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => {
                                  onOpenLeadDetails(deal.id);
                                  setMenuOpenId(null);
                                }}
                              >
                                <Eye
                                  className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                  aria-hidden
                                />
                                View Details
                              </button>
                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => {
                                  onOpenDocs(deal);
                                  setMenuOpenId(null);
                                }}
                              >
                                <FileText
                                  className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                  aria-hidden
                                />
                                View Documents
                                {uploadedRequestedDocCount > 0 ? (
                                  <span className="ml-auto rounded-full bg-[#6B9E6E] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                                    {uploadedRequestedDocCount}
                                  </span>
                                ) : null}
                              </button>
                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => {
                                  onRequestNotes(deal);
                                  setMenuOpenId(null);
                                }}
                              >
                                <Pencil
                                  className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                  aria-hidden
                                />
                                Edit Notes
                              </button>
                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => {
                                  onRequestDocuments(deal);
                                  setMenuOpenId(null);
                                }}
                              >
                                <FileText
                                  className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                  aria-hidden
                                />
                                Request Documents
                              </button>

                              <div className="my-1 h-px bg-[#EEEEEE]" />

                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#B85450] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => {
                                  onRequestDecline(deal);
                                  setMenuOpenId(null);
                                  setMenuMoveOpen(false);
                                }}
                              >
                                <Archive className="h-4 w-4 shrink-0 text-[#B85450]" aria-hidden />
                                Decline &amp; Archive
                              </button>

                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => setMenuMoveOpen(true)}
                              >
                                <ArrowRightCircle
                                  className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                  aria-hidden
                                />
                                Move to…
                              </button>
                            </div>
                          ) : (
                            <div className="max-h-56 overflow-y-auto">
                              <button
                                type="button"
                                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12px] font-bold text-[#2C2C2C]/60 transition-colors duration-150 hover:bg-[#F0F4F0]"
                                onClick={() => setMenuMoveOpen(false)}
                              >
                                ← Back
                              </button>
                              <div className="mt-1 space-y-0.5">
                                {otherStages.map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    disabled={moveBusyId === deal.id}
                                    className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0] disabled:opacity-50"
                                    onClick={() => {
                                      onBeginStageMove(deal, s.id, "jump");
                                      setMenuOpenId(null);
                                      setMenuMoveOpen(false);
                                    }}
                                  >
                                    <ArrowRightCircle
                                      className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                      aria-hidden
                                    />
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>,
                      document.body,
                    )
                  : null}
              </div>

              {null}
            </div>
          </div>

          {/* Row 2: Price */}
          <p className="mt-1 font-sans text-[13px] font-bold text-[#D4A843]">{dealValueLine ?? "—"}</p>
          {/* Row 3: Avatar + contact */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/15 text-[10px] font-bold text-[#6B9E6E]">
              {clientInitials(deal.name)}
            </div>
            <span className="truncate font-sans text-[12px] font-semibold text-[#2C2C2C]/65">{deal.name}</span>
          </div>
        </div>

        {uploadedRequestedDocCount > 0 ? (
          <button
            type="button"
            aria-label={`${uploadedRequestedDocCount} document${uploadedRequestedDocCount === 1 ? "" : "s"} from client — open documents`}
            title="Client uploaded document(s) for this deal"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDocs(deal);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              "absolute z-[5] flex min-w-[1.5rem] items-center justify-center gap-0.5 rounded-full border border-[#6B9E6E]/40 bg-[#6B9E6E]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#2d5a30] shadow-sm hover:bg-[#6B9E6E]/22",
              unviewedUploadedDocCount > 0 && "bhg-doc-badge-pulse relative",
              next ? "bottom-12 left-2" : "bottom-2.5 left-2",
              anyMenuOpen && "pointer-events-none opacity-0",
            )}
          >
            {unviewedUploadedDocCount > 0 ? (
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 z-[1] h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-white"
                aria-hidden
              />
            ) : null}
            <FileText className="h-3 w-3 shrink-0" aria-hidden />
            <span className="tabular-nums">{uploadedRequestedDocCount}</span>
          </button>
        ) : null}

        {next ? (
          <button
            type="button"
            aria-label={`Advance to ${PIPELINE_STAGES.find((s) => s.id === next)?.label ?? "next stage"}`}
            onClick={(e) => {
              e.stopPropagation();
              onMoveToStage(deal, next);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              "absolute bottom-3 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#6B9E6E] text-white shadow-sm hover:bg-[#5a8a5d]",
              anyMenuOpen && "opacity-0 pointer-events-none",
            )}
          >
            <span aria-hidden className="text-base leading-none">
              ›
            </span>
          </button>
        ) : null}

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

function stageContainerId(stage: PipelineStageId): string {
  return `stage:${stage}`;
}

function KanbanStageColumn({
  stage,
  idx,
  label,
  count,
  total,
  showTotal,
  barHex,
  ids,
  list,
  propertyLabel,
  dealValueByPropertyId,
  uploadedRequestedDocCountByLeadId,
  unviewedUploadedDocCountByLeadId,
  stageMovePrompt,
  onStageMovePromptSkip,
  onStageMovePromptYes,
  beginStageMove,
  openDocs,
  menuOpenId,
  setMenuOpenId,
  menuMoveOpen,
  setMenuMoveOpen,
  menuWrapRef,
  onOpenLeadDetails,
  setNotesLead,
  setNotesDraft,
  setRequestDocsLead,
  setReqDocSelections,
  setDeclineDeal,
  onTogglePin,
  moveDealToStage,
  moveToStageBusyId,
}: {
  stage: PipelineStageId;
  idx: number;
  label: string;
  count: number;
  total: number;
  showTotal: boolean;
  barHex: string;
  ids: string[];
  list: PipelineLeadRow[];
  propertyLabel: (propertyId: string | null) => string;
  dealValueByPropertyId: Record<string, string>;
  uploadedRequestedDocCountByLeadId: Record<number, number>;
  unviewedUploadedDocCountByLeadId: Record<number, number>;
  stageMovePrompt: { lead: PipelineLeadRow; targetStage: PipelineStageId; kind: "advance" | "jump" } | null;
  onStageMovePromptSkip: () => void;
  onStageMovePromptYes: (lead: PipelineLeadRow, targetStage: PipelineStageId) => void;
  beginStageMove: (lead: PipelineLeadRow, targetStage: PipelineStageId, kind: "advance" | "jump") => void;
  openDocs: (lead: PipelineLeadRow) => void;
  menuOpenId: number | null;
  setMenuOpenId: (id: number | null) => void;
  menuMoveOpen: boolean;
  setMenuMoveOpen: (v: boolean) => void;
  menuWrapRef: React.RefObject<HTMLDivElement | null>;
  onOpenLeadDetails: (leadId: number) => void;
  setNotesLead: (d: PipelineLeadRow | null) => void;
  setNotesDraft: (v: string) => void;
  setRequestDocsLead: (d: PipelineLeadRow | null) => void;
  setReqDocSelections: React.Dispatch<
    React.SetStateAction<{ valid_id: boolean; proof_of_funds: boolean; visa: boolean; other: boolean }>
  >;
  setDeclineDeal: (d: PipelineLeadRow | null) => void;
  onTogglePin: (lead: PipelineLeadRow) => void;
  moveDealToStage: (lead: PipelineLeadRow, stage: PipelineStageId) => void;
  moveToStageBusyId: number | null;
}) {
  const containerId = stageContainerId(stage);
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  return (
    <div
      key={stage}
      className={cn("min-w-0 flex-1 px-2", idx > 0 && "border-l border-[#2C2C2C]/10")}
    >
      <div className="sticky top-0 z-10 overflow-hidden rounded-lg border border-[#2C2C2C]/10 bg-white">
        <div aria-hidden className="h-1 w-full" style={{ backgroundColor: barHex }} />
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate font-sans text-base font-bold tracking-tight text-[#2C2C2C]">{label}</p>
            <span className="shrink-0 rounded-full bg-[#FAF8F4] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[#2C2C2C] ring-1 ring-[#2C2C2C]/10">
              {count}
            </span>
          </div>
          <p className="mt-1 font-sans text-xs font-semibold text-[#2C2C2C]/50">
            {showTotal ? `${formatPesoCompact(total)} - ` : ""}
            {count} deal{count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "mt-3 min-h-[140px] rounded-lg transition-colors",
          isOver ? "bg-[#6B9E6E]/8" : "bg-transparent",
        )}
      >
        {list.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-[#2C2C2C]/12 bg-white px-4 py-8 text-center">
            {pipelineColumnEmptyIcon(stage)}
            <p className="mt-4 font-sans text-sm font-bold text-[#2C2C2C]">No deals yet</p>
            <p className="mt-1 max-w-[200px] font-sans text-xs font-medium leading-snug text-[#2C2C2C]/50">
              Deals in this stage will appear here.
            </p>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="mt-6 font-sans text-sm font-semibold text-[#2C2C2C]/40"
            >
              + Add deal
            </button>
          </div>
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pb-2">
              {list.map((deal, i) => (
                <KanbanDealCard
                  key={deal.id}
                  deal={deal}
                  indexInStage={i}
                  propertyLabel={propertyLabel}
                  dealValueLine={deal.property_id ? dealValueByPropertyId[deal.property_id] ?? null : null}
                  pinned={Boolean(deal.pinned)}
                  uploadedRequestedDocCount={uploadedRequestedDocCountByLeadId[deal.id] ?? 0}
                  unviewedUploadedDocCount={unviewedUploadedDocCountByLeadId[deal.id] ?? 0}
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
                  onTogglePin={onTogglePin}
                  onMoveToStage={moveDealToStage}
                  moveBusyId={moveToStageBusyId}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function SortableDealCard({
  deal,
  indexInStage,
  propertyLabel,
  dealValueLine,
  pinned,
  uploadedRequestedDocCount,
  unviewedUploadedDocCount,
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
  onTogglePin,
  onMoveToStage,
  moveBusyId,
}: {
  deal: PipelineLeadRow;
  indexInStage: number;
  propertyLabel: (propertyId: string | null) => string;
  dealValueLine: string | null;
  pinned: boolean;
  uploadedRequestedDocCount: number;
  unviewedUploadedDocCount: number;
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
  onTogglePin: (lead: PipelineLeadRow) => void;
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
  const menuOpen = menuOpenId === deal.id;
  const isArchived = String((deal as unknown as { pipeline_stage?: unknown }).pipeline_stage ?? "")
    .trim()
    .toLowerCase() === "declined" || deal.pipeline_stage === "closed";
  const updatedIso = (deal.updated_at ?? deal.created_at) as string;
  const updatedMs = new Date(updatedIso).getTime();
  const createdMs = new Date(deal.created_at).getTime();
  const now = Date.now();
  const otherStages = PIPELINE_STAGES.filter((s) => s.id !== deal.pipeline_stage);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border border-[#2C2C2C]/10 bg-white p-4 shadow-sm ${
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
              {pinned ? <Pin className="h-4 w-4 text-[#6B9E6E]" aria-label="Pinned" /> : null}
              {null}
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
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold hover:bg-gray-50"
                      onClick={() => {
                        onTogglePin(deal);
                        setMenuOpenId(null);
                      }}
                    >
                      <Pin className="h-4 w-4 text-[#6B9E6E]" aria-hidden />
                      {pinned ? "Unpin" : "Pin to top"}
                    </button>
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
                        onOpenDocs(deal);
                        setMenuOpenId(null);
                      }}
                    >
                      <FileText className="h-4 w-4 text-[#6B9E6E]" aria-hidden />
                      View Documents
                      {uploadedRequestedDocCount > 0 ? (
                        <span className="ml-auto rounded-full bg-[#6B9E6E] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                          {uploadedRequestedDocCount}
                        </span>
                      ) : null}
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
          className={cn(
            "relative flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50",
            unviewedUploadedDocCount > 0 && "bhg-doc-badge-pulse",
          )}
        >
          📄 View Documents
          {uploadedRequestedDocCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6B9E6E] px-1 text-[10px] font-bold text-white tabular-nums">
              {unviewedUploadedDocCount > 0 ? (
                <span
                  className="pointer-events-none absolute -right-0.5 -top-0.5 z-[1] h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-white"
                  aria-hidden
                />
              ) : null}
              <span className="tabular-nums">{uploadedRequestedDocCount}</span>
            </span>
          ) : null}
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
  const sortStorageKey = useMemo(() => `bhg:pipeline:sort:${pipelineAgentId}`, [pipelineAgentId]);
  const [sortMode, setSortMode] = useState<PipelineSortMode>("last_activity_desc");
  const [filterStages, setFilterStages] = useState<PipelineStageId[] | null>(null);
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [optimisticPinById, setOptimisticPinById] = useState<Record<number, { pinned: boolean; pinned_at: string | null }>>({});

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(sortStorageKey);
      if (!v) return;
      const allowed: PipelineSortMode[] = [
        "last_activity_desc",
        "last_activity_asc",
        "date_added_desc",
        "date_added_asc",
        "name_asc",
        "name_desc",
        "city_asc",
        "city_desc",
      ];
      if (allowed.includes(v as PipelineSortMode)) setSortMode(v as PipelineSortMode);
    } catch {
      // ignore
    }
  }, [sortStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(sortStorageKey, sortMode);
    } catch {
      // ignore
    }
  }, [sortMode, sortStorageKey]);

  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);
  const [kanbanFadeRight, setKanbanFadeRight] = useState(false);
  const [activeKanbanDealId, setActiveKanbanDealId] = useState<string | null>(null);
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
  const [propertyMetaById, setPropertyMetaById] = useState<Record<string, PropertyMeta>>({});

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
        .select("id, city, location, price, rent_price, listing_type, status")
        .in("id", ids);
      if (cancelled) return;
      if (error) {
        setDealValueByPropertyId({});
        setDealValueNumberByPropertyId({});
        setPropertyMetaById({});
        return;
      }
      const next: Record<string, string> = {};
      const nextN: Record<string, number> = {};
      const meta: Record<string, PropertyMeta> = {};
      for (const row of (data ?? []) as {
        id: string;
        city: string | null;
        location: string | null;
        price: unknown;
        rent_price: unknown;
        listing_type: unknown;
        status: unknown;
      }[]) {
        const location = String(row.location ?? "").trim();
        const canonicalCity = propertyCanonicalCity({ city: row.city, location });
        meta[row.id] = { city: canonicalCity, location };

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
      setPropertyMetaById(meta);
    })();
    return () => {
      cancelled = true;
    };
  }, [deals, supabase]);

  const [filterStage, setFilterStage] = useState<PipelineStageId>("lead");
  const [docsLead, setDocsLead] = useState<PipelineLeadRow | null>(null);
  const [clientDocRows, setClientDocRows] = useState<ClientDocRow[]>([]);
  const [dealDocCheckRows, setDealDocCheckRows] = useState<DealDocCheckRow[]>([]);
  const [uploadedRequestedDocCountByLeadId, setUploadedRequestedDocCountByLeadId] = useState<
    Record<number, number>
  >({});
  const [unviewedUploadedDocCountByLeadId, setUnviewedUploadedDocCountByLeadId] = useState<
    Record<number, number>
  >({});
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsPanelFlow, setDocsPanelFlow] = useState<"idle" | "request" | "send">("idle");
  const [panelDocSlug, setPanelDocSlug] = useState("");
  const [requestRequired, setRequestRequired] = useState(false);
  const [sendRequired, setSendRequired] = useState(false);
  const [sendFileUrls, setSendFileUrls] = useState<string[]>([]);
  const [requestFlowBusy, setRequestFlowBusy] = useState(false);
  const [sendFlowBusy, setSendFlowBusy] = useState(false);
  const [clientDocOpeningId, setClientDocOpeningId] = useState<string | null>(null);
  const [dealDocOpeningId, setDealDocOpeningId] = useState<string | null>(null);
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
  const [reqOtherDocumentName, setReqOtherDocumentName] = useState("");
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      if (!d.property_id) continue;
      const c = propertyMetaById[d.property_id]?.city ?? "";
      if (c.trim()) set.add(c.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [deals, propertyMetaById]);

  const activeFilterCount = useMemo(() => {
    const stageCount = filterStages ? filterStages.length : 0;
    return stageCount + filterCities.length;
  }, [filterStages, filterCities.length]);

  const togglePin = useCallback(
    async (lead: PipelineLeadRow) => {
      const leadId = lead.id;
      const nextPinned = !Boolean(lead.pinned);
      const optimisticAt = nextPinned ? new Date().toISOString() : null;
      setOptimisticPinById((prev) => ({ ...prev, [leadId]: { pinned: nextPinned, pinned_at: optimisticAt } }));
      try {
        const res = await fetch(`/api/agent/leads/${leadId}/pin`, { method: "POST", credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as {
          pinned?: boolean;
          pinned_at?: string | null;
          error?: string;
        };
        if (!res.ok) {
          toast.error(json.error ?? "Could not update pin");
          setOptimisticPinById((prev) => {
            const { [leadId]: _omit, ...rest } = prev;
            return rest;
          });
          return;
        }
        setOptimisticPinById((prev) => ({
          ...prev,
          [leadId]: { pinned: Boolean(json.pinned), pinned_at: json.pinned_at ?? null },
        }));
        void onRefresh();
      } catch {
        setOptimisticPinById((prev) => {
          const { [leadId]: _omit, ...rest } = prev;
          return rest;
        });
        toast.error("Could not update pin");
      }
    },
    [onRefresh],
  );

  useEffect(() => {
    if (requestDocsLead) setReqOtherDocumentName("");
  }, [requestDocsLead?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
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
      const t = e.target as Node | null;
      if (!t) return;

      // Portal menus render outside `menuWrapRef`, so we must treat them as "inside" clicks.
      const portalMenu =
        t instanceof Element ? (t as Element).closest("[data-kanban-portal-menu='true']") : null;
      if (portalMenu) return;

      // Backdrop overlay is also outside `menuWrapRef` but should not instantly dismiss before item clicks.
      const backdrop =
        t instanceof Element ? (t as Element).closest("[data-kanban-menu-backdrop='true']") : null;
      if (backdrop) return;

      const el = menuWrapRef.current;
      if (el && !el.contains(t)) {
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

  const effectiveDeals = useMemo(() => {
    const stageSet = filterStages && filterStages.length > 0 ? new Set(filterStages) : null;
    const citySet = filterCities.length > 0 ? new Set(filterCities.map((c) => c.toLocaleLowerCase())) : null;
    return deals
      .map((d) => {
        const optimistic = optimisticPinById[d.id];
        return optimistic ? { ...d, pinned: optimistic.pinned, pinned_at: optimistic.pinned_at } : d;
      })
      .filter((d) => (stageSet ? stageSet.has(d.pipeline_stage) : true))
      .filter((d) => {
        if (!citySet) return true;
        if (!d.property_id) return false;
        const c = (propertyMetaById[d.property_id]?.city ?? "").toLocaleLowerCase();
        return c ? citySet.has(c) : false;
      });
  }, [deals, filterStages, filterCities, optimisticPinById, propertyMetaById]);

  const stageSorter = useMemo(() => sortDealsInStage({ sortMode, propertyMetaById }), [propertyMetaById, sortMode]);

  const baseSorted = useMemo(() => {
    return effectiveDeals.filter((d) => d.pipeline_stage === filterStage).slice().sort(stageSorter);
  }, [effectiveDeals, filterStage, stageSorter]);

  const dealsByStage = useMemo(() => {
    const m: Record<PipelineStageId, PipelineLeadRow[]> = {
      lead: [],
      viewing: [],
      offer: [],
      reservation: [],
      closed: [],
    };
    for (const d of effectiveDeals) m[d.pipeline_stage].push(d);
    for (const s of STAGE_ORDER) m[s] = m[s].slice().sort(stageSorter);
    return m;
  }, [effectiveDeals, stageSorter]);

  const leadById = useMemo(() => {
    const m = new Map<string, PipelineLeadRow>();
    for (const d of effectiveDeals) m.set(String(d.id), d);
    return m;
  }, [effectiveDeals]);

  const [kanbanIdsByStage, setKanbanIdsByStage] = useState<Record<PipelineStageId, string[]>>({
    lead: [],
    viewing: [],
    offer: [],
    reservation: [],
    closed: [],
  });

  useEffect(() => {
    setKanbanIdsByStage({
      lead: dealsByStage.lead.map((d) => String(d.id)),
      viewing: dealsByStage.viewing.map((d) => String(d.id)),
      offer: dealsByStage.offer.map((d) => String(d.id)),
      reservation: dealsByStage.reservation.map((d) => String(d.id)),
      closed: dealsByStage.closed.map((d) => String(d.id)),
    });
  }, [dealsByStage]);

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

  const allDealsTotal = useMemo(() => {
    let total = 0;
    for (const s of STAGE_ORDER) total += stageTotals[s]?.total ?? 0;
    return total;
  }, [stageTotals]);
  const allDealsCount = useMemo(() => effectiveDeals.length, [effectiveDeals.length]);

  const [pipelineKey, setPipelineKey] = useState("default");
  const pipelineOptions = useMemo(() => [{ id: "default", label: "Default Pipeline" }], []);

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

  useEffect(() => {
    const leadIds = deals.map((d) => d.id).filter((id): id is number => typeof id === "number");
    if (leadIds.length === 0) {
      setUploadedRequestedDocCountByLeadId({});
      setUnviewedUploadedDocCountByLeadId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("deal_documents")
        .select("lead_id, viewed_by_agent_at")
        .in("lead_id", leadIds)
        .eq("direction", "requested")
        .eq("status", "uploaded")
        .not("file_url", "is", null);
      if (cancelled) return;
      if (error) {
        setUploadedRequestedDocCountByLeadId({});
        setUnviewedUploadedDocCountByLeadId({});
        return;
      }
      const uploadedNext: Record<number, number> = {};
      const unviewedNext: Record<number, number> = {};
      for (const row of (data ?? []) as { lead_id: number; viewed_by_agent_at: string | null }[]) {
        const lid = row.lead_id;
        if (typeof lid !== "number" || !Number.isFinite(lid)) continue;
        uploadedNext[lid] = (uploadedNext[lid] ?? 0) + 1;
        if (row.viewed_by_agent_at == null) {
          unviewedNext[lid] = (unviewedNext[lid] ?? 0) + 1;
        }
      }
      setUploadedRequestedDocCountByLeadId(uploadedNext);
      setUnviewedUploadedDocCountByLeadId(unviewedNext);
    })();
    return () => {
      cancelled = true;
    };
  }, [deals, supabase]);

  const loadDocs = useCallback(
    async (lead: PipelineLeadRow) => {
      setDocsLoading(true);
      try {
        const { data: dealData, error: dealErr } = await supabase
          .from("deal_documents")
          .select(
            "id, created_at, document_type, document_name, file_url, file_name, status, required, suggested_for_stage, direction, viewed_by_agent_at",
          )
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false });

        if (dealErr) {
          toast.error(dealErr.message);
          setDealDocCheckRows([]);
          setUploadedRequestedDocCountByLeadId((prev) => ({ ...prev, [lead.id]: 0 }));
          setUnviewedUploadedDocCountByLeadId((prev) => ({ ...prev, [lead.id]: 0 }));
        } else {
          const rows = (dealData ?? []) as DealDocCheckRow[];
          setDealDocCheckRows(rows);
          const isUploadedRequested = (r: DealDocCheckRow) =>
            (r.direction ?? "").trim().toLowerCase() === "requested" &&
            (r.status ?? "").trim().toLowerCase() === "uploaded" &&
            Boolean(r.file_url?.trim());
          const uploadedForLead = rows.filter(isUploadedRequested).length;
          const unviewedForLead = rows.filter(
            (r) => isUploadedRequested(r) && r.viewed_by_agent_at == null,
          ).length;
          setUploadedRequestedDocCountByLeadId((prev) => ({ ...prev, [lead.id]: uploadedForLead }));
          setUnviewedUploadedDocCountByLeadId((prev) => ({ ...prev, [lead.id]: unviewedForLead }));
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

  const markDealDocumentsViewedForLead = useCallback(async (leadId: number) => {
    try {
      const res = await fetch("/api/agent/mark-deal-documents-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (!res.ok) return;
      setUnviewedUploadedDocCountByLeadId((prev) => ({ ...prev, [leadId]: 0 }));
    } catch {
      // ignore — drawer still opens; rows refresh via loadDocs
    }
  }, []);

  const markViewedThenReloadDocs = useCallback(
    async (lead: PipelineLeadRow) => {
      await markDealDocumentsViewedForLead(lead.id);
      await loadDocs(lead);
    },
    [markDealDocumentsViewedForLead, loadDocs],
  );

  const openDocs = useCallback(
    (lead: PipelineLeadRow) => {
      setDocsLead(lead);
      setDocsPanelFlow("idle");
      setPanelDocSlug("");
      setRequestRequired(false);
      setSendRequired(false);
      setSendFileUrls([]);
      setClientDocRows([]);
      setDealDocCheckRows([]);
      void markViewedThenReloadDocs(lead);
    },
    [markViewedThenReloadDocs],
  );

  const openDocsWithRequestPrefill = useCallback(
    (lead: PipelineLeadRow, slug: string) => {
      setDocsLead(lead);
      setDocsPanelFlow("request");
      setPanelDocSlug(PANEL_DOC_BY_SLUG[slug] ? slug : "");
      setRequestRequired(false);
      setSendRequired(false);
      setSendFileUrls([]);
      setClientDocRows([]);
      setDealDocCheckRows([]);
      void markViewedThenReloadDocs(lead);
    },
    [markViewedThenReloadDocs],
  );

  const openAgentDealDocumentUrl = async (doc: DealDocCheckRow) => {
    const path = doc.file_url?.trim();
    if (!path) {
      toast.error("No file on this document yet.");
      return;
    }
    setDealDocOpeningId(doc.id);
    try {
      const res = await fetch("/api/agent/get-deal-document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ file_url: path }),
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
      setDealDocOpeningId(null);
    }
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
      void markViewedThenReloadDocs(lead);
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

  const handleKanbanDragStart = (event: DragStartEvent) => {
    setActiveKanbanDealId(event.active?.id ? String(event.active.id) : null);
  };

  const handleKanbanDragCancel = () => {
    setActiveKanbanDealId(null);
  };

  const handleKanbanDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveKanbanDealId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const findStageForId = (id: string): PipelineStageId | null => {
      for (const s of KANBAN_STAGE_ORDER) {
        if (kanbanIdsByStage[s].includes(id)) return s;
      }
      return null;
    };

    const fromStage = findStageForId(activeId);
    if (!fromStage) return;

    const toStage =
      overId.startsWith("stage:") ? (overId.slice("stage:".length) as PipelineStageId) : findStageForId(overId);
    if (!toStage || !KANBAN_STAGE_ORDER.includes(toStage)) return;

    if (fromStage === toStage) {
      const ids = kanbanIdsByStage[fromStage];
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const nextIds = arrayMove(ids, oldIndex, newIndex);
      setKanbanIdsByStage((s) => ({ ...s, [fromStage]: nextIds }));
      const payload = nextIds.map((x) => Number(x)).filter((n) => Number.isFinite(n));
      void (async () => {
        const res = await fetch("/api/agent/pipeline-reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pipeline_stage: fromStage, lead_ids: payload }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        if (!res.ok) toast.error(json?.error?.message ?? "Could not save order");
        else onRefresh();
      })();
      return;
    }

    setKanbanIdsByStage((s) => {
      const fromIds = s[fromStage].filter((x) => x !== activeId);
      const toIds = s[toStage];
      const overIndex = toIds.includes(overId) ? toIds.indexOf(overId) : toIds.length;
      const nextTo = toIds.slice();
      nextTo.splice(overIndex, 0, activeId);
      return { ...s, [fromStage]: fromIds, [toStage]: nextTo };
    });

    const lead = leadById.get(activeId);
    if (lead) void moveDealToStage(lead, toStage);
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
    const document_items = CLIENT_DOC_REQUEST_OPTIONS.filter((o) => reqDocSelections[o.key]).map(
      (o) =>
        o.key === "other"
          ? { type: "other" as const, document_name: reqOtherDocumentName.trim() }
          : { type: o.key },
    );
    if (document_items.length === 0) {
      toast.error("Select at least one document type.");
      return;
    }
    if (reqDocSelections.other && !reqOtherDocumentName.trim()) {
      toast.error('Add a name for "Other" before sending.');
      return;
    }
    setRequestDocsBusy(true);
    try {
      const res = await fetch("/api/agent/request-client-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lead_id: requestDocsLead.id, document_items }),
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

  useEffect(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;

    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const hasOverflow = maxScroll > 1;
      const atEnd = el.scrollLeft >= maxScroll - 1;
      setKanbanFadeRight(hasOverflow && !atEnd);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [deals.length, dealValueByPropertyId]);

  return (
    <div className="space-y-6 bg-[#FAF8F4] font-sans text-[#2C2C2C]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes bhg-doc-badge-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(107, 158, 110, 0); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 3px rgba(107, 158, 110, 0.22); }
}
.bhg-doc-badge-pulse { animation: bhg-doc-badge-pulse 2s ease-in-out infinite; will-change: transform; }
`,
        }}
      />
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Pipeline</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm font-medium leading-relaxed text-[#2C2C2C]/60">
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
      <div className="touch-pan-y space-y-3 overscroll-contain md:touch-auto lg:hidden">
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
                  pinned={Boolean(deal.pinned)}
                  uploadedRequestedDocCount={uploadedRequestedDocCountByLeadId[deal.id] ?? 0}
                  unviewedUploadedDocCount={unviewedUploadedDocCountByLeadId[deal.id] ?? 0}
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
                  onTogglePin={togglePin}
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
        <div className="relative -mx-1">
          {kanbanFadeRight ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-[#FAF8F4] to-transparent"
            />
          ) : null}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
                aria-label="Kanban view"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
                aria-label="List view"
              >
                <List className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="font-sans text-sm font-semibold text-[#2C2C2C]/55">
                {allDealsTotal > 0 ? `${formatPesoCompact(allDealsTotal)} • ` : ""}
                {allDealsCount} deal{allDealsCount === 1 ? "" : "s"}
              </span>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
                      aria-label="Sort"
                    >
                      Sort
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-[240px] border border-[#2C2C2C]/10 bg-[#FAF8F4] text-[#2C2C2C]"
                  >
                    <DropdownMenuLabel className="text-xs font-bold text-[#2C2C2C]/55">Sort</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {[
                      ["last_activity_desc", "Last activity (newest → oldest)"],
                      ["last_activity_asc", "Last activity (oldest → newest)"],
                      ["date_added_desc", "Date added (newest → oldest)"],
                      ["date_added_asc", "Date added (oldest → newest)"],
                      ["name_asc", "Name (A → Z)"],
                      ["name_desc", "Name (Z → A)"],
                      ["city_asc", "City (A → Z)"],
                      ["city_desc", "City (Z → A)"],
                    ].map(([id, label]) => (
                      <DropdownMenuItem
                        key={id}
                        onClick={() => setSortMode(id as PipelineSortMode)}
                        className={cn(
                          "font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12",
                          sortMode === id && "text-[#2C5F32]",
                        )}
                      >
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]",
                        activeFilterCount > 0 && "border-[#6B9E6E]/35 bg-[#6B9E6E]/10 text-[#2C5F32]",
                      )}
                      aria-label="Filters"
                    >
                      <Filter className="h-4 w-4" aria-hidden />
                      {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : "Filters"}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-[280px] border border-[#2C2C2C]/10 bg-[#FAF8F4] text-[#2C2C2C]"
                  >
                    <DropdownMenuItem
                      onClick={() => {
                        setFilterCities([]);
                        setFilterStages(null);
                      }}
                      className="font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12"
                    >
                      Reset filters
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    <DropdownMenuLabel className="text-xs font-bold text-[#2C2C2C]/55">By stage</DropdownMenuLabel>
                    {PIPELINE_STAGES.map((s) => (
                      <DropdownMenuCheckboxItem
                        key={s.id}
                        checked={filterStages ? filterStages.includes(s.id) : true}
                        onCheckedChange={(checked) => {
                          setFilterStages((prev) => {
                            const cur = prev ?? KANBAN_STAGE_ORDER.slice();
                            const next = checked ? [...new Set([...cur, s.id])] : cur.filter((x) => x !== s.id);
                            return next.length === KANBAN_STAGE_ORDER.length ? null : next;
                          });
                        }}
                        className="font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12"
                      >
                        {s.label}
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-bold text-[#2C2C2C]/55">By city</DropdownMenuLabel>
                    {availableCities.length === 0 ? (
                      <div className="px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/50">No cities found.</div>
                    ) : (
                      availableCities.map((c) => (
                        <DropdownMenuCheckboxItem
                          key={c}
                          checked={filterCities.includes(c)}
                          onCheckedChange={(checked) =>
                            setFilterCities((prev) =>
                              checked ? [...new Set([...prev, c])] : prev.filter((x) => x !== c),
                            )
                          }
                          className="font-semibold hover:bg-[#6B9E6E]/12 focus:bg-[#6B9E6E]/12"
                        >
                          {c}
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  disabled
                  className="rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-75"
                  title="Manual deal entry coming soon"
                >
                  + Add Lead
                </button>
                <select
                  value={pipelineKey}
                  onChange={(e) => setPipelineKey(e.target.value)}
                  className="rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
                  aria-label="Pipeline"
                >
                  {pipelineOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/55 hover:bg-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="More pipeline options"
                  title="Coming soon"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>
          <div
            ref={kanbanScrollRef}
            className="relative isolate overflow-x-auto bg-[#FAF8F4] px-1 py-4 scrollbar-hide"
          >
            {menuOpenId != null ? (
              <button
                type="button"
                aria-label="Close menu"
                data-kanban-menu-backdrop="true"
                className="absolute inset-0 z-[9000] bg-black/5"
                onClick={() => {
                  setMenuOpenId(null);
                  setMenuMoveOpen(false);
                }}
                onPointerDown={(e) => {
                  // Prevent underlying card clicks; allow one-click switching to another ⋯ menu.
                  const x = e.clientX;
                  const y = e.clientY;
                  setMenuOpenId(null);
                  setMenuMoveOpen(false);
                  requestAnimationFrame(() => {
                    const el = document.elementFromPoint(x, y) as HTMLElement | null;
                    const btn = el?.closest?.("[data-kanban-menu-button='true']") as HTMLElement | null;
                    btn?.click?.();
                  });
                }}
              />
            ) : null}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleKanbanDragStart}
              onDragCancel={handleKanbanDragCancel}
              onDragEnd={handleKanbanDragEnd}
            >
              <div className="flex w-full min-w-0 items-stretch gap-0">
                {(filterStages && filterStages.length > 0
                  ? KANBAN_STAGE_ORDER.filter((s) => filterStages.includes(s))
                  : KANBAN_STAGE_ORDER
                ).map((stage, idx) => {
                  const label = PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
                  const list = dealsByStage[stage];
                  const total = stageTotals[stage]?.total ?? 0;
                  const count = stageTotals[stage]?.count ?? list.length;
                  const ids = kanbanIdsByStage[stage] ?? list.map((d) => String(d.id));
                  const showTotal = total > 0;
                  const barHex = stageBarHex(stage);

                  return (
                    <KanbanStageColumn
                      key={stage}
                      stage={stage}
                      idx={idx}
                      label={label}
                      count={count}
                      total={total}
                      showTotal={showTotal}
                      barHex={barHex}
                      ids={ids}
                      list={ids.map((id) => leadById.get(String(id))).filter((d): d is PipelineLeadRow => !!d)}
                      propertyLabel={propertyLabel}
                      dealValueByPropertyId={dealValueByPropertyId}
                      uploadedRequestedDocCountByLeadId={uploadedRequestedDocCountByLeadId}
                      unviewedUploadedDocCountByLeadId={unviewedUploadedDocCountByLeadId}
                      stageMovePrompt={stageMovePrompt}
                      onStageMovePromptSkip={onStageMovePromptSkip}
                      onStageMovePromptYes={onStageMovePromptYes}
                      beginStageMove={beginStageMove}
                      openDocs={openDocs}
                      menuOpenId={menuOpenId}
                      setMenuOpenId={setMenuOpenId}
                      menuMoveOpen={menuMoveOpen}
                      setMenuMoveOpen={setMenuMoveOpen}
                      menuWrapRef={menuWrapRef}
                      onOpenLeadDetails={onOpenLeadDetails}
                      setNotesLead={setNotesLead}
                      setNotesDraft={setNotesDraft}
                      setRequestDocsLead={setRequestDocsLead}
                      setReqDocSelections={setReqDocSelections}
                      setDeclineDeal={setDeclineDeal}
                      onTogglePin={togglePin}
                      moveDealToStage={moveDealToStage}
                      moveToStageBusyId={moveToStageBusyId}
                    />
                  );
                })}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeKanbanDealId ? (
                  <div className="w-[220px]">
                    <div className="rounded-lg border border-[#2C2C2C]/10 bg-white p-3 shadow-2xl">
                      <div className="font-sans text-[12px] font-semibold text-[#2C2C2C]/60">Moving deal…</div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
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
                {reqDocSelections.other ? (
                  <div className="mt-2 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-3">
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#888888]">
                      Custom name (required)
                    </label>
                    <input
                      type="text"
                      value={reqOtherDocumentName}
                      onChange={(e) => setReqOtherDocumentName(e.target.value)}
                      placeholder="e.g. Employment certificate"
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/20"
                    />
                  </div>
                ) : null}
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

                {docsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" aria-hidden />
                  </div>
                ) : (
                  <>
                    <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                      Deal pipeline documents
                    </p>
                    {dealDocCheckRows.length === 0 ? (
                      <p className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 text-sm font-semibold text-[#2C2C2C]/65 shadow-sm">
                        No deal document requests yet. Use Request Documents to ask the client, or Send Document to
                        share a file.
                      </p>
                    ) : (
                      <ul className="mb-8 space-y-3">
                        {dealDocCheckRows.map((row) => {
                          const stLabel = dealDocPipelineStatusLabel(row.status, row.file_url);
                          const stClass =
                            stLabel === "Received" || stLabel === "Approved"
                              ? "bg-emerald-100 text-emerald-900 font-semibold"
                              : stLabel === "Awaiting client"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-[#2C2C2C]/10 text-[#2C2C2C]/75";
                          const dir = (row.direction ?? "").trim().toLowerCase();
                          const dirLabel =
                            dir === "requested"
                              ? "Requested from client"
                              : dir === "sent"
                                ? "Sent to client"
                                : dir || "—";
                          return (
                            <li
                              key={row.id}
                              className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-[#2C2C2C]">{labelDealPipelineDoc(row)}</p>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${stClass}`}
                                >
                                  {stLabel}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] font-semibold text-[#2C2C2C]/45">{dirLabel}</p>
                              {row.file_name ? (
                                <p className="mt-1 truncate text-xs font-medium text-[#2C2C2C]/60">{row.file_name}</p>
                              ) : null}
                              <p className="mt-1 text-[11px] font-semibold text-[#2C2C2C]/45">
                                {formatRelativeTime(row.created_at)}
                              </p>
                              {row.file_url?.trim() ? (
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    disabled={dealDocOpeningId === row.id}
                                    onClick={() => void openAgentDealDocumentUrl(row)}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4] disabled:opacity-50"
                                  >
                                    {dealDocOpeningId === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                    ) : null}
                                    View
                                  </button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                      Client Documents
                    </p>
                    {!docsLead.client_id ? (
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
                  </>
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
