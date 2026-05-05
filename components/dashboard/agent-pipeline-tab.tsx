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
  Clock,
  CircleCheck,
  Lock,
  Eye,
  FileText,
  Filter,
  Handshake,
  LayoutGrid,
  List,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pin,
  Pencil,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { dealAttachmentAcceptAttr, validateDealAttachmentFile } from "@/lib/deal-attachment-file";
import { postFormDataWithUploadProgress } from "@/lib/form-upload-progress";
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload";
import { SupabasePublicImage } from "@/components/supabase-public-image";
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
import { labelForClientArchiveReason } from "@/lib/client-lead-archive";
import { propertyCanonicalCity } from "@/lib/normalize-city";
import { cn } from "@/lib/utils";
import { propertyEngagementLooksUnavailable } from "@/lib/property-availability";
import { isClientDocumentType, labelForClientDocType } from "@/lib/client-documents";
import { coerceLeadId, type ParsedViewing } from "@/lib/viewings";
import { useAgentViewings } from "@/lib/agent-viewings-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  manilaDateStringFromInstant,
  manilaLocalDateTimeToOffsetIso,
  manilaMonthDayLabelFromInstant,
  manilaMonthDayYearLabelFromInstant,
  manilaTimeLabel12hFromInstant,
  manilaTimeStringFromInstant,
  normalizeTimeHmForInput,
} from "@/lib/manila-datetime";
import { useLeadStreamUnreadMap } from "@/features/messaging/hooks/use-lead-stream-unread-map";

/** When no client/request time is known, pre-fill time so Confirm is one step faster (24h `HH:mm`). */
const DEFAULT_VIEWING_CONFIRM_TIME = "10:00";

/** Log once if DB is behind migration `20260502100000_viewings_reschedule_request.sql`. */
let viewingsRescheduleColumnHintLogged = false;

export const PIPELINE_STAGES = [
  { id: "lead", label: "Inquiry" },
  { id: "viewing", label: "Viewing" },
  { id: "offer", label: "Offer" },
  { id: "reservation", label: "Reservation" },
  { id: "closed", label: "Closed" },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

/** Agent-facing pipeline stage label; DB still stores ids like `lead`. */
export function agentPipelineStageDisplayLabel(stageRaw: string): string {
  const sl = String(stageRaw ?? "").trim().toLowerCase();
  if (!sl || sl === "—") return stageRaw;
  const hit = PIPELINE_STAGES.find((s) => s.id === sl);
  return hit?.label ?? stageRaw;
}

/** `viewing_requests` fields needed for Lead-stage “Requested viewing” menu (scheduled + updated subtitle). */
export type ViewingRequestPipelineMeta = {
  scheduled_at: string;
  created_at: string;
  updated_at: string;
};

/** Pending client reschedule for a confirmed `viewings` row (Viewing column). */
export type ReschedulePendingMeta = {
  viewingId: string;
  currentScheduledAt: string;
  requestedScheduledAt: string;
};

export type PipelineLeadRow = {
  id: number;
  name: string;
  email: string;
  /** Linked client profile id (for document requests). */
  client_id?: string | null;
  /** Cached avatar_url for the linked client profile (pipeline cards). */
  client_avatar_url?: string | null;
  pipeline_stage: PipelineStageId;
  property_id: string | null;
  /** When set, client viewing request row id (defaults for confirm-viewing modal). */
  viewing_request_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  pipeline_position?: number | null;
  pinned?: boolean | null;
  pinned_at?: string | null;
  closing_notes?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
  archive_note?: string | null;
  stage_at_archive?: string | null;
  closed_date?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  closure_confirmed_by_client?: boolean | null;
  new_lead_seen_at?: string | null;
  new_viewing_request_seen_at?: string | null;
};

function formatRequestedViewingMenuLine(scheduledAtIso: string): string {
  const d = new Date(scheduledAtIso);
  if (Number.isNaN(d.getTime())) return "";
  return `${manilaMonthDayLabelFromInstant(d)} · ${manilaTimeLabel12hFromInstant(d)}`;
}

/** VR row edited after creation, or lead predates linked VR (client resubmitted / dedupe new row). */
const VR_PIPELINE_UPDATED_ROW_MS = 5000;
const VR_PIPELINE_RESUBMIT_LEAD_MS = 2000;

function requestedViewingUpdatedSubtitleLine(
  newSeenAt: string | null | undefined,
  vr: Pick<ViewingRequestPipelineMeta, "created_at" | "updated_at"> | null | undefined,
  deal: Pick<PipelineLeadRow, "created_at" | "updated_at">,
): string | null {
  if (newSeenAt) return null;
  if (!vr) return null;
  const c = new Date(vr.created_at).getTime();
  const u = new Date(vr.updated_at).getTime();
  if (!Number.isFinite(c) || !Number.isFinite(u)) return null;
  if (u - c > VR_PIPELINE_UPDATED_ROW_MS) {
    return `Updated ${formatRelativeTime(vr.updated_at)}`;
  }
  const lc = new Date(deal.created_at).getTime();
  const lu = new Date(deal.updated_at ?? deal.created_at).getTime();
  if (
    Number.isFinite(lc) &&
    Number.isFinite(lu) &&
    lc < c - VR_PIPELINE_RESUBMIT_LEAD_MS &&
    lu >= c - 1000
  ) {
    return `Updated ${formatRelativeTime(deal.updated_at ?? deal.created_at)}`;
  }
  return null;
}

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

function cloneKanbanIdsByStage(s: Record<PipelineStageId, string[]>): Record<PipelineStageId, string[]> {
  return {
    lead: [...s.lead],
    viewing: [...s.viewing],
    offer: [...s.offer],
    reservation: [...s.reservation],
    closed: [...s.closed],
  };
}

function findKanbanStageForLeadId(board: Record<PipelineStageId, string[]>, id: string): PipelineStageId | null {
  for (const stage of KANBAN_STAGE_ORDER) {
    if (board[stage].includes(id)) return stage;
  }
  return null;
}

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

/**
 * Three-dot menu: Send Offer row is hidden until the offer flow ships; keep JSX + handlers wired behind this flag.
 * When enabling, set to `true` and add `"sendOffer"` to the offer branch in `agentPipelineCardMenuKeysForStage`.
 */
const AGENT_PIPELINE_MENU_SEND_OFFER = false;

/** Keys for the pipeline card overflow menu (Kanban + mobile list), filtered by `agentPipelineCardMenuKeysForStage`. */
type AgentPipelineCardMenuKey =
  | "pin"
  | "viewDetails"
  | "viewDocuments"
  | "messages"
  | "editNotes"
  | "requestDocuments"
  | "sendOffer"
  | "createReservation"
  | "markClosed"
  | "declineArchive"
  | "moveTo";

const AGENT_PIPELINE_CARD_MENU_HEAD_KEYS: AgentPipelineCardMenuKey[] = [
  "pin",
  "viewDetails",
  "viewDocuments",
  "messages",
  "editNotes",
  "requestDocuments",
];

const AGENT_PIPELINE_CARD_MENU_TAIL_KEYS: AgentPipelineCardMenuKey[] = [
  "sendOffer",
  "createReservation",
  "markClosed",
  "declineArchive",
  "moveTo",
];

function agentPipelineCardMenuKeysForStage(pipelineStage: string): Set<AgentPipelineCardMenuKey> {
  const s = String(pipelineStage ?? "").trim().toLowerCase();
  if (s === "declined") {
    return new Set<AgentPipelineCardMenuKey>(["viewDetails", "viewDocuments"]);
  }
  if (s === "closed") {
    return new Set<AgentPipelineCardMenuKey>(["pin", "viewDetails", "viewDocuments", "messages", "editNotes"]);
  }
  if (s === "lead") {
    return new Set<AgentPipelineCardMenuKey>([
      "pin",
      "viewDetails",
      "messages",
      "editNotes",
      "requestDocuments",
      "declineArchive",
      "moveTo",
    ]);
  }
  if (s === "viewing") {
    return new Set<AgentPipelineCardMenuKey>([
      "pin",
      "viewDetails",
      "viewDocuments",
      "messages",
      "editNotes",
      "requestDocuments",
      "declineArchive",
      "moveTo",
    ]);
  }
  if (s === "offer") {
    return new Set<AgentPipelineCardMenuKey>([
      "pin",
      "viewDetails",
      "viewDocuments",
      "messages",
      "editNotes",
      "requestDocuments",
      "createReservation",
      "declineArchive",
      "moveTo",
    ]);
  }
  if (s === "reservation") {
    return new Set<AgentPipelineCardMenuKey>([
      "pin",
      "viewDetails",
      "viewDocuments",
      "messages",
      "editNotes",
      "requestDocuments",
      "markClosed",
      "declineArchive",
      "moveTo",
    ]);
  }
  return agentPipelineCardMenuKeysForStage("lead");
}

function agentPipelineCardMenuShowDividerBeforeTail(keys: Set<AgentPipelineCardMenuKey>): boolean {
  const hasHead = AGENT_PIPELINE_CARD_MENU_HEAD_KEYS.some((k) => keys.has(k));
  const hasTail = AGENT_PIPELINE_CARD_MENU_TAIL_KEYS.some((k) => keys.has(k));
  return hasHead && hasTail;
}

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

type PropertyMeta = {
  city: string;
  location: string;
  deleted_at?: string | null;
  availability_state?: string | null;
};

/** Client-side pipeline search: client full name, listing city/location, property display name (home). */
function leadMatchesPipelineSearch(
  lead: PipelineLeadRow,
  q: string,
  labelForProperty: (propertyId: string | null) => string,
  propertyMetaById: Record<string, PropertyMeta>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if ((lead.name ?? "").toLowerCase().includes(needle)) return true;
  const pid = lead.property_id;
  if (!pid) return false;
  const meta = propertyMetaById[pid];
  const home = (labelForProperty(pid) ?? "").toLowerCase();
  const city = (meta?.city ?? "").toLowerCase();
  const loc = (meta?.location ?? "").toLowerCase();
  return home.includes(needle) || city.includes(needle) || loc.includes(needle);
}

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

/** Gold footer-left chip (reschedule / new viewing request); compact for h-6 footer. */
const KANBAN_FOOTER_GOLD_BADGE_CLASS =
  "flex max-w-full shrink-0 flex-row items-center gap-0.5 rounded-md bg-[#D4A843]/12 px-1 py-0 text-[9px] font-semibold leading-none tracking-tight text-[#D4A843]";

function KanbanFooterGoldBadge({ label }: { label: string }) {
  return (
    <span className={KANBAN_FOOTER_GOLD_BADGE_CLASS}>
      <Clock className="h-2 w-2 shrink-0 opacity-90" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

function pipelineColumnEmptyIcon(stage: PipelineStageId) {
  const ring =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] ring-1 ring-[#2C2C2C]/[0.06]";
  const ic = "h-5 w-5 text-[#2C2C2C]/35";
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

function kanbanFooterInstant(raw: string | null | undefined): Date | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00+08:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Single-line footer under kanban cards (Manila date/time; matches former stage pill data). */
function kanbanDealFooterPlainText(
  deal: PipelineLeadRow,
  scheduledViewing: ParsedViewing | null | undefined,
  viewingRequestScheduledAt: string | null | undefined,
  offerCreatedAt: string | null | undefined,
  reservationCreatedAt: string | null | undefined,
): string {
  const raw = deal.pipeline_stage;
  const stageLower = String(raw ?? "").trim().toLowerCase();
  const pillStage: PipelineStageId | "declined" = stageLower === "declined" ? "declined" : (raw as PipelineStageId);

  if (pillStage === "lead") {
    const d = kanbanFooterInstant(deal.created_at);
    if (!d) return "Received —";
    return `Received ${manilaMonthDayYearLabelFromInstant(d)} · ${manilaTimeLabel12hFromInstant(d)}`;
  }

  if (pillStage === "viewing") {
    const sv = scheduledViewing?.scheduledAt;
    if (sv && !Number.isNaN(sv.getTime())) {
      return `Viewing ${manilaMonthDayLabelFromInstant(sv)} · ${manilaTimeLabel12hFromInstant(sv)}`;
    }
    const rq = viewingRequestScheduledAt?.trim();
    if (rq) {
      const d = kanbanFooterInstant(rq);
      if (d) {
        return `Viewing requested ${manilaMonthDayLabelFromInstant(d)} · ${manilaTimeLabel12hFromInstant(d)}`;
      }
    }
    return "Viewing —";
  }

  const monthDayFromTs = (ts: string | null | undefined): string | null => {
    const d = kanbanFooterInstant(ts);
    return d ? manilaMonthDayLabelFromInstant(d) : null;
  };

  if (pillStage === "offer") {
    const part =
      monthDayFromTs(offerCreatedAt ?? null) ?? monthDayFromTs(deal.updated_at) ?? monthDayFromTs(deal.created_at);
    return part ? `Offer sent ${part}` : "Offer sent —";
  }

  if (pillStage === "reservation") {
    const part =
      monthDayFromTs(reservationCreatedAt ?? null) ??
      monthDayFromTs(deal.updated_at) ??
      monthDayFromTs(deal.created_at);
    return part ? `Reserved ${part}` : "Reserved —";
  }

  if (pillStage === "closed") {
    const part =
      monthDayFromTs(deal.closed_at ?? null) ??
      monthDayFromTs(deal.closed_date ?? null) ??
      monthDayFromTs(deal.updated_at) ??
      monthDayFromTs(deal.created_at);
    return part ? `Closed ${part}` : "Closed —";
  }

  if (pillStage === "declined") {
    const part = monthDayFromTs(deal.updated_at) ?? monthDayFromTs(deal.created_at);
    return part ? `Declined ${part}` : "Declined —";
  }

  return "—";
}

function KanbanDealCard({
  deal,
  indexInStage,
  propertyLabel,
  dealValueLine,
  pinned,
  uploadedRequestedDocCount,
  unviewedUploadedDocCount,
  scheduledViewing,
  offerCreatedAt,
  reservationCreatedAt,
  onSendOffer,
  onCreateReservation,
  onMarkClosed,
  onOpenDocs,
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
  viewingRequestMeta,
  reschedulePending,
  onRescheduleAccept,
  onRescheduleDecline,
  onOpenCounterReschedule,
  messageUnreadCount,
  onMarkNewLeadSeenOnMenuOpen,
  markViewingRequestSeen,
  onOpenMessagesForClient,
  tourViewingCardAnchor,
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
  /** Earliest non-cancelled `viewings` row for this lead (shared agent viewings context). */
  scheduledViewing?: ParsedViewing | null;
  /** Latest offer `created_at` for footer (Offer stage). */
  offerCreatedAt?: string | null;
  /** Latest reservation `created_at` for footer (Reservation stage). */
  reservationCreatedAt?: string | null;
  onSendOffer: (lead: PipelineLeadRow) => void;
  onCreateReservation: (lead: PipelineLeadRow) => void;
  onMarkClosed: (lead: PipelineLeadRow) => void;
  onOpenDocs: (lead: PipelineLeadRow) => void;
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
  /** Linked `viewing_requests` row for Lead-stage cards (menu time + “Updated” hint). */
  viewingRequestMeta?: ViewingRequestPipelineMeta | null;
  reschedulePending?: ReschedulePendingMeta | null;
  onRescheduleAccept: (viewingId: string) => void | Promise<void>;
  onRescheduleDecline: (viewingId: string) => void | Promise<void>;
  onOpenCounterReschedule: (lead: PipelineLeadRow, meta: ReschedulePendingMeta) => void;
  messageUnreadCount: number;
  onMarkNewLeadSeenOnMenuOpen: (d: PipelineLeadRow) => void;
  markViewingRequestSeen: (leadId: number) => void;
  onOpenMessagesForClient?: (clientUserId: string) => void;
  tourViewingCardAnchor?: boolean;
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

  const hasVr = Boolean(deal.viewing_request_id?.trim());
  const showVrMenuDot =
    (hasVr || Boolean(reschedulePending)) && !deal.new_viewing_request_seen_at;
  const showLeadMenuDot = !deal.new_lead_seen_at;
  const showMsgMenuDot = messageUnreadCount > 0;
  const showCornerPulseDot =
    showLeadMenuDot || showVrMenuDot || unviewedUploadedDocCount > 0 || showMsgMenuDot;

  const vrScheduled = viewingRequestMeta?.scheduled_at?.trim() ?? null;
  const vrUpdatedSubtitle =
    deal.pipeline_stage === "lead" && vrScheduled && viewingRequestMeta
      ? requestedViewingUpdatedSubtitleLine(deal.new_viewing_request_seen_at, viewingRequestMeta, deal)
      : null;

  const pipelineMenuKeys = agentPipelineCardMenuKeysForStage(String(deal.pipeline_stage));
  const pipelineMenuShowTailDivider = agentPipelineCardMenuShowDividerBeforeTail(pipelineMenuKeys);

  useEffect(() => {
    if (!menuOpen) return;
    void onMarkNewLeadSeenOnMenuOpen(deal);
    // Server-side `.is("new_lead_seen_at", null)` makes this safe if `deal` is briefly stale after refresh.
  }, [menuOpen, deal.id, onMarkNewLeadSeenOnMenuOpen, deal]);

  const kanbanFooterLine = useMemo(
    () =>
      kanbanDealFooterPlainText(
        deal,
        scheduledViewing,
        viewingRequestMeta?.scheduled_at ?? null,
        offerCreatedAt ?? null,
        reservationCreatedAt ?? null,
      ),
    [
      deal,
      scheduledViewing,
      viewingRequestMeta?.scheduled_at,
      offerCreatedAt,
      reservationCreatedAt,
    ],
  );

  const showRescheduleFooterBadge = deal.pipeline_stage === "viewing" && Boolean(reschedulePending);
  const showNewRequestFooterBadge =
    !showRescheduleFooterBadge &&
    Boolean(deal.viewing_request_id?.trim()) &&
    deal.new_viewing_request_seen_at == null;
  const showFooterLeftBadge = showRescheduleFooterBadge || showNewRequestFooterBadge;
  const footerLeftBadgeLabel = showRescheduleFooterBadge ? "Reschedule pending" : "New request";

  const openKanbanLeadDetails = useCallback(() => {
    if (deal.viewing_request_id?.trim() && deal.new_viewing_request_seen_at == null) {
      void markViewingRequestSeen(deal.id);
    }
    onOpenLeadDetails(deal.id);
  }, [deal.id, deal.new_viewing_request_seen_at, deal.viewing_request_id, markViewingRequestSeen, onOpenLeadDetails]);

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
    <div ref={setNodeRef} style={styleWithZ} className="relative flex w-full flex-col">
      <div
        {...attributes}
        {...listeners}
        {...(tourViewingCardAnchor ? { "data-tour": "viewing-card" as const } : {})}
        className={cn(
          "relative flex w-full min-h-[150px] cursor-grab flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/[0.08] bg-white p-3 shadow-none ring-0 transition-colors [box-shadow:none]",
          next ? "pb-10" : "",
          "hover:border-[#2C2C2C]/12",
          isDragging && "scale-[1.01] cursor-grabbing border-[#6B9E6E]/35",
        )}
        onClick={() => openKanbanLeadDetails()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openKanbanLeadDetails();
        }}
      >
        <div className="touch-none flex min-h-0 flex-1 flex-col pr-10 pt-2">
          {/* Row 1: Title + Menu */}
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 pr-16 text-left"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                openKanbanLeadDetails();
              }}
            >
              <p
                className="font-sans text-[15px] font-bold leading-snug tracking-tight text-[#2C2C2C]"
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
                <span className="relative inline-flex shrink-0">
                  <button
                    type="button"
                    aria-label="More options"
                    aria-expanded={menuOpen}
                    data-kanban-menu-button="true"
                    {...(tourViewingCardAnchor ? { "data-tour": "viewing-card-menu-trigger" as const } : {})}
                    ref={menuButtonRef}
                    onClick={() => {
                      setMenuMoveOpen(false);
                      setMenuOpenId(menuOpen ? null : deal.id);
                    }}
                    className={cn(
                      "p-1.5 text-[#2C2C2C]/45 focus-visible:outline-none focus-visible:ring-0",
                      !menuOpen && "hover:text-[#2C2C2C]/70",
                      menuOpen && "bg-transparent text-[#2C2C2C]/55",
                      "active:bg-transparent",
                    )}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                  {showCornerPulseDot ? (
                    <span
                      className={cn(
                        "pointer-events-none absolute -right-0.5 -top-0.5 z-[12] h-2 w-2 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]",
                        "bhg-doc-badge-pulse",
                        anyMenuOpen && "opacity-0",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </span>

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
                          className="z-[9999] w-[min(280px,calc(100vw-24px))] max-w-[calc(100vw-24px)] rounded-lg border border-[#E5E5E5] bg-white p-1.5 text-[#2C2C2C] shadow-lg"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!menuMoveOpen ? (
                            <div className="space-y-0.5">
                              {deal.pipeline_stage === "lead" &&
                              vrScheduled &&
                              formatRequestedViewingMenuLine(vrScheduled) ? (
                                <>
                                  <button
                                    type="button"
                                    className="w-full rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-[#F0F4F0]"
                                    onClick={() => {
                                      void markViewingRequestSeen(deal.id);
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    <p className="text-[11px] font-semibold text-gray-500">Requested viewing</p>
                                    <p className="mt-0.5 flex items-center gap-2 pr-1 font-sans text-[13px] font-semibold text-[#2C2C2C]">
                                      <span className="min-w-0 flex-1 leading-snug">
                                        {formatRequestedViewingMenuLine(vrScheduled)}
                                      </span>
                                      {showVrMenuDot ? (
                                        <span
                                          aria-hidden
                                          className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                                        />
                                      ) : null}
                                    </p>
                                    {vrUpdatedSubtitle ? (
                                      <p className="mt-0.5 text-[10px] text-gray-500">{vrUpdatedSubtitle}</p>
                                    ) : null}
                                  </button>
                                  <div className="my-1 h-px bg-[#EEEEEE]" />
                                </>
                              ) : null}
                              {deal.pipeline_stage === "viewing" &&
                              scheduledViewing?.scheduledAtRaw?.trim() &&
                              formatRequestedViewingMenuLine(scheduledViewing.scheduledAtRaw) ? (
                                <>
                                  <button
                                    type="button"
                                    className="w-full rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-[#F0F4F0]"
                                    onClick={() => {
                                      void markViewingRequestSeen(deal.id);
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    <p className="text-[11px] font-semibold text-gray-500">Requested viewing</p>
                                    <p className="mt-0.5 flex items-center gap-2 pr-1 font-sans text-[13px] font-semibold text-[#2C2C2C]">
                                      <span className="min-w-0 flex-1 leading-snug">
                                        {formatRequestedViewingMenuLine(scheduledViewing.scheduledAtRaw)}
                                      </span>
                                      {showVrMenuDot ? (
                                        <span
                                          aria-hidden
                                          className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                                        />
                                      ) : null}
                                    </p>
                                  </button>
                                  {reschedulePending ? (
                                    <>
                                      <div className="my-1 h-px bg-[#EEEEEE]" />
                                      <div className="rounded-md border border-[#D4A843]/40 bg-[#FAF8F4]/50 p-2">
                                        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#D4A843]">
                                          <Clock className="h-3 w-3 shrink-0" aria-hidden />
                                          RESCHEDULE REQUESTED
                                        </p>
                                        <p className="mt-1 font-sans text-[12px] font-semibold leading-snug text-[#2C2C2C]">
                                          New time:{" "}
                                          {formatRequestedViewingMenuLine(reschedulePending.requestedScheduledAt)}
                                        </p>
                                        <p className="mt-0.5 font-sans text-[12px] font-medium leading-snug text-[#2C2C2C]/70">
                                          Current:{" "}
                                          {formatRequestedViewingMenuLine(reschedulePending.currentScheduledAt)}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                          <button
                                            type="button"
                                            className="min-w-[4.5rem] flex-1 rounded-md bg-[#6B9E6E] px-2 py-1.5 text-center text-[11px] font-bold text-white hover:bg-[#5a8a5d]"
                                            onClick={() => {
                                              void (async () => {
                                                await markViewingRequestSeen(deal.id);
                                                setMenuOpenId(null);
                                                await onRescheduleAccept(reschedulePending.viewingId);
                                              })();
                                            }}
                                          >
                                            Accept
                                          </button>
                                          <button
                                            type="button"
                                            className="min-w-[4.5rem] flex-1 rounded-md border border-[#2C2C2C]/25 bg-white px-2 py-1.5 text-center text-[11px] font-bold text-[#2C2C2C]/80 hover:bg-gray-50"
                                            onClick={() => {
                                              void (async () => {
                                                await markViewingRequestSeen(deal.id);
                                                setMenuOpenId(null);
                                                await onRescheduleDecline(reschedulePending.viewingId);
                                              })();
                                            }}
                                          >
                                            Decline
                                          </button>
                                          <button
                                            type="button"
                                            className="w-full rounded-md border border-[#6B9E6E] bg-white px-2 py-1.5 text-center text-[11px] font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10"
                                            onClick={() => {
                                              void markViewingRequestSeen(deal.id);
                                              setMenuOpenId(null);
                                              onOpenCounterReschedule(deal, reschedulePending);
                                            }}
                                          >
                                            Counter
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  ) : null}
                                  <div className="my-1 h-px bg-[#EEEEEE]" />
                                </>
                              ) : null}
                              {pipelineMenuKeys.has("pin") ? (
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
                              ) : null}
                              {pipelineMenuKeys.has("viewDetails") ? (
                                <button
                                  type="button"
                                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                  onClick={() => {
                                    openKanbanLeadDetails();
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <Eye
                                    className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                    aria-hidden
                                  />
                                  View Details
                                  {showLeadMenuDot ? (
                                    <span
                                      aria-hidden
                                      className="ml-auto mr-1 h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                                    />
                                  ) : null}
                                </button>
                              ) : null}
                              {pipelineMenuKeys.has("viewDocuments") ? (
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
                                  {unviewedUploadedDocCount > 0 ? (
                                    <span
                                      aria-hidden
                                      className="ml-auto mr-1 h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                                    />
                                  ) : null}
                                </button>
                              ) : null}
                              {pipelineMenuKeys.has("messages") && onOpenMessagesForClient && deal.client_id?.trim() ? (
                                <button
                                  type="button"
                                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                  onClick={() => {
                                    onOpenMessagesForClient(deal.client_id!.trim());
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <MessageSquare
                                    className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                    aria-hidden
                                  />
                                  Messages
                                  {showMsgMenuDot ? (
                                    <span
                                      aria-hidden
                                      className="ml-auto mr-1 h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                                    />
                                  ) : null}
                                </button>
                              ) : null}
                              {pipelineMenuKeys.has("editNotes") ? (
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
                              ) : null}
                              {pipelineMenuKeys.has("requestDocuments") ? (
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
                              ) : null}

                              {pipelineMenuShowTailDivider ? <div className="my-1 h-px bg-[#EEEEEE]" /> : null}

                              {AGENT_PIPELINE_MENU_SEND_OFFER && pipelineMenuKeys.has("sendOffer") ? (
                                <button
                                  type="button"
                                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                  onClick={() => {
                                    onSendOffer(deal);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <Handshake
                                    className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                    aria-hidden
                                  />
                                  Send Offer
                                </button>
                              ) : null}

                              {pipelineMenuKeys.has("createReservation") ? (
                                <button
                                  type="button"
                                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                  onClick={() => {
                                    onCreateReservation(deal);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <Lock
                                    className="h-4 w-4 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                    aria-hidden
                                  />
                                  Create Reservation
                                </button>
                              ) : null}
                              {pipelineMenuKeys.has("markClosed") ? (
                                <button
                                  type="button"
                                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#6B9E6E] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                  onClick={() => {
                                    onMarkClosed(deal);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <CircleCheck className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                                  Mark as Closed
                                </button>
                              ) : null}

                              {pipelineMenuKeys.has("declineArchive") ? (
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
                              ) : null}

                              {pipelineMenuKeys.has("moveTo") ? (
                                <button
                                  type="button"
                                  className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-[#2C2C2C] transition-colors duration-150 hover:bg-[#F0F4F0]"
                                  onClick={() => setMenuMoveOpen(true)}
                                >
                                  <ArrowRightCircle
                                    className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
                                    aria-hidden
                                  />
                                  Move to…
                                </button>
                              ) : null}
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
                                      void onMoveToStage(deal, s.id);
                                      setMenuOpenId(null);
                                      setMenuMoveOpen(false);
                                    }}
                                  >
                                    <ArrowRightCircle
                                      className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E] transition-colors duration-150 group-hover:text-[#2C2C2C]"
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
            </div>
          </div>

          {/* Row 2: Value (secondary) */}
          <p className="mt-1.5 font-sans text-[12px] font-semibold tabular-nums text-[#2C2C2C]/55">
            {dealValueLine ?? "—"}
          </p>
          {/* Row 3: Avatar + contact (tertiary) */}
          <div className="absolute bottom-3 left-3 right-10 flex items-center gap-2">
            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6B9E6E]/12 text-[10px] font-bold text-[#6B9E6E]">
              {deal.client_avatar_url ? (
                <SupabasePublicImage src={deal.client_avatar_url} alt="" fill sizes="24px" className="object-cover" />
              ) : (
                clientInitials(deal.name)
              )}
            </div>
            <span className="truncate font-sans text-[11px] font-medium text-[#888888]">{deal.name}</span>
          </div>
        </div>

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
              "absolute bottom-3 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#6B9E6E] text-white shadow-none ring-0 [box-shadow:none] hover:bg-[#5a8a5d]",
              anyMenuOpen && "pointer-events-none opacity-0",
            )}
          >
            <span aria-hidden className="text-[11px] font-semibold leading-none tracking-tight">
              ›
            </span>
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "flex h-6 w-full shrink-0 items-center gap-2 rounded-b-2xl bg-[#2C2C2C]/[0.06] px-3",
          showFooterLeftBadge ? "justify-between" : "justify-center",
        )}
      >
        {showFooterLeftBadge ? (
          <div className="flex min-w-0 shrink-0 items-center justify-start">
            <KanbanFooterGoldBadge label={footerLeftBadgeLabel} />
          </div>
        ) : null}
        <p
          className={cn(
            "min-w-0 truncate font-sans text-[10px] font-semibold tracking-tight text-[#2C2C2C]/55",
            showFooterLeftBadge ? "flex-1 text-right" : "w-full text-center",
          )}
        >
          {kanbanFooterLine}
        </p>
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
  barHex,
  ids,
  list,
  propertyLabel,
  dealValueByPropertyId,
  uploadedRequestedDocCountByLeadId,
  unviewedUploadedDocCountByLeadId,
  scheduledViewingByLeadId,
  offerCreatedAtByLeadId,
  reservationCreatedAtByLeadId,
  openDocs,
  onSendOffer,
  onCreateReservation,
  onMarkClosed,
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
  viewingRequestMetaByLeadId,
  reschedulePendingByLeadId,
  streamUnreadByLeadId,
  markNewLeadSeenOnMenuOpen,
  markViewingRequestSeen,
  onOpenMessagesForClient,
  onRescheduleAccept,
  onRescheduleDecline,
  onOpenCounterReschedule,
}: {
  stage: PipelineStageId;
  idx: number;
  label: string;
  count: number;
  barHex: string;
  ids: string[];
  list: PipelineLeadRow[];
  propertyLabel: (propertyId: string | null) => string;
  dealValueByPropertyId: Record<string, string>;
  uploadedRequestedDocCountByLeadId: Record<number, number>;
  unviewedUploadedDocCountByLeadId: Record<number, number>;
  scheduledViewingByLeadId: Map<number, ParsedViewing>;
  offerCreatedAtByLeadId: Record<number, string | null>;
  reservationCreatedAtByLeadId: Record<number, string | null>;
  openDocs: (lead: PipelineLeadRow) => void;
  onSendOffer: (lead: PipelineLeadRow) => void;
  onCreateReservation: (lead: PipelineLeadRow) => void;
  onMarkClosed: (lead: PipelineLeadRow) => void;
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
  viewingRequestMetaByLeadId: Record<number, ViewingRequestPipelineMeta>;
  reschedulePendingByLeadId: Record<number, ReschedulePendingMeta>;
  streamUnreadByLeadId: Record<number, number>;
  markNewLeadSeenOnMenuOpen: (d: PipelineLeadRow) => void;
  markViewingRequestSeen: (leadId: number) => void;
  onOpenMessagesForClient?: (clientUserId: string) => void;
  onRescheduleAccept: (viewingId: string) => void | Promise<void>;
  onRescheduleDecline: (viewingId: string) => void | Promise<void>;
  onOpenCounterReschedule: (lead: PipelineLeadRow, meta: ReschedulePendingMeta) => void;
}) {
  const containerId = stageContainerId(stage);
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  return (
    <div
      key={stage}
      className={cn("min-w-0 flex-1 px-2", idx > 0 && "border-l border-[#2C2C2C]/10")}
    >
      <div className="overflow-hidden rounded-lg border border-[#2C2C2C]/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div aria-hidden className="h-0.5 w-full" style={{ backgroundColor: barHex }} />
        <div className="flex min-h-[52px] flex-col justify-center border-b border-[#2C2C2C]/[0.06] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate font-sans text-[13px] font-bold uppercase tracking-wide text-[#2C2C2C]/85">
              {label}
            </p>
            <span className="shrink-0 rounded-md bg-[#F4F5F6] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#2C2C2C]/70">
              {count}
            </span>
          </div>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "mt-2 min-h-[168px] rounded-lg border border-transparent transition-colors",
          isOver ? "border-[#6B9E6E]/25 bg-[#6B9E6E]/[0.07]" : "bg-[#F4F5F6]/60",
        )}
      >
        {list.length === 0 ? (
          <div className="flex flex-col">
            <div className="flex min-h-[152px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#2C2C2C]/[0.12] bg-[#ECEEEF]/80 px-3 py-6 text-center opacity-[0.78] shadow-none ring-0 [box-shadow:none]">
              {pipelineColumnEmptyIcon(stage)}
              <p className="mt-3 font-sans text-[12px] font-bold text-[#2C2C2C]/60">No deals yet</p>
              <p className="mt-1 max-w-[200px] font-sans text-[10px] font-medium leading-snug text-[#2C2C2C]/40">
                Drag deals here or wait for new inquiries.
              </p>
            </div>
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
                  scheduledViewing={scheduledViewingByLeadId.get(deal.id) ?? null}
                  offerCreatedAt={offerCreatedAtByLeadId[deal.id] ?? null}
                  reservationCreatedAt={reservationCreatedAtByLeadId[deal.id] ?? null}
                  onOpenDocs={openDocs}
                  onSendOffer={onSendOffer}
                  onCreateReservation={onCreateReservation}
                  onMarkClosed={onMarkClosed}
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
                      toast.error("This deal is not linked to a client account yet.");
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
                  viewingRequestMeta={viewingRequestMetaByLeadId[deal.id] ?? null}
                  reschedulePending={reschedulePendingByLeadId[deal.id] ?? null}
                  onRescheduleAccept={onRescheduleAccept}
                  onRescheduleDecline={onRescheduleDecline}
                  onOpenCounterReschedule={onOpenCounterReschedule}
                  messageUnreadCount={streamUnreadByLeadId[deal.id] ?? 0}
                  onMarkNewLeadSeenOnMenuOpen={markNewLeadSeenOnMenuOpen}
                  markViewingRequestSeen={markViewingRequestSeen}
                  onOpenMessagesForClient={onOpenMessagesForClient}
                  tourViewingCardAnchor={stage === "viewing" && i === 0}
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
  onSendOffer,
  onCreateReservation,
  onMarkClosed,
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
  propertyMetaById,
  viewingRequestMeta,
  scheduledViewing,
  reschedulePending,
  onRescheduleAccept,
  onRescheduleDecline,
  onOpenCounterReschedule,
  messageUnreadCount,
  onMarkNewLeadSeenOnMenuOpen,
  markViewingRequestSeen,
  onOpenMessagesForClient,
}: {
  deal: PipelineLeadRow;
  indexInStage: number;
  propertyLabel: (propertyId: string | null) => string;
  dealValueLine: string | null;
  pinned: boolean;
  uploadedRequestedDocCount: number;
  unviewedUploadedDocCount: number;
  onOpenDocs: (lead: PipelineLeadRow) => void;
  onSendOffer: (lead: PipelineLeadRow) => void;
  onCreateReservation: (lead: PipelineLeadRow) => void;
  onMarkClosed: (lead: PipelineLeadRow) => void;
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
  propertyMetaById: Record<string, PropertyMeta>;
  viewingRequestMeta?: ViewingRequestPipelineMeta | null;
  scheduledViewing?: ParsedViewing | null;
  reschedulePending?: ReschedulePendingMeta | null;
  onRescheduleAccept: (viewingId: string) => void | Promise<void>;
  onRescheduleDecline: (viewingId: string) => void | Promise<void>;
  onOpenCounterReschedule: (lead: PipelineLeadRow, meta: ReschedulePendingMeta) => void;
  messageUnreadCount: number;
  onMarkNewLeadSeenOnMenuOpen: (d: PipelineLeadRow) => void;
  markViewingRequestSeen: (leadId: number) => void;
  onOpenMessagesForClient?: (clientUserId: string) => void;
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
  const propRemoved =
    deal.property_id != null
      ? propertyEngagementLooksUnavailable({
          deleted_at: propertyMetaById[deal.property_id]?.deleted_at,
          availability_state: propertyMetaById[deal.property_id]?.availability_state,
        })
      : false;
  const moveLabel = MOVE_TO_LABEL[deal.pipeline_stage];
  const menuOpen = menuOpenId === deal.id;
  const anyMenuOpen = menuOpenId != null;
  const isArchived =
    String((deal as unknown as { pipeline_stage?: unknown }).pipeline_stage ?? "")
      .trim()
      .toLowerCase() === "declined";
  const updatedIso = (deal.updated_at ?? deal.created_at) as string;
  const updatedMs = new Date(updatedIso).getTime();
  const createdMs = new Date(deal.created_at).getTime();
  const now = Date.now();
  const otherStages = PIPELINE_STAGES.filter((s) => s.id !== deal.pipeline_stage);

  const hasVr = Boolean(deal.viewing_request_id?.trim());
  const showVrMenuDot =
    (hasVr || Boolean(reschedulePending)) && !deal.new_viewing_request_seen_at;
  const showLeadMenuDot = !deal.new_lead_seen_at;
  const showMsgMenuDot = messageUnreadCount > 0;
  const showCornerPulseDot =
    showLeadMenuDot || showVrMenuDot || unviewedUploadedDocCount > 0 || showMsgMenuDot;

  const vrScheduled = viewingRequestMeta?.scheduled_at?.trim() ?? null;
  const vrUpdatedSubtitle =
    deal.pipeline_stage === "lead" && vrScheduled && viewingRequestMeta
      ? requestedViewingUpdatedSubtitleLine(deal.new_viewing_request_seen_at, viewingRequestMeta, deal)
      : null;

  const pipelineMenuKeys = agentPipelineCardMenuKeysForStage(String(deal.pipeline_stage));
  const pipelineMenuShowTailDivider = agentPipelineCardMenuShowDividerBeforeTail(pipelineMenuKeys);

  useEffect(() => {
    if (!menuOpen) return;
    void onMarkNewLeadSeenOnMenuOpen(deal);
  }, [menuOpen, deal.id, onMarkNewLeadSeenOnMenuOpen, deal]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg border border-[#2C2C2C]/10 bg-white p-4 shadow-sm",
        isDragging && "scale-105 shadow-xl",
        isArchived && "opacity-50 grayscale-[30%]",
        propRemoved && !isArchived && "opacity-50",
      )}
    >
      <div
        className="touch-none"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6B9E6E]/20 text-sm font-semibold text-[#6B9E6E] relative">
              {deal.client_avatar_url ? (
                <SupabasePublicImage src={deal.client_avatar_url} alt="" fill sizes="40px" className="object-cover" />
              ) : (
                clientInitials(deal.name)
              )}
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
              <span className="relative inline-flex shrink-0">
                <button
                  type="button"
                  aria-label="More options"
                  aria-expanded={menuOpen}
                  onClick={() => {
                    setMenuMoveOpen(false);
                    setMenuOpenId(menuOpen ? null : deal.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {showCornerPulseDot ? (
                  <span
                    className={cn(
                      "pointer-events-none absolute -right-0.5 -top-0.5 z-[12] h-2 w-2 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]",
                      "bhg-doc-badge-pulse",
                      anyMenuOpen && "opacity-0",
                    )}
                    aria-hidden
                  />
                ) : null}
              </span>
            </div>

            {menuOpen ? (
              <div
                className="absolute right-0 top-8 z-50 min-w-[260px] rounded-xl border border-gray-200 bg-white py-1 text-gray-900 shadow-md"
              >
                {!menuMoveOpen ? (
                  <>
                    {deal.pipeline_stage === "lead" &&
                    vrScheduled &&
                    formatRequestedViewingMenuLine(vrScheduled) ? (
                      <>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left hover:bg-gray-50"
                          onClick={() => {
                            void markViewingRequestSeen(deal.id);
                            setMenuOpenId(null);
                          }}
                        >
                          <p className="text-[11px] font-semibold text-gray-500">Requested viewing</p>
                          <p className="mt-0.5 flex items-center gap-2 font-sans text-[13px] font-semibold text-[#2C2C2C]">
                            <span className="min-w-0 flex-1 leading-snug">
                              {formatRequestedViewingMenuLine(vrScheduled)}
                            </span>
                            {showVrMenuDot ? (
                              <span
                                aria-hidden
                                className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                              />
                            ) : null}
                          </p>
                          {vrUpdatedSubtitle ? (
                            <p className="mt-0.5 text-[10px] text-gray-500">{vrUpdatedSubtitle}</p>
                          ) : null}
                        </button>
                        <div className="my-1 h-px bg-gray-200" />
                      </>
                    ) : null}
                    {deal.pipeline_stage === "viewing" &&
                    scheduledViewing?.scheduledAtRaw?.trim() &&
                    formatRequestedViewingMenuLine(scheduledViewing.scheduledAtRaw) ? (
                      <>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left hover:bg-gray-50"
                          onClick={() => {
                            void markViewingRequestSeen(deal.id);
                            setMenuOpenId(null);
                          }}
                        >
                          <p className="text-[11px] font-semibold text-gray-500">Requested viewing</p>
                          <p className="mt-0.5 flex items-center gap-2 font-sans text-[13px] font-semibold text-[#2C2C2C]">
                            <span className="min-w-0 flex-1 leading-snug">
                              {formatRequestedViewingMenuLine(scheduledViewing.scheduledAtRaw)}
                            </span>
                            {showVrMenuDot ? (
                              <span
                                aria-hidden
                                className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                              />
                            ) : null}
                          </p>
                        </button>
                        {reschedulePending ? (
                          <>
                            <div className="my-1 h-px bg-gray-200" />
                            <div className="mx-2 mb-2 rounded-md border border-[#D4A843]/40 bg-[#FAF8F4]/50 p-2">
                              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#D4A843]">
                                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                                RESCHEDULE REQUESTED
                              </p>
                              <p className="mt-1 font-sans text-[12px] font-semibold leading-snug text-[#2C2C2C]">
                                New time:{" "}
                                {formatRequestedViewingMenuLine(reschedulePending.requestedScheduledAt)}
                              </p>
                              <p className="mt-0.5 font-sans text-[12px] font-medium leading-snug text-[#2C2C2C]/70">
                                Current:{" "}
                                {formatRequestedViewingMenuLine(reschedulePending.currentScheduledAt)}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className="min-w-[4.5rem] flex-1 rounded-md bg-[#6B9E6E] px-2 py-1.5 text-center text-[11px] font-bold text-white hover:bg-[#5a8a5d]"
                                  onClick={() => {
                                    void (async () => {
                                      await markViewingRequestSeen(deal.id);
                                      setMenuOpenId(null);
                                      await onRescheduleAccept(reschedulePending.viewingId);
                                    })();
                                  }}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="min-w-[4.5rem] flex-1 rounded-md border border-[#2C2C2C]/25 bg-white px-2 py-1.5 text-center text-[11px] font-bold text-[#2C2C2C]/80 hover:bg-gray-50"
                                  onClick={() => {
                                    void (async () => {
                                      await markViewingRequestSeen(deal.id);
                                      setMenuOpenId(null);
                                      await onRescheduleDecline(reschedulePending.viewingId);
                                    })();
                                  }}
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  className="w-full rounded-md border border-[#6B9E6E] bg-white px-2 py-1.5 text-center text-[11px] font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10"
                                  onClick={() => {
                                    void markViewingRequestSeen(deal.id);
                                    setMenuOpenId(null);
                                    onOpenCounterReschedule(deal, reschedulePending);
                                  }}
                                >
                                  Counter
                                </button>
                              </div>
                            </div>
                          </>
                        ) : null}
                        <div className="my-1 h-px bg-gray-200" />
                      </>
                    ) : null}
                    {pipelineMenuKeys.has("pin") ? (
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
                    ) : null}
                    {pipelineMenuKeys.has("viewDetails") ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onOpenLeadDetails(deal.id);
                          setMenuOpenId(null);
                        }}
                      >
                        <span className="min-w-0 flex-1">View Details</span>
                        {showLeadMenuDot ? (
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                          />
                        ) : null}
                      </button>
                    ) : null}
                    {pipelineMenuKeys.has("viewDocuments") ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onOpenDocs(deal);
                          setMenuOpenId(null);
                        }}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                        <span className="min-w-0 flex-1">View Documents</span>
                        {unviewedUploadedDocCount > 0 ? (
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                          />
                        ) : null}
                      </button>
                    ) : null}
                    {pipelineMenuKeys.has("messages") && onOpenMessagesForClient && deal.client_id?.trim() ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onOpenMessagesForClient(deal.client_id!.trim());
                          setMenuOpenId(null);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                        <span className="min-w-0 flex-1">Messages</span>
                        {showMsgMenuDot ? (
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E] shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
                          />
                        ) : null}
                      </button>
                    ) : null}
                    {pipelineMenuKeys.has("editNotes") ? (
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
                    ) : null}
                    {pipelineMenuKeys.has("requestDocuments") ? (
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
                    ) : null}
                    {pipelineMenuShowTailDivider ? <div className="my-1 h-px bg-gray-200" /> : null}
                    {AGENT_PIPELINE_MENU_SEND_OFFER && pipelineMenuKeys.has("sendOffer") ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onSendOffer(deal);
                          setMenuOpenId(null);
                        }}
                      >
                        <Handshake className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                        <span className="min-w-0 flex-1">Send Offer</span>
                      </button>
                    ) : null}
                    {pipelineMenuKeys.has("createReservation") ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                        onClick={() => {
                          onCreateReservation(deal);
                          setMenuOpenId(null);
                        }}
                      >
                        <Lock className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                        <span className="min-w-0 flex-1">Create Reservation</span>
                      </button>
                    ) : null}
                    {pipelineMenuKeys.has("markClosed") ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-[#6B9E6E] hover:bg-gray-50"
                        onClick={() => {
                          onMarkClosed(deal);
                          setMenuOpenId(null);
                        }}
                      >
                        <CircleCheck className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                        <span className="min-w-0 flex-1">Mark as Closed</span>
                      </button>
                    ) : null}
                    {pipelineMenuKeys.has("declineArchive") ? (
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
                    ) : null}
                    {pipelineMenuKeys.has("moveTo") ? (
                      <div className="relative">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => setMenuMoveOpen(true)}
                        >
                          Move to…
                        </button>
                      </div>
                    ) : null}
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
                          void onMoveToStage(deal, s.id);
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
          {deal.property_id && !propRemoved ? (
            <Link
              href={`/properties/${deal.property_id}`}
              className="font-medium text-[#6B9E6E] underline-offset-2 hover:underline"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {propLine}
            </Link>
          ) : (
            <p className={cn("font-medium", propRemoved ? "text-gray-400" : "text-[#6B9E6E]")}>
              {propLine}
              {propRemoved ? (
                <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                  Removed
                </span>
              ) : null}
            </p>
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
        <p className="mt-2 text-[10px] font-medium leading-snug text-[#6B9E6E]">
          → {nextStepForStage(deal.pipeline_stage)}
        </p>
      </div>

      <div
        className="mt-4 flex gap-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {next && moveLabel ? (
          <button
            type="button"
            onClick={() => {
              if (next) void onMoveToStage(deal, next);
            }}
            className="flex flex-1 items-center justify-center gap-0.5 rounded-xl bg-[#6B9E6E] py-2 text-xs font-semibold text-white hover:bg-[#5a8a5d]"
          >
            <span aria-hidden className="text-[10px] opacity-95">
              →
            </span>
            {moveLabel}
          </button>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-2 text-xs font-semibold text-[#6B9E6E]">
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
        </button>
      </div>
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
  archivedLeads,
  propertyLabel,
  supabase,
  onRefresh,
  onOpenLeadDetails,
  /** `agents.id` for the listing agent whose pipeline is shown (supervisor when logged in as team_member). */
  pipelineAgentId,
  /** Profile UUID matching `leads.agent_id` (logged-in user, or supervising agent when team member view). */
  leadsAgentUserId,
  messagingAgentUserId = null,
  /** When set (team member view), client documents shared with this user id are loaded (supervising agent). */
  clientDocsSharedWithUserId,
  viewingRequestMetaByLeadId = {},
  onOpenMessagesForClient,
}: {
  leads: PipelineLeadRow[];
  archivedLeads: PipelineLeadRow[];
  propertyLabel: (propertyId: string | null) => string;
  supabase: SupabaseClient;
  onRefresh: () => void;
  onOpenLeadDetails: (leadId: number) => void;
  pipelineAgentId: string;
  /** Profile UUID matching `leads.agent_id` (must match `AgentViewingsProvider` agentUserId). */
  leadsAgentUserId: string;
  messagingAgentUserId?: string | null;
  clientDocsSharedWithUserId?: string;
  viewingRequestMetaByLeadId?: Record<number, ViewingRequestPipelineMeta>;
  onOpenMessagesForClient?: (clientUserId: string) => void;
}) {
  void leadsAgentUserId;
  const sortStorageKey = useMemo(() => `bhg:pipeline:sort:${pipelineAgentId}`, [pipelineAgentId]);
  const [sortMode, setSortMode] = useState<PipelineSortMode>("last_activity_desc");
  const [filterStages, setFilterStages] = useState<PipelineStageId[] | null>(null);
  const [filterCities, setFilterCities] = useState<string[]>([]);
  const [optimisticPinById, setOptimisticPinById] = useState<Record<number, { pinned: boolean; pinned_at: string | null }>>({});

  const streamUnreadByLeadId = useLeadStreamUnreadMap(
    messagingAgentUserId ?? null,
    useMemo(() => leads.map((l) => ({ id: l.id, client_id: l.client_id ?? null })), [leads]),
  );

  const markNewLeadSeenOnMenuOpen = useCallback(
    async (d: PipelineLeadRow) => {
      const { data } = await supabase
        .from("leads")
        .update({ new_lead_seen_at: new Date().toISOString() })
        .eq("id", d.id)
        .is("new_lead_seen_at", null)
        .select("id")
        .maybeSingle();
      if (data) await Promise.resolve(onRefresh());
    },
    [supabase, onRefresh],
  );

  const markViewingRequestSeen = useCallback(
    async (leadId: number) => {
      const { data } = await supabase
        .from("leads")
        .update({ new_viewing_request_seen_at: new Date().toISOString() })
        .eq("id", leadId)
        .is("new_viewing_request_seen_at", null)
        .select("id")
        .maybeSingle();
      if (data) await Promise.resolve(onRefresh());
    },
    [supabase, onRefresh],
  );

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
  const [pipelineVault, setPipelineVault] = useState<"active" | "archived">("active");
  const [pipelineSearchQuery, setPipelineSearchQuery] = useState("");

  const deals = useMemo(() => {
    return leads
      .filter((l) => String(l.pipeline_stage ?? "").toLowerCase() !== "declined")
      .map((l) => ({
        ...l,
        pipeline_stage: normalizeStage(l.pipeline_stage as string),
      }));
  }, [leads]);

  const { viewings: agentViewings, refetch: refetchAgentViewings } = useAgentViewings();
  const scheduledViewingByLeadId = useMemo(() => {
    const want = new Set(deals.map((d) => coerceLeadId(d.id)).filter((id): id is number => id != null));
    const m = new Map<number, ParsedViewing>();
    for (const v of agentViewings) {
      if (!want.has(v.leadId)) continue;
      if (!m.has(v.leadId)) m.set(v.leadId, v);
    }
    return m;
  }, [agentViewings, deals]);

  const handleRescheduleAccept = useCallback(
    async (viewingId: string) => {
      try {
        const res = await fetch(`/api/viewings/${encodeURIComponent(viewingId)}/accept-reschedule`, {
          method: "POST",
          credentials: "include",
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          toast.error(json?.error?.message ?? "Could not accept reschedule");
          return;
        }
        toast.success("Viewing updated");
        await refetchAgentViewings();
        await Promise.resolve(onRefresh());
      } catch {
        toast.error("Could not accept reschedule");
      }
    },
    [refetchAgentViewings, onRefresh],
  );

  const handleRescheduleDecline = useCallback(
    async (viewingId: string) => {
      try {
        const res = await fetch(`/api/viewings/${encodeURIComponent(viewingId)}/decline-reschedule`, {
          method: "POST",
          credentials: "include",
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          toast.error(json?.error?.message ?? "Could not decline reschedule");
          return;
        }
        toast.success("Reschedule dismissed");
        await refetchAgentViewings();
        await Promise.resolve(onRefresh());
      } catch {
        toast.error("Could not decline reschedule");
      }
    },
    [refetchAgentViewings, onRefresh],
  );

  const openCounterRescheduleModal = useCallback((lead: PipelineLeadRow, meta: ReschedulePendingMeta) => {
    setViewingConfirmMode("counter");
    setCounterRescheduleViewingId(meta.viewingId);
    setCounterRescheduleRefs({
      currentIso: meta.currentScheduledAt,
      requestedIso: meta.requestedScheduledAt,
    });
    setViewingConfirmLead(lead);
  }, []);

  useEffect(() => {
    const viewingLeadIds = deals
      .filter((d) => String(d.pipeline_stage).toLowerCase() === "viewing")
      .map((d) => d.id)
      .filter((id): id is number => typeof id === "number");
    if (viewingLeadIds.length === 0) {
      setReschedulePendingByLeadId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: vwRows, error: vwErr } = await supabase
        .from("viewings")
        .select("id, lead_id, scheduled_at, reschedule_request_id")
        .in("lead_id", viewingLeadIds);
      if (cancelled) return;
      if (vwErr) {
        const missingRescheduleColumn =
          vwErr.code === "42703" && String(vwErr.message ?? "").includes("reschedule_request_id");
        if (missingRescheduleColumn) {
          if (!viewingsRescheduleColumnHintLogged) {
            viewingsRescheduleColumnHintLogged = true;
            console.info(
              "[agent-pipeline] Reschedule UI needs DB migration: run `supabase/migrations/20260502100000_viewings_reschedule_request.sql` against your project (adds viewings.reschedule_request_id).",
            );
          }
        } else {
          console.warn("[agent-pipeline] viewings reschedule fetch failed", vwErr);
        }
        setReschedulePendingByLeadId({});
        return;
      }
      if (!vwRows?.length) {
        setReschedulePendingByLeadId({});
        return;
      }
      const pendingIds = [
        ...new Set(
          (vwRows as { reschedule_request_id?: string | null }[])
            .map((r) => (r.reschedule_request_id ?? "").trim())
            .filter(Boolean),
        ),
      ];
      if (pendingIds.length === 0) {
        setReschedulePendingByLeadId({});
        return;
      }
      const { data: vrRows, error: vrErr } = await supabase
        .from("viewing_requests")
        .select("id, scheduled_at")
        .in("id", pendingIds);
      if (cancelled) return;
      if (vrErr) {
        console.warn("[agent-pipeline] viewing_requests reschedule fetch failed", vrErr);
        return;
      }
      const vrMap = new Map(
        ((vrRows ?? []) as { id: string; scheduled_at: string }[]).map((r) => [String(r.id), String(r.scheduled_at)]),
      );
      const out: Record<number, ReschedulePendingMeta> = {};
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
      setReschedulePendingByLeadId(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [deals, supabase]);

  const [dealValueByPropertyId, setDealValueByPropertyId] = useState<Record<string, string>>({});
  const [dealValueNumberByPropertyId, setDealValueNumberByPropertyId] = useState<Record<string, number>>({});
  const [propertyMetaById, setPropertyMetaById] = useState<Record<string, PropertyMeta>>({});

  useEffect(() => {
    const set = new Set<string>();
    for (const d of deals) {
      const id = d.property_id;
      if (typeof id === "string" && id.trim()) set.add(id.trim());
    }
    for (const a of archivedLeads) {
      const id = a.property_id;
      if (typeof id === "string" && id.trim()) set.add(id.trim());
    }
    const ids = [...set];
    if (ids.length === 0) {
      setDealValueByPropertyId({});
      setDealValueNumberByPropertyId({});
      setPropertyMetaById({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, city, location, price, rent_price, listing_type, status, deleted_at, availability_state")
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
        deleted_at?: string | null;
        availability_state?: string | null;
      }[]) {
        const location = String(row.location ?? "").trim();
        const canonicalCity = propertyCanonicalCity({ city: row.city, location });
        meta[row.id] = {
          city: canonicalCity,
          location,
          deleted_at: row.deleted_at != null ? String(row.deleted_at) : null,
          availability_state: row.availability_state != null ? String(row.availability_state) : null,
        };

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
  }, [deals, archivedLeads, supabase]);

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
  const [viewingConfirmLead, setViewingConfirmLead] = useState<PipelineLeadRow | null>(null);
  const [viewingConfirmMode, setViewingConfirmMode] = useState<"confirm" | "counter">("confirm");
  const [counterRescheduleViewingId, setCounterRescheduleViewingId] = useState<string | null>(null);
  const [counterRescheduleRefs, setCounterRescheduleRefs] = useState<{
    currentIso: string;
    requestedIso: string;
  } | null>(null);
  const [viewingConfirmDate, setViewingConfirmDate] = useState("");
  const [viewingConfirmTime, setViewingConfirmTime] = useState("");
  const [viewingConfirmInlineError, setViewingConfirmInlineError] = useState<string | null>(null);
  const [viewingConfirmNotes, setViewingConfirmNotes] = useState("");
  const [viewingConfirmBusy, setViewingConfirmBusy] = useState(false);
  const [reschedulePendingByLeadId, setReschedulePendingByLeadId] = useState<
    Record<number, ReschedulePendingMeta>
  >({});
  const [offerCreatedAtByLeadId, setOfferCreatedAtByLeadId] = useState<Record<number, string | null>>({});
  const [reservationCreatedAtByLeadId, setReservationCreatedAtByLeadId] = useState<
    Record<number, string | null>
  >({});
  const [offerLead, setOfferLead] = useState<PipelineLeadRow | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [offerAgreementFile, setOfferAgreementFile] = useState<File | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);
  const [reservationLead, setReservationLead] = useState<PipelineLeadRow | null>(null);
  const [reservationOfferOptions, setReservationOfferOptions] = useState<{ id: string; created_at: string; amount: number; currency: string }[]>([]);
  const [reservationOfferId, setReservationOfferId] = useState<string>("");
  const [reservationAmount, setReservationAmount] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [reservationAgreementFile, setReservationAgreementFile] = useState<File | null>(null);
  const [reservationBusy, setReservationBusy] = useState(false);
  const [offerUploadProgress, setOfferUploadProgress] = useState<number | null>(null);
  const [reservationUploadProgress, setReservationUploadProgress] = useState<number | null>(null);
  const [closeLead, setCloseLead] = useState<PipelineLeadRow | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
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

  const offerFormValid = useMemo(() => {
    const n = Number.parseFloat(String(offerAmount ?? "").trim());
    return Number.isFinite(n) && n > 0;
  }, [offerAmount]);

  const reservationFormValid = useMemo(() => {
    const n = Number.parseFloat(String(reservationAmount ?? "").trim());
    return Number.isFinite(n) && n > 0;
  }, [reservationAmount]);

  /** Manila "today" / current time for date min and time min; recomputes when date selection changes. */
  const viewingConfirmManilaInputs = useMemo(() => {
    if (!viewingConfirmLead) return null;
    const n = new Date();
    const dateMin = manilaDateStringFromInstant(n);
    const timeMin = viewingConfirmDate === dateMin ? manilaTimeStringFromInstant(n) : undefined;
    return { dateMin, timeMin };
  }, [viewingConfirmLead, viewingConfirmDate]);

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

  const visibleDeals = useMemo(
    () =>
      effectiveDeals.filter((d) =>
        leadMatchesPipelineSearch(d, pipelineSearchQuery, propertyLabel, propertyMetaById),
      ),
    [effectiveDeals, pipelineSearchQuery, propertyLabel, propertyMetaById],
  );

  const archivedVisibleLeads = useMemo(
    () =>
      archivedLeads.filter((d) =>
        leadMatchesPipelineSearch(d, pipelineSearchQuery, propertyLabel, propertyMetaById),
      ),
    [archivedLeads, pipelineSearchQuery, propertyLabel, propertyMetaById],
  );

  const counts = useMemo(() => {
    const c: Record<PipelineStageId, number> = {
      lead: 0,
      viewing: 0,
      offer: 0,
      reservation: 0,
      closed: 0,
    };
    for (const d of visibleDeals) {
      c[d.pipeline_stage]++;
    }
    return c;
  }, [visibleDeals]);

  const stageSorter = useMemo(() => sortDealsInStage({ sortMode, propertyMetaById }), [propertyMetaById, sortMode]);

  const baseSorted = useMemo(() => {
    return visibleDeals.filter((d) => d.pipeline_stage === filterStage).slice().sort(stageSorter);
  }, [visibleDeals, filterStage, stageSorter]);

  const dealsByStage = useMemo(() => {
    const m: Record<PipelineStageId, PipelineLeadRow[]> = {
      lead: [],
      viewing: [],
      offer: [],
      reservation: [],
      closed: [],
    };
    for (const d of visibleDeals) m[d.pipeline_stage].push(d);
    for (const s of STAGE_ORDER) m[s] = m[s].slice().sort(stageSorter);
    return m;
  }, [visibleDeals, stageSorter]);

  const leadById = useMemo(() => {
    const m = new Map<string, PipelineLeadRow>();
    for (const d of visibleDeals) m.set(String(d.id), d);
    return m;
  }, [visibleDeals]);

  const [kanbanIdsByStage, setKanbanIdsByStage] = useState<Record<PipelineStageId, string[]>>({
    lead: [],
    viewing: [],
    offer: [],
    reservation: [],
    closed: [],
  });

  /** Blocks syncing `kanbanIdsByStage` from `dealsByStage` while a stage mutation / debounced refresh is in flight (prevents snap-back). */
  const [kanbanBoardMutationDepth, setKanbanBoardMutationDepth] = useState(0);
  const kanbanIdsRef = useRef(kanbanIdsByStage);
  useEffect(() => {
    kanbanIdsRef.current = kanbanIdsByStage;
  }, [kanbanIdsByStage]);

  useEffect(() => {
    if (kanbanBoardMutationDepth > 0) return;
    setKanbanIdsByStage({
      lead: dealsByStage.lead.map((d) => String(d.id)),
      viewing: dealsByStage.viewing.map((d) => String(d.id)),
      offer: dealsByStage.offer.map((d) => String(d.id)),
      reservation: dealsByStage.reservation.map((d) => String(d.id)),
      closed: dealsByStage.closed.map((d) => String(d.id)),
    });
  }, [dealsByStage, kanbanBoardMutationDepth]);

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
    const leadIds = deals.map((d) => coerceLeadId(d.id)).filter((id): id is number => id != null);
    if (leadIds.length === 0) {
      setUploadedRequestedDocCountByLeadId({});
      setUnviewedUploadedDocCountByLeadId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("deal_documents")
        .select("lead_id, status, viewed_by_agent_at")
        .in("lead_id", leadIds)
        .in("status", ["pending", "uploaded"]);
      if (cancelled) return;
      if (error) {
        console.error("[agent-pipeline] badge query failed", { leadIds, message: error.message });
        setUploadedRequestedDocCountByLeadId({});
        setUnviewedUploadedDocCountByLeadId({});
        return;
      }
      const uploadedNext: Record<number, number> = {};
      const unviewedNext: Record<number, number> = {};
      for (const row of (data ?? []) as { lead_id: unknown; status: string | null; viewed_by_agent_at: string | null }[]) {
        const lid = coerceLeadId(row.lead_id);
        if (lid == null) continue;
        const st = (row.status ?? "").trim().toLowerCase();
        if (st !== "pending" && st !== "uploaded") continue;
        uploadedNext[lid] = (uploadedNext[lid] ?? 0) + 1;
        if (st === "uploaded" && row.viewed_by_agent_at == null) {
          unviewedNext[lid] = (unviewedNext[lid] ?? 0) + 1;
        }
      }
      console.debug("[agent-pipeline] badge query rows", {
        leadCount: leadIds.length,
        rowCount: (data ?? []).length,
        counts: uploadedNext,
      });
      setUploadedRequestedDocCountByLeadId(uploadedNext);
      setUnviewedUploadedDocCountByLeadId(unviewedNext);
    })();
    return () => {
      cancelled = true;
    };
  }, [deals, supabase]);

  useEffect(() => {
    const leadIds = deals.map((d) => coerceLeadId(d.id)).filter((id): id is number => id != null);
    if (leadIds.length === 0) {
      setReservationCreatedAtByLeadId({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("lead_id, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("[agent-pipeline] reservations query failed", { message: error.message });
        setReservationCreatedAtByLeadId({});
        return;
      }

      const out: Record<number, string | null> = {};
      for (const row of (data ?? []) as { lead_id: unknown; created_at: string }[]) {
        const lid = coerceLeadId(row.lead_id);
        if (lid == null) continue;
        if (out[lid] != null) continue;
        out[lid] = row.created_at ?? null;
      }
      setReservationCreatedAtByLeadId(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [deals, supabase]);

  useEffect(() => {
    const leadIds = deals.map((d) => coerceLeadId(d.id)).filter((id): id is number => id != null);
    if (leadIds.length === 0) {
      setOfferCreatedAtByLeadId({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("lead_id, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("[agent-pipeline] offers query failed", { message: error.message });
        setOfferCreatedAtByLeadId({});
        return;
      }

      const out: Record<number, string | null> = {};
      for (const row of (data ?? []) as { lead_id: unknown; created_at: string }[]) {
        const lid = coerceLeadId(row.lead_id);
        if (lid == null) continue;
        if (out[lid] != null) continue;
        out[lid] = row.created_at ?? null;
      }
      setOfferCreatedAtByLeadId(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [deals, supabase]);

  useEffect(() => {
    if (!viewingConfirmLead) return;
    let cancelled = false;
    const lead = viewingConfirmLead;

    void (async () => {
      if (viewingConfirmMode === "counter" && counterRescheduleRefs?.requestedIso) {
        const rq = new Date(counterRescheduleRefs.requestedIso);
        let dateStr = manilaDateStringFromInstant(rq);
        const timeStrRaw = manilaTimeStringFromInstant(rq);
        const normalizedFromRq = normalizeTimeHmForInput(timeStrRaw);
        let timeFinal = normalizedFromRq ?? DEFAULT_VIEWING_CONFIRM_TIME;
        if (cancelled) return;
        const todayYmd = manilaDateStringFromInstant(new Date());
        if (dateStr < todayYmd) dateStr = todayYmd;
        if (dateStr === todayYmd) {
          const nowHm = manilaTimeStringFromInstant(new Date());
          if (timeFinal < nowHm) timeFinal = nowHm;
        }
        setViewingConfirmInlineError(null);
        setViewingConfirmDate(dateStr);
        setViewingConfirmTime(timeFinal);
        setViewingConfirmNotes("");
        return;
      }

      let dateStr = manilaDateStringFromInstant(new Date());
      let timeStr = "";

      const slot = agentViewings.find((v) => v.leadId === lead.id);
      if (slot?.scheduledAtRaw) {
        const d = new Date(slot.scheduledAtRaw);
        dateStr = manilaDateStringFromInstant(d);
        timeStr = manilaTimeStringFromInstant(d);
      } else if (lead.viewing_request_id?.trim()) {
        const { data, error } = await supabase
          .from("viewing_requests")
          .select("scheduled_at, preferred_date, preferred_time")
          .eq("id", lead.viewing_request_id.trim())
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          const row = data as {
            scheduled_at?: string | null;
            preferred_date?: string | null;
            preferred_time?: string | null;
          };
          if (row.preferred_date && /^\d{4}-\d{2}-\d{2}/.test(String(row.preferred_date))) {
            dateStr = String(row.preferred_date).slice(0, 10);
          } else if (row.scheduled_at) {
            dateStr = manilaDateStringFromInstant(new Date(row.scheduled_at));
          }
          const pt = row.preferred_time?.trim();
          if (pt && normalizeTimeHmForInput(pt)) {
            timeStr = normalizeTimeHmForInput(pt)!;
          } else if (row.scheduled_at) {
            timeStr = manilaTimeStringFromInstant(new Date(row.scheduled_at));
          }
        }
      }

      if (cancelled) return;
      const todayYmd = manilaDateStringFromInstant(new Date());
      if (dateStr < todayYmd) dateStr = todayYmd;
      const normalizedFromSources = timeStr.trim() ? normalizeTimeHmForInput(timeStr.trim()) : null;
      let timeFinal = normalizedFromSources ?? DEFAULT_VIEWING_CONFIRM_TIME;
      if (dateStr === todayYmd) {
        const nowHm = manilaTimeStringFromInstant(new Date());
        if (timeFinal < nowHm) timeFinal = nowHm;
      }
      setViewingConfirmInlineError(null);
      setViewingConfirmDate(dateStr);
      setViewingConfirmTime(timeFinal);
      setViewingConfirmNotes("");
    })();

    return () => {
      cancelled = true;
    };
  }, [viewingConfirmLead, viewingConfirmMode, counterRescheduleRefs, agentViewings, supabase]);

  useEffect(() => {
    if (!offerLead) return;
    setOfferAmount("");
    setOfferMessage("");
    setOfferAgreementFile(null);
    setOfferBusy(false);
    setOfferUploadProgress(null);
  }, [offerLead?.id]);

  useEffect(() => {
    if (!reservationLead) return;
    setReservationOfferId("");
    setReservationAmount("");
    setReservationNotes("");
    setReservationAgreementFile(null);
    setReservationBusy(false);
    setReservationUploadProgress(null);
    setReservationOfferOptions([]);

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id, created_at, amount, currency, status")
        .eq("lead_id", reservationLead.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setReservationOfferOptions([]);
        return;
      }
      const rows = (data ?? []) as { id: string; created_at: string; amount: number; currency: string; status: string }[];
      setReservationOfferOptions(rows.map((r) => ({ id: r.id, created_at: r.created_at, amount: r.amount, currency: r.currency })));
    })();

    return () => {
      cancelled = true;
    };
  }, [reservationLead?.id, supabase]);

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
          console.error("[agent-pipeline] loadDocs deal_documents query failed", {
            leadId: lead.id,
            message: dealErr.message,
          });
          toast.error(dealErr.message);
          setDealDocCheckRows([]);
          setUploadedRequestedDocCountByLeadId((prev) => ({ ...prev, [lead.id]: 0 }));
          setUnviewedUploadedDocCountByLeadId((prev) => ({ ...prev, [lead.id]: 0 }));
        } else {
          const rows = (dealData ?? []) as DealDocCheckRow[];
          setDealDocCheckRows(rows);
          const isPipelinePendingOrUploaded = (r: DealDocCheckRow) => {
            const st = (r.status ?? "").trim().toLowerCase();
            return st === "pending" || st === "uploaded";
          };
          const isUnviewedUploaded = (r: DealDocCheckRow) => {
            const st = (r.status ?? "").trim().toLowerCase();
            return st === "uploaded" && r.viewed_by_agent_at == null;
          };
          const uploadedForLead = rows.filter(isPipelinePendingOrUploaded).length;
          const unviewedForLead = rows.filter(isUnviewedUploaded).length;
          console.debug("[agent-pipeline] loadDocs rows", {
            leadId: lead.id,
            totalRows: rows.length,
            badgeCount: uploadedForLead,
            unviewedCount: unviewedForLead,
            uploadedRows: rows.filter((r) => (r.status ?? "").trim().toLowerCase() === "uploaded").length,
          });
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

    if (toStage === "viewing" && fromStage !== "viewing") {
      const lead = leadById.get(activeId);
      if (lead) {
        setViewingConfirmMode("confirm");
        setCounterRescheduleViewingId(null);
        setCounterRescheduleRefs(null);
        setViewingConfirmLead(lead);
      }
      return;
    }

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

    const revertSnapshot = cloneKanbanIdsByStage(kanbanIdsByStage);
    setKanbanIdsByStage((s) => {
      const fromIds = s[fromStage].filter((x) => x !== activeId);
      const toIds = s[toStage];
      const overIndex = toIds.includes(overId) ? toIds.indexOf(overId) : toIds.length;
      const nextTo = toIds.slice();
      nextTo.splice(overIndex, 0, activeId);
      return { ...s, [fromStage]: fromIds, [toStage]: nextTo };
    });

    const lead = leadById.get(activeId);
    if (lead) void moveDealToStage(lead, toStage, { revertSnapshot, kanbanAlreadyUpdated: true });
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

  const moveDealToStage = useCallback(
    async (
      lead: PipelineLeadRow,
      stage: PipelineStageId,
      opts?: { revertSnapshot?: Record<PipelineStageId, string[]>; kanbanAlreadyUpdated?: boolean },
    ) => {
      if (stage === "viewing" && lead.pipeline_stage !== "viewing") {
        setViewingConfirmMode("confirm");
        setCounterRescheduleViewingId(null);
        setCounterRescheduleRefs(null);
        setViewingConfirmLead(lead);
        return;
      }

      const id = String(lead.id);
      const boardNow = kanbanIdsRef.current;
      const from = findKanbanStageForLeadId(boardNow, id) ?? lead.pipeline_stage;
      if (from === stage) return;

      setKanbanBoardMutationDepth((d) => d + 1);
      const revert = opts?.revertSnapshot ?? cloneKanbanIdsByStage(boardNow);

      if (!opts?.kanbanAlreadyUpdated) {
        setKanbanIdsByStage((s0) => {
          const from0 = findKanbanStageForLeadId(s0, id) ?? lead.pipeline_stage;
          if (from0 === stage) return s0;
          const fromIds = s0[from0].filter((x) => x !== id);
          const toIds = s0[stage].filter((x) => x !== id);
          return { ...s0, [from0]: fromIds, [stage]: [...toIds, id] };
        });
      }

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
          setKanbanIdsByStage(revert);
          return;
        }

        await new Promise((r) => setTimeout(r, 500));
        await Promise.resolve(onRefresh());
      } finally {
        setMoveToStageBusyId(null);
        setKanbanBoardMutationDepth((d) => d - 1);
      }
    },
    [onRefresh],
  );

  const closeViewingConfirmModal = () => {
    if (viewingConfirmBusy) return;
    setViewingConfirmInlineError(null);
    setViewingConfirmMode("confirm");
    setCounterRescheduleViewingId(null);
    setCounterRescheduleRefs(null);
    setViewingConfirmLead(null);
  };

  const submitViewingConfirm = async () => {
    if (!viewingConfirmLead) return;
    setViewingConfirmInlineError(null);
    const normalized = normalizeTimeHmForInput(viewingConfirmTime.trim());
    if (!viewingConfirmDate.trim() || !normalized) {
      toast.error("Choose a date and time.");
      return;
    }
    let scheduledIso: string;
    try {
      scheduledIso = manilaLocalDateTimeToOffsetIso(viewingConfirmDate.trim(), normalized);
    } catch {
      toast.error("Choose a date and time.");
      return;
    }
    if (new Date(scheduledIso).getTime() < Date.now()) {
      setViewingConfirmInlineError("Pick a future date and time.");
      return;
    }
    setViewingConfirmBusy(true);
    setKanbanBoardMutationDepth((d) => d + 1);
    try {
      if (viewingConfirmMode === "counter" && counterRescheduleViewingId) {
        const res = await fetch(
          `/api/viewings/${encodeURIComponent(counterRescheduleViewingId)}/counter-reschedule`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ scheduled_at: scheduledIso }),
          },
        );
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          const msg = json?.error?.message ?? "Could not send counter proposal";
          if (msg.includes("past") || msg.includes("future")) {
            setViewingConfirmInlineError("Pick a future date and time.");
          } else {
            toast.error(msg);
          }
          return;
        }
        toast.success("Counter proposal sent");
        setViewingConfirmInlineError(null);
        setViewingConfirmMode("confirm");
        setCounterRescheduleViewingId(null);
        setCounterRescheduleRefs(null);
        setViewingConfirmLead(null);
        await refetchAgentViewings();
        await new Promise((r) => setTimeout(r, 200));
        await Promise.resolve(onRefresh());
        return;
      }

      const res = await fetch("/api/agent/pipeline-confirm-viewing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          leadId: viewingConfirmLead.id,
          date: viewingConfirmDate.trim(),
          time: normalized,
          notes: viewingConfirmNotes.trim() ? viewingConfirmNotes.trim().slice(0, 300) : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        const msg = json?.error?.message ?? "Could not confirm viewing";
        if (msg.includes("scheduled_at cannot be in the past") || msg.includes("in the past")) {
          setViewingConfirmInlineError("Pick a future date and time.");
        } else {
          toast.error(msg);
        }
        return;
      }
      toast.success("Viewing scheduled");
      setViewingConfirmInlineError(null);
      setViewingConfirmMode("confirm");
      setCounterRescheduleViewingId(null);
      setCounterRescheduleRefs(null);
      setViewingConfirmLead(null);
      await new Promise((r) => setTimeout(r, 400));
      await Promise.resolve(onRefresh());
    } finally {
      setViewingConfirmBusy(false);
      setKanbanBoardMutationDepth((d) => d - 1);
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

  const vaultPills = (
    <>
      <button
        type="button"
        onClick={() => setPipelineVault("active")}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-bold transition",
          pipelineVault === "active"
            ? "bg-[#6B9E6E] text-white shadow-sm"
            : "border border-[#2C2C2C]/12 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/35",
        )}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => setPipelineVault("archived")}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-bold transition",
          pipelineVault === "archived"
            ? "bg-[#6B9E6E] text-white shadow-sm"
            : "border border-[#2C2C2C]/12 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/35",
        )}
      >
        Archived
        <span className="ml-1 tabular-nums opacity-90">({archivedLeads.length})</span>
      </button>
    </>
  );

  return (
    <div className="w-full min-w-0 max-w-full bg-[#FAF8F4] font-sans text-[#2C2C2C]">
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
      <div className="flex w-full min-w-0 flex-col gap-2 pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-3 lg:gap-y-2 lg:pb-4">
        {pipelineVault === "active" ? (
          <>
            <div className="scrollbar-hide flex min-w-0 max-w-full flex-nowrap items-center gap-3 overflow-x-auto">
              <div className="flex shrink-0 flex-nowrap items-center gap-2 rounded-xl border border-[#2C2C2C]/[0.08] bg-white/90 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FAF8F4] text-[#2C2C2C]/75 hover:bg-[#6B9E6E]/10"
                    aria-label="Kanban view"
                  >
                    <LayoutGrid className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#2C2C2C]/45 hover:bg-[#FAF8F4]"
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#2C2C2C]/45 hover:bg-[#FAF8F4]"
                    aria-label="Refresh"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="hidden h-6 w-px shrink-0 bg-[#2C2C2C]/10 sm:block" aria-hidden />
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">{vaultPills}</div>
              </div>
              <div className="flex h-9 shrink-0 items-center rounded-xl border border-[#2C2C2C]/[0.08] bg-white/90 px-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="relative w-[min(100vw-8rem,340px)] sm:w-[320px]">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/40"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={pipelineSearchQuery}
                    onChange={(e) => setPipelineSearchQuery(e.target.value)}
                    placeholder="Search leads, deals, clients, or properties…"
                    className="h-8 w-full border-0 bg-transparent py-0 pl-8 pr-2 font-sans text-sm text-[#2C2C2C] outline-none placeholder:text-[#2C2C2C]/45 focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/30 focus-visible:ring-offset-0"
                    aria-label="Search pipeline"
                  />
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end lg:gap-3">
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#2C2C2C]/[0.08] bg-white/90 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
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
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]",
                        activeFilterCount > 0 && "bg-[#6B9E6E]/10 text-[#2C5F32]",
                      )}
                      aria-label="Filters"
                    >
                      <Filter className="h-3.5 w-3.5" aria-hidden />
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
                <select
                  value={pipelineKey}
                  onChange={(e) => setPipelineKey(e.target.value)}
                  className="rounded-lg border-0 bg-transparent py-1.5 pl-2 pr-7 text-xs font-semibold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#2C2C2C]/45 hover:text-[#2C2C2C]/70 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="More pipeline options"
                  title="Coming soon"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="scrollbar-hide flex w-full min-w-0 flex-nowrap items-center gap-3 overflow-x-auto">
            <div className="flex shrink-0 flex-wrap gap-2 rounded-xl border border-[#2C2C2C]/[0.08] bg-white/90 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {vaultPills}
            </div>
            <div className="flex h-9 shrink-0 items-center rounded-xl border border-[#2C2C2C]/[0.08] bg-white/90 px-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="relative w-[min(100vw-8rem,340px)] sm:w-[320px]">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/40"
                  aria-hidden
                />
                <input
                  type="search"
                  value={pipelineSearchQuery}
                  onChange={(e) => setPipelineSearchQuery(e.target.value)}
                  placeholder="Search leads, deals, clients, or properties…"
                  className="h-8 w-full border-0 bg-transparent py-0 pl-8 pr-2 font-sans text-sm text-[#2C2C2C] outline-none placeholder:text-[#2C2C2C]/45 focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/30 focus-visible:ring-offset-0"
                  aria-label="Search archived deals"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {pipelineVault === "active" ? (
        <>
      {pipelineSearchQuery.trim() ? (
        <p className="rounded-lg border border-[#6B9E6E]/25 bg-[#6B9E6E]/10 px-3 py-2 text-center font-sans text-xs font-semibold text-[#2C2C2C]">
          Showing {visibleDeals.length} deal{visibleDeals.length === 1 ? "" : "s"} matching{" "}
          <span className="font-bold text-[#2C5F32]">
            {"\u201c"}
            {pipelineSearchQuery.trim()}
            {"\u201d"}
          </span>
        </p>
      ) : null}
      <div className="flex flex-col gap-2 lg:hidden">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">Pipeline overview</p>
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
        <p className="mt-2 text-center text-[9px] font-semibold text-gray-500">
          Inquiry → Viewing → Offer → Reservation → Closed
        </p>
      </div>

      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
      <div className="touch-pan-y space-y-2 overscroll-contain md:touch-auto">
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
                  onSendOffer={(lead) => setOfferLead(lead)}
                  onCreateReservation={(lead) => setReservationLead(lead)}
                  onMarkClosed={(lead) => {
                    setCloseLead(lead);
                    setCloseBusy(false);
                  }}
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
                      toast.error("This deal is not linked to a client account yet.");
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
                  propertyMetaById={propertyMetaById}
                  viewingRequestMeta={viewingRequestMetaByLeadId[deal.id] ?? null}
                  scheduledViewing={scheduledViewingByLeadId.get(deal.id) ?? null}
                  reschedulePending={reschedulePendingByLeadId[deal.id] ?? null}
                  onRescheduleAccept={handleRescheduleAccept}
                  onRescheduleDecline={handleRescheduleDecline}
                  onOpenCounterReschedule={openCounterRescheduleModal}
                  messageUnreadCount={streamUnreadByLeadId[deal.id] ?? 0}
                  onMarkNewLeadSeenOnMenuOpen={markNewLeadSeenOnMenuOpen}
                  markViewingRequestSeen={markViewingRequestSeen}
                  onOpenMessagesForClient={onOpenMessagesForClient}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
      </div>

      {/* Desktop: Pipedrive-style kanban columns — toolbar stays fixed; columns scroll horizontally */}
      <div className="hidden w-full min-w-0 max-w-full overflow-x-hidden lg:block">
        <div className="relative w-full min-w-0">
          {kanbanFadeRight ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-[#FAF8F4] to-transparent"
            />
          ) : null}
          <div
            ref={kanbanScrollRef}
            className="relative isolate w-full min-w-0 overflow-x-auto overflow-y-visible overscroll-x-contain scroll-smooth bg-[#FAF8F4] px-1 py-2 scrollbar-hide"
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
              <div className="flex items-stretch gap-0 max-[1439px]:w-max max-[1439px]:min-w-[1440px] min-[1440px]:w-full min-[1440px]:min-w-0">
                {(filterStages && filterStages.length > 0
                  ? KANBAN_STAGE_ORDER.filter((s) => filterStages.includes(s))
                  : KANBAN_STAGE_ORDER
                ).map((stage, idx) => {
                  const label = PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
                  const list = dealsByStage[stage];
                  const count = stageTotals[stage]?.count ?? list.length;
                  const ids = kanbanIdsByStage[stage] ?? list.map((d) => String(d.id));
                  const barHex = stageBarHex(stage);

                  return (
                    <KanbanStageColumn
                      key={stage}
                      stage={stage}
                      idx={idx}
                      label={label}
                      count={count}
                      barHex={barHex}
                      ids={ids}
                      list={ids.map((id) => leadById.get(String(id))).filter((d): d is PipelineLeadRow => !!d)}
                      propertyLabel={propertyLabel}
                      dealValueByPropertyId={dealValueByPropertyId}
                      uploadedRequestedDocCountByLeadId={uploadedRequestedDocCountByLeadId}
                      unviewedUploadedDocCountByLeadId={unviewedUploadedDocCountByLeadId}
                      scheduledViewingByLeadId={scheduledViewingByLeadId}
                      offerCreatedAtByLeadId={offerCreatedAtByLeadId}
                      reservationCreatedAtByLeadId={reservationCreatedAtByLeadId}
                      openDocs={openDocs}
                      onSendOffer={(lead) => setOfferLead(lead)}
                      onCreateReservation={(lead) => setReservationLead(lead)}
                      onMarkClosed={(lead) => {
                        setCloseLead(lead);
                        setCloseBusy(false);
                      }}
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
                      viewingRequestMetaByLeadId={viewingRequestMetaByLeadId}
                      reschedulePendingByLeadId={reschedulePendingByLeadId}
                      streamUnreadByLeadId={streamUnreadByLeadId}
                      markNewLeadSeenOnMenuOpen={markNewLeadSeenOnMenuOpen}
                      markViewingRequestSeen={markViewingRequestSeen}
                      onOpenMessagesForClient={onOpenMessagesForClient}
                      onRescheduleAccept={handleRescheduleAccept}
                      onRescheduleDecline={handleRescheduleDecline}
                      onOpenCounterReschedule={openCounterRescheduleModal}
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
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {archivedLeads.length === 0 ? (
            <p className="text-center text-sm font-semibold text-[#2C2C2C]/45">
              No client-archived leads. When a client removes a property from their pipeline, it appears here with
              their reason.
            </p>
          ) : archivedVisibleLeads.length === 0 ? (
            <p className="text-center text-sm font-semibold text-[#2C2C2C]/45">No archived deals match your search.</p>
          ) : (
            <ul className="space-y-3">
              {archivedVisibleLeads.map((row) => {
                const propTitle = propertyLabel(row.property_id);
                const reasonLabel = labelForClientArchiveReason(row.archive_reason, row.archive_note);
                const stageRaw = String(row.stage_at_archive ?? row.pipeline_stage ?? "—");
                const stage = agentPipelineStageDisplayLabel(stageRaw);
                const archivedWhen = row.archived_at
                  ? formatRelativeTime(row.archived_at)
                  : "—";
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onOpenLeadDetails(row.id)}
                      className="w-full rounded-xl border border-[#2C2C2C]/[0.08] bg-[#FAF8F4]/60 px-4 py-3 text-left transition hover:border-[#6B9E6E]/35 hover:bg-white"
                    >
                      <p className="font-sans text-sm font-bold text-[#2C2C2C]">{propTitle}</p>
                      <p className="mt-0.5 font-sans text-xs text-[#2C2C2C]/55">
                        {row.name.trim() || "Client"} · {row.email}
                      </p>
                      <p className="mt-2 font-sans text-xs font-semibold text-[#2C2C2C]/70">
                        Reason: <span className="font-normal">{reasonLabel}</span>
                      </p>
                      <p className="mt-1 font-sans text-xs text-[#2C2C2C]/50">
                        Stage at archive: {stage} · {archivedWhen}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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

      <Dialog
        open={viewingConfirmLead != null}
        onOpenChange={(open) => {
          if (!open) closeViewingConfirmModal();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] overflow-y-auto border-[#2C2C2C]/10 bg-white text-[#2C2C2C] sm:max-w-md"
          onPointerDownOutside={(e) => {
            if (viewingConfirmBusy) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (viewingConfirmBusy) e.preventDefault();
          }}
        >
          <DialogHeader className="gap-1.5 text-left sm:text-left">
            <DialogTitle className="font-serif text-lg font-bold text-[#2C2C2C]">
              {viewingConfirmMode === "counter" ? "Propose a different time" : "Confirm viewing date and time"}
            </DialogTitle>
            <DialogDescription className="font-sans text-[13px] font-medium leading-snug text-[#2C2C2C]/65">
              Date and time are saved as Philippines local time (UTC+08:00).
            </DialogDescription>
          </DialogHeader>
          {viewingConfirmLead ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/50">Property</p>
                <p className="mt-0.5 font-sans text-sm font-semibold text-[#2C2C2C]">
                  {propertyLabel(viewingConfirmLead.property_id)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/50">Client</p>
                <p className="mt-0.5 font-sans text-sm font-semibold text-[#2C2C2C]">{viewingConfirmLead.name}</p>
              </div>
              {viewingConfirmMode === "counter" && counterRescheduleRefs?.currentIso && counterRescheduleRefs?.requestedIso ? (
                <div className="space-y-1.5 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2.5">
                  <p className="font-sans text-[12px] font-medium text-[#2C2C2C]/80">
                    <span className="font-semibold text-[#2C2C2C]">Currently confirmed:</span>{" "}
                    {formatRequestedViewingMenuLine(counterRescheduleRefs.currentIso)}
                  </p>
                  <p className="font-sans text-[12px] font-medium text-[#2C2C2C]/80">
                    <span className="font-semibold text-[#2C2C2C]">Client requested:</span>{" "}
                    {formatRequestedViewingMenuLine(counterRescheduleRefs.requestedIso)}
                  </p>
                </div>
              ) : null}
              <div>
                <label htmlFor="viewing-confirm-date" className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  id="viewing-confirm-date"
                  type="date"
                  required
                  value={viewingConfirmDate}
                  min={viewingConfirmManilaInputs?.dateMin}
                  onChange={(e) => {
                    setViewingConfirmInlineError(null);
                    setViewingConfirmDate(e.target.value);
                  }}
                  disabled={viewingConfirmBusy}
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/15"
                />
              </div>
              <div>
                <label htmlFor="viewing-confirm-time" className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                  Time <span className="text-red-600">*</span>
                </label>
                <input
                  id="viewing-confirm-time"
                  type="time"
                  required
                  value={viewingConfirmTime}
                  min={viewingConfirmManilaInputs?.timeMin}
                  onChange={(e) => {
                    setViewingConfirmInlineError(null);
                    setViewingConfirmTime(e.target.value);
                  }}
                  disabled={viewingConfirmBusy}
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/15"
                />
                {viewingConfirmInlineError ? (
                  <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                    {viewingConfirmInlineError}
                  </p>
                ) : null}
              </div>
              {viewingConfirmMode === "confirm" ? (
                <div>
                  <label htmlFor="viewing-confirm-notes" className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                    Notes <span className="font-normal normal-case text-[#2C2C2C]/45">(optional)</span>
                  </label>
                  <textarea
                    id="viewing-confirm-notes"
                    value={viewingConfirmNotes}
                    onChange={(e) => setViewingConfirmNotes(e.target.value.slice(0, 300))}
                    disabled={viewingConfirmBusy}
                    rows={3}
                    maxLength={300}
                    placeholder="Internal notes for this viewing…"
                    className="mt-1 w-full resize-none rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/15"
                  />
                  <p className="mt-1 text-right text-[10px] font-medium text-[#2C2C2C]/40">
                    {viewingConfirmNotes.length}/300
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="-mx-4 -mb-4 mt-6 flex flex-col gap-3 border-t border-[#2C2C2C]/10 bg-white px-4 pb-4 pt-6 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={viewingConfirmBusy}
              onClick={closeViewingConfirmModal}
              className="rounded-xl border border-[#2C2C2C]/30 bg-white font-semibold text-[#2C2C2C] shadow-none hover:bg-[#2C2C2C]/[0.04] hover:text-[#2C2C2C]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                viewingConfirmBusy ||
                !viewingConfirmDate.trim() ||
                !normalizeTimeHmForInput(viewingConfirmTime.trim())
              }
              onClick={() => void submitViewingConfirm()}
              className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] font-semibold text-white hover:bg-[#5a8a5d] disabled:opacity-50"
            >
              {viewingConfirmBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              {viewingConfirmMode === "counter" ? "Send counter proposal" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <AnimatePresence>
        {offerLead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[79] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => !offerBusy && setOfferLead(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-xl"
            >
              <p className="font-serif text-lg font-bold text-[#2C2C2C]">Send Offer</p>
              <p className="mt-1 text-xs font-medium text-[#2C2C2C]/55">
                {offerLead.name}
              </p>

              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Offer document (optional)
                  <input
                    type="file"
                    accept={dealAttachmentAcceptAttr()}
                    className="mt-1 w-full text-sm"
                    disabled={offerBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (f) {
                        const err = validateDealAttachmentFile(f);
                        if (err) {
                          toast.error(err);
                          setOfferAgreementFile(null);
                          return;
                        }
                      }
                      setOfferAgreementFile(f);
                    }}
                  />
                  <span className="mt-1 block text-[11px] font-normal normal-case text-[#2C2C2C]/45">
                    PDF, DOC, DOCX, JPG, or PNG · max 10MB
                  </span>
                </label>

                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Amount <span className="text-[#B85450]">*</span>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2">
                    <span className="text-sm font-bold text-[#2C2C2C]/60">₱</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-[#2C2C2C] outline-none"
                      placeholder="0.00"
                      disabled={offerBusy}
                      required
                    />
                  </div>
                </label>

                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Optional message to client
                  <textarea
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value.slice(0, 300))}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 px-3 py-2 text-sm font-medium text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/25"
                    placeholder="Add a note for the client (optional)…"
                    disabled={offerBusy}
                  />
                </label>
              </div>

              {offerBusy && offerUploadProgress != null ? (
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#2C2C2C]/10">
                    <div
                      className="h-full rounded-full bg-[#6B9E6E] transition-[width] duration-150 ease-out"
                      style={{ width: `${offerUploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-[11px] font-medium text-[#2C2C2C]/50">
                    Uploading… {offerUploadProgress}%
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={offerBusy || !offerFormValid}
                  onClick={async () => {
                    if (!offerLead) return;
                    const amountNum = Number.parseFloat(String(offerAmount ?? "").trim());
                    if (!Number.isFinite(amountNum) || amountNum <= 0) {
                      toast.error("Please enter a valid amount.");
                      return;
                    }
                    if (offerAgreementFile && offerAgreementFile.size > 0) {
                      const v = validateDealAttachmentFile(offerAgreementFile);
                      if (v) {
                        toast.error(v);
                        return;
                      }
                    }
                    setOfferBusy(true);
                    setOfferUploadProgress(0);
                    try {
                      const fd = new FormData();
                      fd.set("lead_id", String(offerLead.id));
                      fd.set("amount", String(amountNum));
                      if (offerMessage.trim()) fd.set("message", offerMessage.trim());
                      if (offerAgreementFile && offerAgreementFile.size > 0) {
                        fd.set("agreement_file", offerAgreementFile);
                      }
                      const res = await postFormDataWithUploadProgress("/api/offers", fd, (p) =>
                        setOfferUploadProgress(p),
                      );
                      const json = (await res.json()) as
                        | { success: true; data: { offer_id: string } }
                        | { success: false; error?: { message?: string } };
                      if (!res.ok || !("success" in json) || json.success !== true) {
                        const msg =
                          (json as { success?: boolean; error?: { message?: string } })?.error?.message ??
                          "Could not send offer";
                        toast.error(msg);
                        return;
                      }
                      toast.success(`Offer sent to ${offerLead.name}`);
                      setOfferLead(null);
                      await onRefresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not send offer");
                    } finally {
                      setOfferBusy(false);
                      setOfferUploadProgress(null);
                    }
                  }}
                  className="flex-1 rounded-full bg-[#6B9E6E] py-2.5 text-sm font-semibold text-white hover:bg-[#5a8a5d] disabled:opacity-50"
                >
                  {offerBusy ? "Sending…" : "Send Offer"}
                </button>
                <button
                  type="button"
                  disabled={offerBusy}
                  onClick={() => setOfferLead(null)}
                  className="flex-1 rounded-full border border-[#2C2C2C]/15 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {reservationLead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[78] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => !reservationBusy && setReservationLead(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-xl"
            >
              <p className="font-serif text-lg font-bold text-[#2C2C2C]">Create Reservation</p>
              <p className="mt-1 text-xs font-medium text-[#2C2C2C]/55">{reservationLead.name}</p>

              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Reservation agreement (optional)
                  <input
                    type="file"
                    accept={dealAttachmentAcceptAttr()}
                    className="mt-1 w-full text-sm"
                    disabled={reservationBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (f) {
                        const err = validateDealAttachmentFile(f);
                        if (err) {
                          toast.error(err);
                          setReservationAgreementFile(null);
                          return;
                        }
                      }
                      setReservationAgreementFile(f);
                    }}
                  />
                  <span className="mt-1 block text-[11px] font-normal normal-case text-[#2C2C2C]/45">
                    PDF, DOC, DOCX, JPG, or PNG · max 10MB
                  </span>
                </label>

                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Reservation amount <span className="text-[#B85450]">*</span>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2">
                    <span className="text-sm font-bold text-[#2C2C2C]/60">₱</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={reservationAmount}
                      onChange={(e) => setReservationAmount(e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-[#2C2C2C] outline-none"
                      placeholder="0.00"
                      disabled={reservationBusy}
                      required
                    />
                  </div>
                </label>

                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Linked offer (optional)
                  <select
                    value={reservationOfferId}
                    onChange={(e) => setReservationOfferId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C] outline-none"
                    disabled={reservationBusy}
                  >
                    <option value="">Standalone reservation</option>
                    {reservationOfferOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {`${o.currency} ${o.amount} • ${new Date(o.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Optional notes to client
                  <textarea
                    value={reservationNotes}
                    onChange={(e) => setReservationNotes(e.target.value.slice(0, 300))}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 px-3 py-2 text-sm font-medium text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50 focus:ring-2 focus:ring-[#6B9E6E]/25"
                    placeholder="Short note for the client (optional)…"
                    disabled={reservationBusy}
                  />
                </label>
              </div>

              {reservationBusy && reservationUploadProgress != null ? (
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#2C2C2C]/10">
                    <div
                      className="h-full rounded-full bg-[#6B9E6E] transition-[width] duration-150 ease-out"
                      style={{ width: `${reservationUploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-[11px] font-medium text-[#2C2C2C]/50">
                    Uploading… {reservationUploadProgress}%
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reservationBusy || !reservationFormValid}
                  onClick={async () => {
                    if (!reservationLead) return;
                    const amountNum = Number.parseFloat(String(reservationAmount ?? "").trim());
                    if (!Number.isFinite(amountNum) || amountNum <= 0) {
                      toast.error("Please enter a valid reservation amount.");
                      return;
                    }
                    if (reservationAgreementFile && reservationAgreementFile.size > 0) {
                      const rv = validateDealAttachmentFile(reservationAgreementFile);
                      if (rv) {
                        toast.error(rv);
                        return;
                      }
                    }
                    setReservationBusy(true);
                    setReservationUploadProgress(0);
                    try {
                      const fd = new FormData();
                      fd.set("lead_id", String(reservationLead.id));
                      if (reservationOfferId.trim()) fd.set("offer_id", reservationOfferId.trim());
                      fd.set("amount", String(amountNum));
                      if (reservationNotes.trim()) fd.set("notes", reservationNotes.trim());
                      if (reservationAgreementFile && reservationAgreementFile.size > 0) {
                        fd.set("agreement_file", reservationAgreementFile);
                      }

                      const res = await postFormDataWithUploadProgress("/api/reservations", fd, (p) =>
                        setReservationUploadProgress(p),
                      );
                      const json = (await res.json()) as
                        | { success: true; data: { reservation_id: string } }
                        | { success: false; error?: { message?: string } };
                      if (!res.ok || !("success" in json) || json.success !== true) {
                        const msg =
                          (json as { success?: boolean; error?: { message?: string } })?.error?.message ??
                          "Could not create reservation";
                        toast.error(msg);
                        return;
                      }
                      toast.success(`Reservation created for ${reservationLead.name}`);
                      setReservationLead(null);
                      await onRefresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not create reservation");
                    } finally {
                      setReservationBusy(false);
                      setReservationUploadProgress(null);
                    }
                  }}
                  className="flex-1 rounded-full bg-[#6B9E6E] py-2.5 text-sm font-semibold text-white hover:bg-[#5a8a5d] disabled:opacity-50"
                >
                  {reservationBusy ? "Creating…" : "Create Reservation"}
                </button>
                <button
                  type="button"
                  disabled={reservationBusy}
                  onClick={() => setReservationLead(null)}
                  className="flex-1 rounded-full border border-[#2C2C2C]/15 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {closeLead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[77] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => !closeBusy && setCloseLead(null)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-xl"
            >
              <p className="font-serif text-lg font-bold text-[#2C2C2C]">Mark this deal as closed?</p>
              <p className="mt-2 text-sm text-[#2C2C2C]/70">
                This will mark{" "}
                <span className="font-semibold text-[#2C2C2C]">{propertyLabel(closeLead.property_id)}</span> as
                closed for{" "}
                <span className="font-semibold text-[#2C2C2C]">{closeLead.name.trim() || "the client"}</span>. The
                client will be notified in the background; you can keep updating this deal anytime.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={closeBusy}
                  onClick={async () => {
                    if (!closeLead) return;
                    setCloseBusy(true);
                    try {
                      const res = await fetch(`/api/leads/${closeLead.id}/close`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ note: null }),
                      });
                      const json = (await res.json().catch(() => ({}))) as
                        | { success: true; data: unknown }
                        | { success: false; error?: { message?: string } };
                      if (!res.ok || !("success" in json) || json.success !== true) {
                        const msg =
                          (json as { success?: boolean; error?: { message?: string } })?.error?.message ??
                          "Could not mark deal closed";
                        toast.error(msg);
                        return;
                      }
                      toast.success("Deal marked closed. Client notified.");
                      setCloseLead(null);
                      await onRefresh();
                    } finally {
                      setCloseBusy(false);
                    }
                  }}
                  className="flex-1 rounded-full bg-[#6B9E6E] py-2.5 text-sm font-semibold text-white hover:bg-[#5a8a5d] disabled:opacity-50"
                >
                  {closeBusy ? "…" : "Yes, Mark Closed"}
                </button>
                <button
                  type="button"
                  disabled={closeBusy}
                  onClick={() => setCloseLead(null)}
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
