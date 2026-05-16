"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Activity,
  BadgeCheck,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Home,
  LayoutGrid,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { StartChatButton } from "@/features/messaging/components/start-chat-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { formatListingPricePhp } from "@/lib/format-listing-price";
import { cn } from "@/lib/utils";
import {
  CLIENT_ARCHIVE_REASON_LABEL,
  type ClientArchiveReasonKey,
  labelForClientArchiveReason,
} from "@/lib/client-lead-archive";
import { formatRelativeTime } from "@/lib/relative-time";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PipelineDealDetailModal } from "@/components/client/client-pipeline-deal-detail-modal";

export type PipelineDeal = {
  lead_id: number;
  pipeline_stage: string;
  status_label: string;
  archived_by_client?: boolean;
  archived_at?: string | null;
  archive_reason?: string | null;
  archive_note?: string | null;
  stage_at_archive?: string | null;
  property: {
    id: string | null;
    title: string;
    price: string;
    hero_image: string;
    photo_count?: number;
    location?: string | null;
    city?: string | null;
    property_type?: string | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: string | null;
    /** True when the underlying listing was soft-deleted. */
    listing_removed?: boolean;
  };
  agent: {
    user_id: string;
    name: string;
    verified: boolean;
    image_url: string | null;
  };
  viewing: {
    id: string;
    status: string;
    scheduled_at: string;
    created_at: string;
    updated_at: string;
  } | null;
  lead_created_at: string;
  documents: {
    id: string;
    document_type: string;
    display_label: string;
    status: string | null;
    direction: string | null;
    file_url: string | null;
    file_name: string | null;
    created_at: string;
    pending_upload: boolean;
  }[];
  offers?: {
    id: string;
    amount: string | number;
    currency: string;
    terms_text: string | null;
    valid_until: string | null;
    created_at: string;
    status: string;
    agreement_file_url: string | null;
    agreement_file_name: string | null;
    client_message: string | null;
  }[];
  reservations?: {
    id: string;
    amount: string | number;
    currency: string;
    notes: string | null;
    agreement_file_url: string | null;
    agreement_file_name: string | null;
    created_at: string;
    status: string;
  }[];
};

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function formatOfferAmountDisplay(amount: string | number, currency: string): string {
  const c = String(currency ?? "PHP").trim().toUpperCase() || "PHP";
  if (c === "PHP") {
    return formatListingPricePhp(amount, "for_sale");
  }
  const raw = typeof amount === "number" ? amount : Number.parseFloat(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(raw)) return String(amount);
  return `${c} ${Math.round(raw).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatValidUntilLine(validUntil: string | null): string | null {
  const t = validUntil?.trim();
  if (!t) return null;
  const d = formatShortDate(t);
  return d ? `Valid until ${d}` : null;
}

function AgreementDownloadButton({
  kind,
  id,
  children,
}: {
  kind: "offer" | "reservation";
  id: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/client/lead-agreement-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(kind === "offer" ? { offer_id: id } : { reservation_id: id }),
          });
          const json = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
          if (!res.ok || !json.signedUrl) {
            toast.error(json.error ?? "Could not download");
            return;
          }
          window.open(json.signedUrl, "_blank", "noopener,noreferrer");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-full border border-[#6B9E6E]/50 bg-[#6B9E6E]/12 px-4 py-2.5 text-sm font-semibold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/20 disabled:opacity-60 sm:w-auto"
    >
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

function OfferReadOnlyDetails({
  offer,
  agentName,
}: {
  offer: NonNullable<PipelineDeal["offers"]>[number];
  agentName: string;
}) {
  const msg = offer.client_message?.trim();
  const hasDoc = Boolean(offer.agreement_file_url?.trim());
  const legacyTerms = !hasDoc && offer.terms_text?.trim();
  const legacyValid = !hasDoc ? formatValidUntilLine(offer.valid_until) : null;
  return (
    <div className="space-y-2">
      <p className="text-lg font-bold leading-tight text-[#D4A843]">{formatOfferAmountDisplay(offer.amount, offer.currency)}</p>
      <p className="text-xs font-normal text-[#2C2C2C]/45">
        Sent {formatShortDate(offer.created_at)} by {agentName}
      </p>
      {hasDoc ? (
        <AgreementDownloadButton kind="offer" id={offer.id}>
          📄 Download Offer Letter
        </AgreementDownloadButton>
      ) : (
        <p className="text-xs italic text-[#2C2C2C]/45">No document attached</p>
      )}
      {legacyTerms ? <p className="text-[13px] leading-snug text-[#2C2C2C]/75">{legacyTerms}</p> : null}
      {legacyValid ? <p className="text-xs font-normal text-[#2C2C2C]/45">{legacyValid}</p> : null}
      {msg ? <p className="text-[13px] leading-snug text-[#2C2C2C]/75">{msg}</p> : null}
    </div>
  );
}

function ReservationReadOnlyDetails({
  row,
  agentName,
}: {
  row: NonNullable<PipelineDeal["reservations"]>[number];
  agentName: string;
}) {
  const notes = row.notes?.trim();
  const hasDoc = Boolean(row.agreement_file_url?.trim());
  return (
    <div className="space-y-2">
      <p className="text-lg font-bold leading-tight text-[#D4A843]">{formatOfferAmountDisplay(row.amount, row.currency)}</p>
      <p className="text-xs font-normal text-[#2C2C2C]/45">
        Reservation request from {agentName} · {formatShortDate(row.created_at)}
      </p>
      {hasDoc ? (
        <AgreementDownloadButton kind="reservation" id={row.id}>
          📄 Download Reservation Agreement
        </AgreementDownloadButton>
      ) : (
        <p className="text-xs italic text-[#2C2C2C]/45">No document attached</p>
      )}
      {notes ? <p className="text-[13px] leading-snug text-[#2C2C2C]/75">{notes}</p> : null}
    </div>
  );
}

function formatViewingWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

const CLIENT_PIPELINE_STEPS = ["Inquiry", "Viewing", "Offer", "Reservation", "Completed"] as const;

const PIPELINE_STAGE_ORDER: Record<string, number> = {
  lead: 0,
  viewing: 1,
  offer: 2,
  reservation: 3,
  closed: 4,
};

type PipelineSortKey = "recent" | "stage" | "name";
type PipelineViewMode = "list" | "card";

const LG_MIN_PX = 1024;

function subscribeMaxLg(cb: () => void) {
  const mq = window.matchMedia(`(max-width: ${LG_MIN_PX - 1}px)`);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getServerSnapshotMaxLg() {
  return false;
}

/** True when viewport is below `lg` (mobile / narrow client pipeline layout). */
function useIsBelowLg() {
  return useSyncExternalStore(
    subscribeMaxLg,
    () => window.matchMedia(`(max-width: ${LG_MIN_PX - 1}px)`).matches,
    getServerSnapshotMaxLg,
  );
}

function MobileAccordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#2C2C2C]/[0.08]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-sans text-[13px] font-bold text-[#2C2C2C]">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[#2C2C2C]/45" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#2C2C2C]/45" aria-hidden />
        )}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-3 font-sans">{children}</div>
        </div>
      </div>
    </div>
  );
}

function MobilePipelineNextStepsSummary({ deal, pendingCount }: { deal: PipelineDeal; pendingCount: number }) {
  const viewingConfirmed = deal.viewing?.status === "confirmed";
  const viewingDeclined = deal.viewing?.status === "declined";
  const stage = String(deal.pipeline_stage ?? "").toLowerCase();
  const hasOfferProgress = ["offer", "reservation", "closed"].includes(stage);
  const hasReservationProgress = ["reservation", "closed"].includes(stage);
  const anyDocUploaded = deal.documents.some((d) => {
    const s = String(d.status ?? "").toLowerCase();
    return s === "uploaded" || s === "approved";
  });

  return (
    <ul className="space-y-2.5 text-[13px] text-[#2C2C2C]/85">
      <li className="flex items-start gap-2">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        <span>Inquiry sent</span>
      </li>
      <li className="flex items-start gap-2">
        {viewingConfirmed ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        ) : viewingDeclined ? (
          <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-xs text-[#2C2C2C]/35" aria-hidden>
            ×
          </span>
        ) : (
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
        )}
        <span>
          Viewing
          {viewingConfirmed ? " · Scheduled" : viewingDeclined ? " · Declined" : " · Awaiting confirmation"}
        </span>
      </li>
      <li className="flex items-start gap-2">
        {pendingCount > 0 ? (
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
        ) : anyDocUploaded ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/15" aria-hidden />
        )}
        <span>
          Documents
          {pendingCount > 0
            ? ` · ${pendingCount} pending`
            : anyDocUploaded
              ? " · Submitted"
              : deal.documents.length > 0
                ? ""
                : " · None yet"}
        </span>
      </li>
      <li className="flex items-start gap-2">
        {hasOfferProgress ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/15" aria-hidden />
        )}
        <span>Offer{hasOfferProgress ? " · In progress or complete" : ""}</span>
      </li>
      <li className="flex items-start gap-2">
        {hasReservationProgress ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/15" aria-hidden />
        )}
        <span>Reservation{hasReservationProgress ? " · In progress or complete" : ""}</span>
      </li>
    </ul>
  );
}

function DealMobileDocumentsList({
  deal,
  openingId,
  uploadingId,
  onPickFile,
  openDoc,
}: {
  deal: PipelineDeal;
  openingId: string | null;
  uploadingId: string | null;
  onPickFile: (docId: string, file: File | null) => void;
  openDoc: (docId: string, fileUrl: string | null) => void;
}) {
  if (deal.documents.length === 0) {
    return <p className="text-sm text-[#2C2C2C]/55">No documents for this deal yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {deal.documents.map((d) => {
        const s = String(d.status ?? "").toLowerCase();
        const canView = (s === "uploaded" || s === "approved") && Boolean(d.file_url?.trim());
        const showUpload = s === "pending";
        const uploadedDate = s === "uploaded" || s === "approved" ? formatShortDate(d.created_at) : "";
        return (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2C2C2C]/[0.06] bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#2C2C2C]">{d.display_label}</p>
              {uploadedDate ? <p className="text-xs text-[#2C2C2C]/45">Uploaded {uploadedDate}</p> : null}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <DocumentStatusPill status={d.status} />
              <button
                type="button"
                disabled={openingId === d.id || !canView}
                onClick={() => void openDoc(d.id, d.file_url)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#6B9E6E] px-2.5 py-1 text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {openingId === d.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" />
                )}
                View
              </button>
              {showUpload ? (
                <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-[#6B9E6E]/40 bg-[#6B9E6E]/8 px-2.5 py-1 text-xs font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/15">
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/*,.pdf,.doc,.docx"
                    disabled={Boolean(uploadingId)}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void onPickFile(d.id, f);
                    }}
                  />
                  {uploadingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Upload
                </label>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DealMobileActivity({ deal, clientUserId }: { deal: PipelineDeal; clientUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<
    { id: string; created_at: string; title: string | null; body: string | null; type: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("id, created_at, title, body, type, metadata")
        .eq("user_id", clientUserId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (cancelled) return;
      if (error) {
        setRows([]);
        setLoading(false);
        return;
      }
      const leadId = deal.lead_id;
      const propId = deal.property.id?.trim() ?? "";
      const filtered = (data ?? []).filter((r) => {
        const m = (r.metadata ?? {}) as Record<string, unknown>;
        const lid = m.lead_id;
        const pid = m.property_id;
        if (lid != null && String(lid) === String(leadId)) return true;
        if (propId && pid != null && String(pid) === propId) return true;
        return false;
      });
      setRows(
        filtered.map((r) => ({
          id: String(r.id),
          created_at: String(r.created_at ?? ""),
          title: r.title ?? null,
          body: r.body ?? null,
          type: r.type ?? null,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, clientUserId, deal.lead_id, deal.property.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B9E6E]" aria-hidden />
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="text-sm text-[#2C2C2C]/55">No activity yet for this deal.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="border-l-2 border-[#6B9E6E]/35 pl-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/40">
            {formatShortDate(r.created_at)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#2C2C2C]">{r.title ?? r.type ?? "Update"}</p>
          {r.body?.trim() ? <p className="mt-1 text-xs leading-snug text-[#2C2C2C]/65">{r.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function clientArchiveConfirmCopy(pipelineStage: string): string {
  const s = String(pipelineStage ?? "").toLowerCase();
  if (s === "lead") return "Remove this property from your pipeline?";
  if (s === "viewing")
    return "You have a scheduled viewing. This will cancel it and notify the agent.";
  if (s === "offer" || s === "reservation" || s === "closed") {
    return "An offer is in progress. This action may affect your transaction. Continue?";
  }
  return "Remove this property from your pipeline?";
}

/** Format listing price for pipeline cards (₱ grouping + /mo when rent-like). */
function formatPipelineCardPrice(price: string): string {
  const t = price.trim();
  if (!t || t === "—") return "—";
  if (/₱/.test(t)) {
    if (/\/mo/i.test(t)) return t;
    const stripped = t.replace(/₱/g, "").replace(/,/g, "").trim();
    const n = Number.parseFloat(stripped.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0 && n < 10_000_000 && !/sale|million|\bm\b/i.test(t)) {
      return formatListingPricePhp(stripped, "for_rent");
    }
    return t;
  }
  const n = Number.parseFloat(t.replace(/[^\d.]/g, ""));
  if (Number.isFinite(n) && n > 0 && n <= 500_000) {
    return formatListingPricePhp(t, "for_rent");
  }
  return formatListingPricePhp(t, "for_sale");
}

/** Property | stage stepper | next step | row menu — wider property slot for hero; stage column right-aligned toward next step */
const PIPELINE_ROW_GRID =
  "lg:grid lg:grid-cols-[minmax(0,1.38fr)_minmax(17rem,1.28fr)_minmax(10.5rem,0.95fr)_2.5rem] lg:items-center lg:gap-x-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(17.5rem,1.22fr)_minmax(11rem,0.92fr)_2.5rem] xl:gap-x-6";

function formatPropertyTypeLabel(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type PipelineNextStep = {
  icon: typeof Calendar;
  title: string;
  description: string;
  dueLabel: string | null;
  /** ISO timestamp for compact "Awaiting agent · 4d" list treatment */
  awaitingSinceIso?: string;
};

/** Short relative time for list rows: 18m, 2h, 4d, 6w */
function formatCompactRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Math.max(0, Date.now() - t);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${Math.max(1, sec)}m`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function awaitingWaitDays(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor(Math.max(0, Date.now() - t) / 86400000);
}

function derivePipelineNextStep(deal: PipelineDeal, pendingDocCount: number): PipelineNextStep {
  const stage = String(deal.pipeline_stage ?? "").toLowerCase();
  const viewingConfirmed = deal.viewing?.status === "confirmed";
  const latestOffer = deal.offers?.find((o) => String(o.status).toLowerCase() === "pending");
  const latestReservation = deal.reservations?.find((r) => String(r.status).toLowerCase() === "pending");
  const pendingDoc = deal.documents.find((d) => d.pending_upload);

  if (deal.property.listing_removed) {
    return { icon: Home, title: "Listing unavailable", description: "This property is no longer on the market.", dueLabel: null };
  }
  if (pendingDocCount > 0 && pendingDoc) {
    const label = pendingDoc.display_label?.trim() || "documents";
    return {
      icon: FileText,
      title: `Upload ${label}`,
      description: "Your agent requested this for your inquiry.",
      dueLabel: "Action needed",
    };
  }
  if (latestReservation) {
    return {
      icon: FileText,
      title: "Sign reservation agreement",
      description: "Review the agreement from your agent.",
      dueLabel: latestReservation.created_at ? `Received ${formatShortDate(latestReservation.created_at)}` : null,
    };
  }
  if (latestOffer || stage === "offer") {
    return {
      icon: FileText,
      title: "Review offer letter",
      description: "Discuss terms with your agent when ready.",
      dueLabel: latestOffer ? `Received ${formatShortDate(latestOffer.created_at)}` : null,
    };
  }
  if (viewingConfirmed && deal.viewing?.scheduled_at) {
    const when = formatViewingWhen(deal.viewing.scheduled_at);
    return {
      icon: Calendar,
      title: "Confirm viewing",
      description: "Your viewing is scheduled.",
      dueLabel: when ? `Viewing ${when}` : null,
    };
  }
  if (deal.viewing && deal.viewing.status !== "declined") {
    const sinceIso = deal.viewing.created_at || deal.lead_created_at;
    const ago = formatRelativeTime(sinceIso);
    return {
      icon: Clock,
      title: "Awaiting agent response",
      description: "Your agent is confirming your viewing request.",
      dueLabel: ago ? `Awaiting agent — ${ago}` : "Awaiting agent",
      awaitingSinceIso: sinceIso,
    };
  }
  if (stage === "closed") {
    return { icon: Check, title: "Completed", description: "This property inquiry is complete.", dueLabel: null };
  }
  return {
    icon: Star,
    title: "Inquiry sent",
    description: "Your agent will follow up about scheduling a viewing.",
    dueLabel: `Sent ${formatShortDate(deal.lead_created_at)}`,
  };
}

function sortPipelineDeals(deals: PipelineDeal[], sortKey: PipelineSortKey): PipelineDeal[] {
  const list = [...deals];
  if (sortKey === "name") {
    list.sort((a, b) => a.property.title.localeCompare(b.property.title));
    return list;
  }
  if (sortKey === "stage") {
    list.sort((a, b) => {
      const sa = PIPELINE_STAGE_ORDER[String(a.pipeline_stage ?? "").toLowerCase()] ?? 0;
      const sb = PIPELINE_STAGE_ORDER[String(b.pipeline_stage ?? "").toLowerCase()] ?? 0;
      return sb - sa || +new Date(b.lead_created_at) - +new Date(a.lead_created_at);
    });
    return list;
  }
  list.sort((a, b) => +new Date(b.lead_created_at) - +new Date(a.lead_created_at));
  return list;
}

function propertySpecTags(deal: PipelineDeal): string[] {
  const tags: string[] = [];
  const type = formatPropertyTypeLabel(deal.property.property_type);
  if (type) tags.push(type);
  const sq = (deal.property.sqft ?? "").trim();
  if (sq) tags.push(`${sq} sqm`);
  if (typeof deal.property.beds === "number" && deal.property.beds > 0) tags.push(`${deal.property.beds} BR`);
  if (typeof deal.property.baths === "number" && deal.property.baths > 0) tags.push(`${deal.property.baths} BA`);
  const loc = (deal.property.city ?? deal.property.location ?? "").trim();
  if (loc) tags.push(loc);
  return tags;
}

function PipelineNextStepHighlight({
  step,
  hideLabel,
  condenseAwaitingAgent,
}: {
  step: PipelineNextStep;
  hideLabel?: boolean;
  condenseAwaitingAgent?: boolean;
}) {
  const StepIcon = step.icon;
  const showCompactAwaiting =
    condenseAwaitingAgent &&
    step.title === "Awaiting agent response" &&
    Boolean(step.awaitingSinceIso);
  const compactTime = showCompactAwaiting ? formatCompactRelativeTime(step.awaitingSinceIso!) : "";
  const waitDays = showCompactAwaiting ? awaitingWaitDays(step.awaitingSinceIso!) : 0;

  if (showCompactAwaiting) {
    return (
      <div className="min-w-0 lg:py-0.5">
        {!hideLabel ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2C2C2C]/38 lg:hidden">
            Next step
          </p>
        ) : null}
        <div className="mt-1.5 flex min-w-0 items-center gap-2.5 lg:mt-0 lg:gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10 ring-1 ring-inset ring-[#6B9E6E]/15">
            <StepIcon className="h-3.5 w-3.5 text-[#6B9E6E]" strokeWidth={2.25} aria-hidden />
          </span>
          <p className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-[#2C2C2C] lg:text-[14px]">
            Awaiting agent
            {compactTime ? (
              <>
                <span className="font-medium text-[#2C2C2C]/40"> · </span>
                <span className={cn("font-semibold tabular-nums", waitDays > 3 && "text-[#D4A843]")}>
                  {compactTime}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 lg:py-0.5">
      {!hideLabel ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2C2C2C]/38 lg:hidden">Next step</p>
      ) : null}
      <div className="mt-1.5 flex min-w-0 items-start gap-2.5 lg:mt-0 lg:gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10 ring-1 ring-inset ring-[#6B9E6E]/15">
          <StepIcon className="h-3.5 w-3.5 text-[#6B9E6E]" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug tracking-tight text-[#2C2C2C] lg:text-[14px]">
            {step.title}
          </p>
          {step.dueLabel ? (
            <p className="mt-1 text-xs leading-snug text-[#2C2C2C]/48">{step.dueLabel}</p>
          ) : (
            <p className="mt-1 text-xs leading-snug text-[#2C2C2C]/48">{step.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineColumnHeaders() {
  return (
    <div className={cn("grid", PIPELINE_ROW_GRID)} aria-hidden>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Property</span>
      <div className="flex min-w-0 items-center justify-end px-0.5 font-sans">
        <div className="ml-auto w-[min(100%,18rem)] min-w-0">
          <span className="block text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            Stage progress
          </span>
        </div>
      </div>
      <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-gray-500">
        Next step
      </span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

function pipelineAgentInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[parts.length - 1]?.[0] ?? "";
    return `${a}${b}`.toUpperCase() || "?";
  }
  return trimmed.slice(0, 2).toUpperCase() || "?";
}

/** 0–4 = active step index; 5 = all steps completed (closed). */
function clientPipelineCurrentStepIndex(deal: PipelineDeal): number {
  const s = String(deal.pipeline_stage ?? "").toLowerCase();
  if (s === "closed") return 5;
  if (s === "reservation") return 3;
  if (s === "offer") return 2;
  if (s === "viewing") return 1;
  if (s === "lead") {
    if (deal.viewing?.status === "confirmed") return 1;
    return 0;
  }
  return 0;
}

function StatusPill({ label, variant }: { label: string; variant: "sage" | "neutral" | "gold" }) {
  const text = label.trim().toUpperCase();
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variant === "sage" && "border-[#6B9E6E]/25 bg-[#6B9E6E]/10 text-[#2C2C2C]/90",
        variant === "neutral" && "border-stone-200 bg-stone-50 text-[#2C2C2C]/65",
        variant === "gold" && "border-[#D4A843]/30 bg-[#D4A843]/12 text-[#2C2C2C]/90",
      )}
    >
      {text}
    </span>
  );
}

function DocumentStatusPill({ status }: { status: string | null }) {
  const s = String(status ?? "").trim().toLowerCase();
  const label = s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : s === "uploaded" ? "Uploaded" : "Pending";
  const cls =
    s === "approved"
      ? "border-[#D4A843]/35 bg-[#D4A843]/15 text-[#8a6d32]"
      : s === "rejected"
        ? "border-red-300 bg-red-50 text-red-700"
        : s === "uploaded"
          ? "border-[#6B9E6E]/30 bg-[#6B9E6E]/12 text-[#2C5F32]"
          : "border-[#2C2C2C]/12 bg-[#FAF8F4] text-[#2C2C2C]/55";
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

function ClientPipelineStepper({ deal, muted }: { deal: PipelineDeal; muted?: boolean }) {
  const cur = clientPipelineCurrentStepIndex(deal);
  /** Vertical center of circle row (h-7 slot) */
  const trackTop = "top-[10px]";
  return (
    <div className={cn("w-full min-w-0 shrink-0 font-sans", muted && "opacity-50 grayscale")}>
      <div className="relative flex w-full min-w-0 items-start">
        {/* Continuous neutral track behind circles */}
        <div
          className={cn("pointer-events-none absolute right-2 left-2 z-0 h-px bg-[#2C2C2C]/08", trackTop)}
          aria-hidden
        />
        {CLIENT_PIPELINE_STEPS.map((label, i) => {
          const done = cur === 5 || i < cur;
          const active = cur !== 5 && i === cur;
          const offerGold = active && i === 2 && String(deal.pipeline_stage).toLowerCase() === "offer";
          const segmentAfterGreen = cur === 5 || cur > i;
          return (
            <div key={label} className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-px">
              <div className="relative flex h-6 w-full min-w-0 items-center justify-center">
                {i < CLIENT_PIPELINE_STEPS.length - 1 && segmentAfterGreen ? (
                  <div
                    className={cn("absolute left-1/2 z-[1] h-px w-full min-w-0 bg-[#6B9E6E]/55", trackTop)}
                    aria-hidden
                  />
                ) : null}
                {done ? (
                  <span className="relative z-[2] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#6B9E6E] text-white ring-2 ring-[#FAF8F4]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                  </span>
                ) : active ? (
                  <span
                    className={cn(
                      "relative z-[2] flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-[#FAF8F4]",
                      offerGold ? "bg-[#D4A843]" : "bg-[#6B9E6E]",
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span
                    className="relative z-[2] flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#2C2C2C]/14 bg-white shadow-[inset_0_1px_2px_rgba(44,44,44,0.04)] ring-2 ring-white"
                    aria-hidden
                  />
                )}
              </div>
              <span
                className={cn(
                  "w-full min-w-0 hyphens-auto break-words px-0.5 text-center text-[9px] leading-[1.15]",
                  active ? "font-medium text-[#2C2C2C]/62" : done ? "text-[#2C2C2C]/42" : "text-[#2C2C2C]/30",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealStatusBanner({ deal }: { deal: PipelineDeal }) {
  const viewingConfirmed = deal.viewing?.status === "confirmed";
  const viewingDeclined = deal.viewing?.status === "declined";
  const stage = String(deal.pipeline_stage ?? "").toLowerCase();
  const listingRemovedUi = Boolean(deal.property.listing_removed);

  if (listingRemovedUi) {
    return (
      <p className="mt-1 max-w-full font-sans text-xs font-semibold leading-snug text-[#2C2C2C]/55">
        This property is no longer available. The agent has closed the inquiry.
      </p>
    );
  }

  if (viewingConfirmed && deal.viewing?.scheduled_at) {
    let viewingWhenLine = "";
    try {
      const d = new Date(deal.viewing.scheduled_at);
      const datePart = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
      const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      viewingWhenLine = `Viewing scheduled on ${datePart} • ${timePart}`;
    } catch {
      viewingWhenLine = `Viewing scheduled on ${formatViewingWhen(deal.viewing.scheduled_at)}`;
    }
    return (
      <div className="flex flex-col gap-2 font-sans text-sm leading-snug text-[#2C2C2C]/60 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
          <span className="min-w-0 font-normal not-italic">{viewingWhenLine}</span>
        </div>
        {deal.property.id && !deal.property.listing_removed ? (
          <Link
            href={`/properties/${encodeURIComponent(deal.property.id)}`}
            className="inline-flex shrink-0 items-center gap-0.5 font-semibold not-italic text-[#6B9E6E] hover:underline"
          >
            View details <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    );
  }

  if (stage === "lead" && !viewingConfirmed) {
    return (
      <div className="flex items-start gap-2 font-sans text-sm leading-relaxed text-[#2C2C2C]/50">
        <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2C2C2C]/35" aria-hidden />
        <span className="min-w-0">We&apos;ve received your inquiry and will get back to you soon.</span>
      </div>
    );
  }

  if (viewingDeclined) {
    return (
      <div className="flex items-start gap-2 font-sans text-sm leading-relaxed text-[#2C2C2C]/50">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2C2C2C]/35" aria-hidden />
        <span className="min-w-0">Viewing was declined for this property.</span>
      </div>
    );
  }

  if (deal.viewing && !viewingConfirmed) {
    return (
      <p className="mt-1 max-w-full font-sans text-xs font-normal leading-snug text-[#2C2C2C]/45">
        Viewing — awaiting confirmation from your agent.
      </p>
    );
  }

  return null;
}

function PipelineRowMenu({
  deal,
  clientUserId,
  listingRemovedUi,
  onToggleDocs,
  onRequestRemove,
  onOpenDetail,
  menuLayout = "card",
}: {
  deal: PipelineDeal;
  clientUserId: string;
  listingRemovedUi: boolean;
  onToggleDocs: () => void;
  onRequestRemove?: () => void;
  /** Opens the same detail modal as row click (list view). */
  onOpenDetail?: () => void;
  /** Card grid keeps full actions; list rows use a minimal overflow menu only. */
  menuLayout?: "card" | "list";
}) {
  if (menuLayout === "list") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#2C2C2C]/32 transition hover:bg-[#2C2C2C]/[0.04] hover:text-[#2C2C2C]/65"
            aria-label="Property actions"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[188px] border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]">
          {onOpenDetail ? (
            <DropdownMenuItem
              className="font-semibold focus:bg-[#6B9E6E]/12"
              onSelect={(e) => {
                e.preventDefault();
                onOpenDetail();
              }}
            >
              View details
            </DropdownMenuItem>
          ) : null}
          {onRequestRemove ? (
            <DropdownMenuItem
              className="font-semibold text-red-600 focus:bg-red-50 focus:text-red-700"
              onSelect={(e) => {
                e.preventDefault();
                onRequestRemove();
              }}
            >
              Archive
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#2C2C2C]/32 transition hover:bg-[#2C2C2C]/[0.04] hover:text-[#2C2C2C]/65"
          aria-label="Property actions"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[188px] border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]">
        {deal.property.id && !listingRemovedUi ? (
          <DropdownMenuItem asChild className="font-semibold focus:bg-[#6B9E6E]/12">
            <Link href={`/properties/${encodeURIComponent(deal.property.id)}`}>View property</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem className="font-semibold focus:bg-[#6B9E6E]/12" onSelect={() => onToggleDocs()}>
          View documents
        </DropdownMenuItem>
        {deal.agent.user_id && !listingRemovedUi ? (
          <div className="px-1 py-1">
            <StartChatButton
              agentId={deal.agent.user_id}
              clientId={clientUserId}
              label="Message agent"
              showMessageIcon
              metadata={{
                property_id: deal.property.id ?? null,
                property_name: deal.property.title ?? null,
                property_price: deal.property.price ?? null,
                property_image: deal.property.hero_image ?? null,
              }}
              className="h-8 w-full justify-start rounded-md border-0 bg-transparent px-2 py-1.5 text-sm font-semibold text-[#2C2C2C] shadow-none hover:bg-[#6B9E6E]/12"
            />
          </div>
        ) : null}
        {onRequestRemove ? (
          <DropdownMenuItem
            className="font-semibold text-red-600 focus:bg-red-50 focus:text-red-700"
            onSelect={(e) => {
              e.preventDefault();
              onRequestRemove();
            }}
          >
            Remove from pipeline
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Cards view only — fixed vertical slots so rows align across short/long titles. */
function PipelineDealCardBody({
  deal,
  clientUserId,
  listingRemovedUi,
  photosBadge,
  statusPillVariant,
  specTags,
  initials,
  agentAvatarFailed,
  setAgentAvatarFailed,
  nextStep,
  onOpenDetail,
}: {
  deal: PipelineDeal;
  clientUserId: string;
  listingRemovedUi: boolean;
  photosBadge: string | null;
  statusPillVariant: "neutral" | "sage" | "gold";
  specTags: string[];
  initials: string;
  agentAvatarFailed: boolean;
  setAgentAvatarFailed: (v: boolean) => void;
  nextStep: PipelineNextStep;
  onOpenDetail?: () => void;
}) {
  return (
    <div
      className={cn("flex flex-1 flex-col p-5 font-sans", onOpenDetail && "cursor-pointer")}
      role={onOpenDetail ? "button" : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onClick={
        onOpenDetail
          ? (e) => {
              if ((e.target as HTMLElement).closest("[data-pipeline-card-action]")) return;
              onOpenDetail();
            }
          : undefined
      }
      onKeyDown={
        onOpenDetail
          ? (e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              if ((e.target as HTMLElement).closest("[data-pipeline-card-action]")) return;
              e.preventDefault();
              onOpenDetail();
            }
          : undefined
      }
    >
      <div className="relative z-0 mb-4 h-44 w-full shrink-0 overflow-hidden rounded-xl bg-[#FAF8F4] ring-1 ring-inset ring-[#2C2C2C]/[0.06]">
        {deal.property.hero_image ? (
          <Image
            src={deal.property.hero_image}
            alt=""
            fill
            className={cn("object-cover", listingRemovedUi && "grayscale")}
            sizes="(max-width: 640px) 100vw, 360px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-[#2C2C2C]/38">
            No photo
          </div>
        )}
        {listingRemovedUi ? (
          <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center bg-black/25 px-2">
            <span className="rounded-full bg-gray-900/85 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-100">
              No longer available
            </span>
          </div>
        ) : null}
        {photosBadge ? (
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-full bg-[#2C2C2C]/80 px-2 py-0.5 text-[10px] font-medium text-white">
            {photosBadge}
          </div>
        ) : null}
      </div>

      <div className="mb-3 min-h-[2.75rem] pr-8">
        <h2 className="line-clamp-2 font-serif text-lg font-semibold leading-snug tracking-tight text-[#2C2C2C]">
          {deal.property.title}
        </h2>
      </div>

      <div className="mb-2 flex h-6 items-end">
        <p className="text-base font-semibold leading-none tracking-tight text-[#2C2C2C] tabular-nums">
          {formatPipelineCardPrice(deal.property.price)}
        </p>
      </div>

      <div className="mb-2 flex h-7 items-center">
        {!listingRemovedUi ? (
          <StatusPill label={deal.status_label} variant={statusPillVariant} />
        ) : (
          <span className="inline-flex shrink-0 rounded-full border border-[#B5453A]/30 bg-[#B5453A]/[0.12] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#B5453A]">
            Unavailable
          </span>
        )}
      </div>

      <div className="mb-2 flex h-7 min-w-0 items-center gap-2">
        <span className="relative inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[#F3F0EA] ring-1 ring-inset ring-[#2C2C2C]/08">
          {deal.agent.image_url?.trim() && !agentAvatarFailed ? (
            <Image
              src={deal.agent.image_url}
              alt=""
              fill
              sizes="24px"
              className="object-cover"
              unoptimized
              onError={() => setAgentAvatarFailed(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[8px] font-semibold text-[#2C2C2C]/50">
              {initials}
            </span>
          )}
        </span>
        <span className="truncate text-xs font-medium text-[#2C2C2C]/55">{deal.agent.name}</span>
        {deal.agent.verified ? (
          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" aria-label="Verified agent" />
        ) : null}
      </div>

      <div className="mb-3 flex h-7 min-w-0 items-center gap-1.5 overflow-hidden">
        {specTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex shrink-0 rounded-md border border-[#2C2C2C]/08 bg-[#FAF8F4] px-2 py-0.5 text-[10px] font-medium text-[#2C2C2C]/55"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mb-3 flex h-14 items-center">
        <ClientPipelineStepper deal={deal} muted={listingRemovedUi} />
      </div>

      <div className="mb-4 flex h-[4.25rem] items-stretch">
        <div className="flex w-full items-center rounded-xl bg-[#FAF8F4]/80 px-3.5 py-2 ring-1 ring-inset ring-[#2C2C2C]/[0.05]">
          {!listingRemovedUi ? (
            <div className="min-w-0 [&>div>div]:mt-0">
              <PipelineNextStepHighlight step={nextStep} hideLabel />
            </div>
          ) : (
            <p className="line-clamp-2 text-xs leading-snug text-[#2C2C2C]/55">
              This property is no longer available. The agent has closed the inquiry.
            </p>
          )}
        </div>
      </div>

      <div className="flex h-11 shrink-0 gap-2.5" data-pipeline-card-action onClick={(e) => e.stopPropagation()}>
        {deal.agent.user_id && !listingRemovedUi ? (
          <StartChatButton
            agentId={deal.agent.user_id}
            clientId={clientUserId}
            label="Message Agent"
            showMessageIcon
            metadata={{
              property_id: deal.property.id ?? null,
              property_name: deal.property.title ?? null,
              property_price: deal.property.price ?? null,
              property_image: deal.property.hero_image ?? null,
            }}
            className="h-11 min-h-0 flex-1 justify-center rounded-xl border-0 bg-[#2C2C2C] px-3 text-[13px] font-semibold text-white hover:bg-[#6B9E6E]"
          />
        ) : (
          <span className="flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-400">
            Messaging unavailable
          </span>
        )}
        {deal.property.id && !listingRemovedUi ? (
          <Link
            href={`/properties/${encodeURIComponent(deal.property.id)}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#6B9E6E] bg-white px-3 text-[13px] font-bold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/10"
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden />
            View Property
          </Link>
        ) : listingRemovedUi ? (
          <span className="flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-400">
            Unavailable
          </span>
        ) : null}
      </div>

      {onOpenDetail ? (
        <button
          type="button"
          className="mt-3 w-full text-center text-xs font-semibold text-[#6B9E6E] hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
        >
          View details
        </button>
      ) : null}
    </div>
  );
}

function DealCard({
  deal,
  clientUserId,
  clientDisplayName,
  clientAvatarUrl,
  docsOpen,
  onToggleDocs,
  onUploaded,
  highlight,
  isArchived,
  onRequestRemove,
  onOpenDetail,
  viewMode = "list",
}: {
  deal: PipelineDeal;
  clientUserId: string;
  clientDisplayName?: string | null;
  clientAvatarUrl?: string | null;
  docsOpen: boolean;
  onToggleDocs: () => void;
  onUploaded: () => void;
  highlight: boolean;
  isArchived?: boolean;
  onRequestRemove?: () => void;
  onOpenDetail?: () => void;
  viewMode?: PipelineViewMode;
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [agentAvatarFailed, setAgentAvatarFailed] = useState(false);
  const [clientAvatarFailed, setClientAvatarFailed] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [requestedDocsExpanded, setRequestedDocsExpanded] = useState(false);
  const [reviewOfferExpanded, setReviewOfferExpanded] = useState(false);
  const [offerHistoryExpanded, setOfferHistoryExpanded] = useState(false);
  const [reviewReservationExpanded, setReviewReservationExpanded] = useState(false);
  const [reservationHistoryExpanded, setReservationHistoryExpanded] = useState(false);

  const pendingDocs = deal.documents.filter((d) => d.pending_upload);
  const pendingCount = pendingDocs.length;
  const submittedDocCount = deal.documents.filter((d) => {
    const s = String(d.status ?? "").toLowerCase();
    return s === "uploaded" || s === "approved";
  }).length;

  const pendingOffersNewestFirst = useMemo(() => {
    const list = [...(deal.offers ?? [])].filter((o) => String(o.status ?? "").toLowerCase() === "pending");
    list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [deal.offers]);

  const latestPendingOffer = pendingOffersNewestFirst[0];
  const olderPendingOffersChronological = useMemo(
    () => pendingOffersNewestFirst.slice(1).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [pendingOffersNewestFirst],
  );

  const pendingReservationsNewestFirst = useMemo(() => {
    const list = [...(deal.reservations ?? [])].filter((r) => String(r.status ?? "").toLowerCase() === "pending");
    list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [deal.reservations]);

  const latestPendingReservation = pendingReservationsNewestFirst[0];
  const olderPendingReservationsChronological = useMemo(
    () =>
      pendingReservationsNewestFirst.slice(1).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [pendingReservationsNewestFirst],
  );

  const inquiryDate = deal.viewing?.created_at ?? deal.lead_created_at;
  const viewingConfirmed = deal.viewing?.status === "confirmed";
  const viewingDeclined = deal.viewing?.status === "declined";

  const offerNotStarted = !["offer", "reservation", "closed"].includes(
    String(deal.pipeline_stage ?? "").toLowerCase(),
  );

  const reservationNotStarted = !["reservation", "closed"].includes(String(deal.pipeline_stage ?? "").toLowerCase());

  const stageLc = String(deal.pipeline_stage ?? "").toLowerCase();
  const statusPillVariant: "neutral" | "sage" | "gold" =
    stageLc === "offer"
      ? "gold"
      : stageLc === "lead" && deal.viewing?.status !== "confirmed" && pendingCount === 0
        ? "neutral"
        : "sage";

  const photoCount = Math.max(0, deal.property.photo_count ?? 0);
  const photosBadge =
    photoCount > 0 ? `${photoCount} Photo${photoCount === 1 ? "" : "s"}` : null;

  const onPickFile = async (docId: string, file: File | null) => {
    if (!file) return;
    setUploadingId(docId);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("deal_document_id", docId);
      const res = await fetch("/api/client/upload-deal-document", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        return;
      }
      toast.success("Document uploaded");
      onUploaded();
    } finally {
      setUploadingId(null);
    }
  };

  const openDoc = async (docId: string, fileUrl: string | null) => {
    if (!fileUrl?.trim()) return;
    setOpeningId(docId);
    try {
      const res = await fetch("/api/client/get-deal-document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deal_document_id: docId }),
      });
      const json = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) {
        toast.error(json.error ?? "Could not open document");
        return;
      }
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  };

  const initials = pipelineAgentInitials(deal.agent.name);
  const clientInitials = pipelineAgentInitials(clientDisplayName ?? "You");
  const listingRemovedUi = Boolean(deal.property.listing_removed);
  const router = useRouter();
  const specTags = useMemo(() => propertySpecTags(deal), [deal]);
  const nextStep = useMemo(() => derivePipelineNextStep(deal, pendingCount), [deal, pendingCount]);
  const propertyHref = deal.property.id && !listingRemovedUi ? `/properties/${encodeURIComponent(deal.property.id)}` : null;
  const isCard = viewMode === "card";

  if (isArchived) {
    const reasonLabel = labelForClientArchiveReason(deal.archive_reason, deal.archive_note);
    const archivedWhen = deal.archived_at ? formatRelativeTime(deal.archived_at) : "—";
    const stageSnap = String(deal.stage_at_archive ?? deal.pipeline_stage ?? "—");
    const systemUnavailable = String(deal.archive_reason ?? "").trim() === "property_unavailable";
    return (
      <article
        id={`lead-${deal.lead_id}`}
        className={cn(
          "relative isolate overflow-hidden rounded-xl border border-[#2C2C2C]/[0.06] bg-white shadow-[0_1px_3px_rgba(44,44,44,0.05)]",
          systemUnavailable && "opacity-70",
        )}
      >
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-6">
          <div className="min-w-0 flex-1 font-sans">
            {systemUnavailable ? (
              <span className="shrink-0 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                NO LONGER AVAILABLE
              </span>
            ) : (
              <StatusPill label="Archived" variant="neutral" />
            )}
            <h2 className="mt-3 break-words font-serif text-lg font-semibold leading-snug tracking-tight text-[#2C2C2C]">
              {deal.property.title}
            </h2>
            <p className="mt-1 text-base font-semibold tracking-tight text-[#2C2C2C] tabular-nums">
              {formatPipelineCardPrice(deal.property.price)}
            </p>
            <p className="mt-3 text-sm text-[#2C2C2C]/55">
              <span className="font-semibold text-[#2C2C2C]/85">Reason:</span> {reasonLabel}
            </p>
            <p className="mt-1 text-xs text-[#2C2C2C]/50">
              Stage when removed: {stageSnap} · {archivedWhen}
            </p>
          </div>
          {deal.property.id && !listingRemovedUi ? (
            <Link
              href={`/properties/${encodeURIComponent(deal.property.id)}`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-[#2C2C2C]/12 bg-transparent px-4 text-[13px] font-semibold text-[#2C2C2C]/85 transition hover:border-[#2C2C2C]/18 hover:bg-[#FAF8F4]/80"
            >
              <Home className="h-3.5 w-3.5 shrink-0 text-[#2C2C2C]/45" aria-hidden />
              View Property
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      id={`lead-${deal.lead_id}`}
      className={cn(
        "relative isolate overflow-hidden bg-white transition-[box-shadow,opacity] duration-150",
        viewMode === "list"
          ? "border-b border-stone-200 last:border-b-0 max-lg:rounded-xl max-lg:border max-lg:border-[#2C2C2C]/[0.06] max-lg:shadow-[0_1px_2px_rgba(44,44,44,0.04)] max-lg:transition-[box-shadow,background-color] max-lg:duration-150 max-lg:hover:bg-stone-50/60 max-lg:hover:shadow-sm lg:border-x-0 lg:border-t-0 lg:shadow-none lg:transition-[box-shadow,background-color,transform] lg:duration-150 lg:hover:-translate-y-px lg:hover:bg-stone-50/60 lg:hover:shadow-sm"
          : "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm ring-1 ring-[#2C2C2C]/[0.04]",
        highlight && "ring-2 ring-[#D4A843]/50",
        listingRemovedUi && "opacity-60",
      )}
    >
      {isCard ? (
        <div className="absolute right-3 top-3 z-20 sm:right-4" onClick={(e) => e.stopPropagation()}>
          <PipelineRowMenu
            deal={deal}
            clientUserId={clientUserId}
            listingRemovedUi={listingRemovedUi}
            onToggleDocs={onToggleDocs}
            onRequestRemove={onRequestRemove}
          />
        </div>
      ) : viewMode === "list" && (onOpenDetail || onRequestRemove) ? (
        <div className="absolute right-3 top-0 z-20 sm:right-4 sm:top-1 lg:hidden" onClick={(e) => e.stopPropagation()}>
          <PipelineRowMenu
            deal={deal}
            clientUserId={clientUserId}
            listingRemovedUi={listingRemovedUi}
            onToggleDocs={onToggleDocs}
            onRequestRemove={onRequestRemove}
            onOpenDetail={onOpenDetail}
            menuLayout="list"
          />
        </div>
      ) : null}

      <div className={cn(viewMode === "list" && "lg:hidden", isCard && "flex h-full min-h-0 flex-col")}>
        {isCard ? (
          <PipelineDealCardBody
            deal={deal}
            clientUserId={clientUserId}
            listingRemovedUi={listingRemovedUi}
            photosBadge={photosBadge}
            statusPillVariant={statusPillVariant}
            specTags={specTags}
            initials={initials}
            agentAvatarFailed={agentAvatarFailed}
            setAgentAvatarFailed={setAgentAvatarFailed}
            nextStep={nextStep}
            onOpenDetail={onOpenDetail}
          />
        ) : (
        <div
          className={cn(
            "space-y-3 px-4 py-4 font-sans transition-colors duration-150",
            onOpenDetail && "cursor-pointer hover:bg-stone-50/60",
          )}
          role={onOpenDetail ? "button" : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          onClick={
            onOpenDetail
              ? (e) => {
                  if ((e.target as HTMLElement).closest("[data-pipeline-card-action]")) return;
                  onOpenDetail();
                }
              : undefined
          }
          onKeyDown={
            onOpenDetail
              ? (e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  if ((e.target as HTMLElement).closest("[data-pipeline-card-action]")) return;
                  e.preventDefault();
                  onOpenDetail();
                }
              : undefined
          }
        >
          <div className="relative z-0 h-[100px] w-full shrink-0 overflow-hidden rounded-lg bg-[#FAF8F4] ring-1 ring-[#2C2C2C]/[0.05]">
            {deal.property.hero_image ? (
              <Image
                src={deal.property.hero_image}
                alt=""
                fill
                className={cn("object-cover", listingRemovedUi && "grayscale")}
                sizes="(max-width: 1024px) 100vw, 120px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-medium text-[#2C2C2C]/38">
                No photo
              </div>
            )}
            {listingRemovedUi ? (
              <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center bg-black/25 px-2">
                <span className="rounded-full bg-gray-900/85 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-100">
                  No longer available
                </span>
              </div>
            ) : null}
            {photosBadge ? (
              <div className="pointer-events-none absolute bottom-1 left-1 z-10 rounded-full bg-[#2C2C2C]/80 px-1.5 py-0.5 font-sans text-[9px] font-medium text-white">
                {photosBadge}
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <h2 className="break-words font-serif text-lg font-semibold leading-snug tracking-tight text-[#2C2C2C]">
              {deal.property.title}
            </h2>
            <p className="mt-1 text-base font-semibold tracking-tight text-[#2C2C2C] tabular-nums">
              {formatPipelineCardPrice(deal.property.price)}
            </p>
          </div>
          <div>
            <ClientPipelineStepper deal={deal} muted={listingRemovedUi} />
            <div className="text-xs leading-snug text-[#6B728E]">
              <DealStatusBanner deal={deal} />
            </div>
          </div>
          <div
            className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-20 -mx-4 flex shrink-0 gap-2.5 border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#FAF8F4]/90"
            data-pipeline-card-action
            onClick={(e) => e.stopPropagation()}
          >
            {deal.agent.user_id && !listingRemovedUi ? (
              <StartChatButton
                agentId={deal.agent.user_id}
                clientId={clientUserId}
                label="Message Agent"
                showMessageIcon
                metadata={{
                  property_id: deal.property.id ?? null,
                  property_name: deal.property.title ?? null,
                  property_price: deal.property.price ?? null,
                  property_image: deal.property.hero_image ?? null,
                }}
                className="h-11 min-h-[44px] flex-1 justify-center rounded-xl border-0 bg-[#2C2C2C] px-3 text-[13px] font-semibold text-white hover:bg-[#6B9E6E]"
              />
            ) : (
              <span className="flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-400">
                Messaging unavailable
              </span>
            )}
            {deal.property.id && !listingRemovedUi ? (
              <Link
                href={`/properties/${encodeURIComponent(deal.property.id)}`}
                className="inline-flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#6B9E6E] bg-white px-3 text-[13px] font-bold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/10"
              >
                <Home className="h-4 w-4 shrink-0" aria-hidden />
                View Property
              </Link>
            ) : listingRemovedUi ? (
              <span className="flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-400">
                Unavailable
              </span>
            ) : null}
          </div>
          {onOpenDetail ? (
            <button
              type="button"
              className="w-full text-center text-xs font-semibold text-[#6B9E6E] hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
            >
              View details
            </button>
          ) : null}
        </div>
        )}
      </div>

      {viewMode === "list" ? (
      <div
        className={cn(
          "hidden lg:grid",
          PIPELINE_ROW_GRID,
          "group/row items-center px-6 py-4",
          onOpenDetail &&
            "cursor-pointer transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-stone-50/60 hover:shadow-sm",
        )}
        {...(onOpenDetail
          ? {
              role: "button",
              tabIndex: 0,
              onClick: (e: React.MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest("button, a, input, label, [role=menu]")) return;
                onOpenDetail();
              },
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                const target = e.target as HTMLElement;
                if (target.closest("button, a, input, label")) return;
                e.preventDefault();
                onOpenDetail();
              },
            }
          : {})}
      >
        {/* Section 1 — property */}
        <div className="flex min-w-0 items-start gap-4 font-sans xl:gap-5">
          <div className="relative z-0 h-[116px] w-[140px] shrink-0 overflow-hidden rounded-lg bg-[#F3F0EA] shadow-[0_1px_4px_rgba(44,44,44,0.08)] ring-1 ring-[#2C2C2C]/[0.06]">
            {deal.property.hero_image ? (
              <Image
                src={deal.property.hero_image}
                alt=""
                fill
                className={cn("object-cover", listingRemovedUi && "grayscale")}
                sizes="140px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-sans text-xs font-medium text-[#2C2C2C]/38">
                No photo
              </div>
            )}
            {listingRemovedUi ? (
              <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center bg-black/25 px-2">
                <span className="rounded-full bg-gray-900/85 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-100">
                  No longer available
                </span>
              </div>
            ) : null}
            {photosBadge ? (
              <div className="pointer-events-none absolute bottom-1 left-1 z-10 rounded-full bg-[#2C2C2C]/80 px-1.5 py-0.5 font-sans text-[9px] font-medium text-white">
                {photosBadge}
              </div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-1 text-[15px] font-semibold leading-snug tracking-tight text-[#2C2C2C]">
              {deal.property.title}
            </h2>
            <p className="mt-0.5 text-[15px] font-semibold leading-none tracking-tight text-[#2C2C2C] tabular-nums">
              {formatPipelineCardPrice(deal.property.price)}
            </p>
            {!listingRemovedUi ? (
              <div className="mt-1.5">
                <StatusPill label={deal.status_label} variant={statusPillVariant} />
              </div>
            ) : (
              <span className="mt-1 inline-flex shrink-0 rounded-full border border-[#B5453A]/30 bg-[#B5453A]/[0.12] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#B5453A]">
                Unavailable
              </span>
            )}
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <span className="relative inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-full bg-[#F3F0EA] ring-1 ring-inset ring-[#2C2C2C]/08">
                {deal.agent.image_url?.trim() && !agentAvatarFailed ? (
                  <Image
                    src={deal.agent.image_url}
                    alt=""
                    fill
                    sizes="20px"
                    className="object-cover"
                    unoptimized
                    onError={() => setAgentAvatarFailed(true)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[7px] font-semibold text-[#2C2C2C]/50">
                    {initials}
                  </span>
                )}
              </span>
              <span className="truncate text-[11px] font-medium text-[#2C2C2C]/55">{deal.agent.name}</span>
              {deal.agent.verified ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" aria-label="Verified agent" />
              ) : null}
            </div>
            {specTags.length > 0 ? (
              <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                {specTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded border border-[#2C2C2C]/08 bg-[#FAF8F4] px-1.5 py-px text-[9px] font-medium text-[#2C2C2C]/55"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Section 2 — stage progress (right-aligned toward Next step so property column can use more width for the hero) */}
        <div className="flex min-w-0 items-center justify-end px-0.5 font-sans">
          <div className="ml-auto w-[min(100%,18rem)] min-w-0">
            <ClientPipelineStepper deal={deal} muted={listingRemovedUi} />
          </div>
        </div>

        {/* Section 3 — next step */}
        <section className="min-w-0 font-sans">
          {!listingRemovedUi ? (
            <PipelineNextStepHighlight step={nextStep} condenseAwaitingAgent />
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setChecklistOpen((v) => !v);
            }}
            className="mt-1.5 text-[11px] font-medium text-[#2C2C2C]/45 hover:text-[#6B9E6E] lg:hidden"
          >
            {checklistOpen ? "Hide full checklist" : "View full checklist"}
          </button>
          {checklistOpen ? (
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/38 lg:hidden">All steps</p>
          ) : null}
          {listingRemovedUi ? (
            <div className="mt-4 rounded-xl border border-[#2C2C2C]/[0.06] bg-[#FAF8F4]/70 px-4 py-3 text-[13px] font-semibold text-[#2C2C2C]/70">
              This property is no longer available. The agent has closed the inquiry.
            </div>
          ) : checklistOpen ? (
          <ul className="mt-3 space-y-3.5 text-sm text-[#2C2C2C]/80 lg:hidden">
            <li className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Inquiry sent</p>
                <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">{formatShortDate(inquiryDate)}</p>
              </div>
            </li>
            {viewingConfirmed ? (
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Viewing scheduled</p>
                  <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">
                    {formatViewingWhen(deal.viewing!.scheduled_at)}
                  </p>
                </div>
              </li>
            ) : viewingDeclined ? (
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-xs font-medium text-[#2C2C2C]/30" aria-hidden>
                  ×
                </span>
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Viewing declined</p>
                </div>
              </li>
            ) : deal.viewing ? (
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/30" aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Viewing</p>
                  <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">Awaiting confirmation</p>
                </div>
              </li>
            ) : (
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/12" aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/50">Viewing</p>
                  <p className="mt-1 text-xs font-normal text-[#2C2C2C]/40">Not scheduled yet</p>
                </div>
              </li>
            )}
            {pendingCount > 0 ? (
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D4A843]/50 bg-[#D4A843]/15" aria-hidden />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setRequestedDocsExpanded((v) => !v)}
                    className="inline-flex w-full items-center justify-between gap-2 text-left"
                    aria-expanded={requestedDocsExpanded}
                  >
                    <span className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">
                      {`Documents requested · ${pendingCount} pending`}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 text-[#6B9E6E] transition-transform duration-200",
                        requestedDocsExpanded && "rotate-180",
                      )}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-200",
                      requestedDocsExpanded ? "mt-3 max-h-[480px] opacity-100" : "mt-0 max-h-0 opacity-0",
                    )}
                  >
                    <ul className="space-y-3 border-l border-[#2C2C2C]/[0.06] pl-3">
                      {pendingDocs.map((d) => (
                        <li key={d.id} className="flex flex-col items-start gap-1.5">
                          <span className="min-w-0 text-[13px] text-[#2C2C2C]/75">
                            {d.display_label}
                            <span className="text-xs font-normal text-[#2C2C2C]/40"> (required)</span>
                          </span>
                          <label className="mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-[#6B9E6E]/40 bg-[#6B9E6E]/8 px-3 py-1 text-xs font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/15">
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*,.pdf,.doc,.docx"
                              disabled={Boolean(uploadingId)}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                e.target.value = "";
                                void onPickFile(d.id, f);
                              }}
                            />
                            {uploadingId === d.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Upload
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ) : deal.documents.some((d) => d.direction === "requested") ? (
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Documents</p>
                  <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">Submitted</p>
                </div>
              </li>
            ) : null}
            {offerNotStarted ? (
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/12" aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/50">Offer</p>
                  <p className="mt-1 text-xs font-normal text-[#2C2C2C]/40">Not yet</p>
                </div>
              </li>
            ) : String(deal.pipeline_stage).toLowerCase() === "offer" ? (
              <li className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D4A843]/45 bg-[#D4A843]/15"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewOfferExpanded((v) => {
                        const next = !v;
                        if (!next) setOfferHistoryExpanded(false);
                        return next;
                      });
                    }}
                    className="inline-flex w-full items-center justify-between gap-2 text-left"
                    aria-expanded={reviewOfferExpanded}
                  >
                    <span className="min-w-0 text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">
                      Review offer · <span className="text-[#D4A843]">pending</span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 text-[#6B9E6E] transition-transform duration-300",
                        reviewOfferExpanded && "rotate-180",
                      )}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300",
                      reviewOfferExpanded ? "mt-3 max-h-[720px] opacity-100" : "mt-0 max-h-0 opacity-0",
                    )}
                  >
                    <div className="space-y-3 border-l border-[#2C2C2C]/[0.06] pl-3">
                      {latestPendingOffer ? (
                        <>
                          <OfferReadOnlyDetails offer={latestPendingOffer} agentName={deal.agent.name} />
                          {olderPendingOffersChronological.length > 0 ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => setOfferHistoryExpanded((v) => !v)}
                                className="text-xs font-semibold text-[#6B9E6E] hover:underline"
                                aria-expanded={offerHistoryExpanded}
                              >
                                {offerHistoryExpanded ? "Hide history" : "View history"}
                              </button>
                              <div
                                className={cn(
                                  "overflow-hidden transition-all duration-300",
                                  offerHistoryExpanded ? "mt-3 max-h-[480px] opacity-100" : "max-h-0 opacity-0",
                                )}
                              >
                                <div className="divide-y divide-[#2C2C2C]/[0.06] border-t border-[#2C2C2C]/[0.06] pt-2">
                                  {olderPendingOffersChronological.map((o) => (
                                    <div key={o.id} className="py-3 first:pt-2">
                                      <OfferReadOnlyDetails offer={o} agentName={deal.agent.name} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs italic text-[#2C2C2C]/45">No pending offer details yet.</p>
                      )}
                      <p className="text-xs italic text-[#2C2C2C]/45">Reply to your agent in Messages to negotiate</p>
                    </div>
                  </div>
                </div>
              </li>
            ) : (
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Offer</p>
                </div>
              </li>
            )}
            {reservationNotStarted ? (
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/12" aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/50">Reservation</p>
                  <p className="mt-1 text-xs font-normal text-[#2C2C2C]/40">Not yet</p>
                </div>
              </li>
            ) : stageLc === "reservation" ? (
              <li className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D4A843]/45 bg-[#D4A843]/15"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewReservationExpanded((v) => {
                        const next = !v;
                        if (!next) setReservationHistoryExpanded(false);
                        return next;
                      });
                    }}
                    className="inline-flex w-full items-center justify-between gap-2 text-left"
                    aria-expanded={reviewReservationExpanded}
                  >
                    <span className="min-w-0 text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">
                      Review reservation · <span className="text-[#D4A843]">pending</span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 text-[#6B9E6E] transition-transform duration-300",
                        reviewReservationExpanded && "rotate-180",
                      )}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300",
                      reviewReservationExpanded ? "mt-3 max-h-[720px] opacity-100" : "mt-0 max-h-0 opacity-0",
                    )}
                  >
                    <div className="space-y-3 border-l border-[#2C2C2C]/[0.06] pl-3">
                      {latestPendingReservation ? (
                        <>
                          <ReservationReadOnlyDetails row={latestPendingReservation} agentName={deal.agent.name} />
                          {olderPendingReservationsChronological.length > 0 ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => setReservationHistoryExpanded((v) => !v)}
                                className="text-xs font-semibold text-[#6B9E6E] hover:underline"
                                aria-expanded={reservationHistoryExpanded}
                              >
                                {reservationHistoryExpanded ? "Hide history" : "View history"}
                              </button>
                              <div
                                className={cn(
                                  "overflow-hidden transition-all duration-300",
                                  reservationHistoryExpanded ? "mt-3 max-h-[480px] opacity-100" : "max-h-0 opacity-0",
                                )}
                              >
                                <div className="divide-y divide-[#2C2C2C]/[0.06] border-t border-[#2C2C2C]/[0.06] pt-2">
                                  {olderPendingReservationsChronological.map((r) => (
                                    <div key={r.id} className="py-3 first:pt-2">
                                      <ReservationReadOnlyDetails row={r} agentName={deal.agent.name} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs italic text-[#2C2C2C]/45">No reservation details yet.</p>
                      )}
                      <p className="text-xs italic text-[#2C2C2C]/45">
                        Reply to your agent in Messages or upload signed agreement
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ) : (
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Reservation</p>
                </div>
              </li>
            )}
          </ul>
          ) : null}
        </section>

        <div className="flex items-start justify-end self-start pt-0.5" onClick={(e) => e.stopPropagation()}>
          <PipelineRowMenu
            deal={deal}
            clientUserId={clientUserId}
            listingRemovedUi={listingRemovedUi}
            onToggleDocs={onToggleDocs}
            onRequestRemove={onRequestRemove}
            onOpenDetail={onOpenDetail}
            menuLayout="list"
          />
        </div>
      </div>
      ) : null}

      {docsOpen ? (
        <div
          className={cn(
            "border-t border-[#2C2C2C]/[0.06] bg-[#FAF8F4]/80 px-6 py-6 sm:px-10",
            viewMode === "list" ? "hidden lg:block" : "block",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Documents</p>
          {deal.documents.length === 0 ? (
            <p className="mt-2 font-sans text-sm text-[#2C2C2C]/55">No documents for this deal yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {deal.documents.map((d) => {
                const s = String(d.status ?? "").toLowerCase();
                const canView = (s === "uploaded" || s === "approved") && Boolean(d.file_url?.trim());
                const showUpload = s === "pending";
                const uploadedDate = s === "uploaded" || s === "approved" ? formatShortDate(d.created_at) : "";
                return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2C2C2C]/[0.06] bg-white px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-semibold text-[#2C2C2C]">{d.display_label}</p>
                    {uploadedDate ? <p className="font-sans text-xs text-[#2C2C2C]/45">Uploaded {uploadedDate}</p> : null}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <DocumentStatusPill status={d.status} />
                    <button
                      type="button"
                      disabled={openingId === d.id || !canView}
                      onClick={() => void openDoc(d.id, d.file_url)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#6B9E6E] px-3 py-1 font-sans text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {openingId === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      View
                    </button>
                    {showUpload ? (
                      <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-[#6B9E6E]/40 bg-[#6B9E6E]/8 px-3 py-1 text-xs font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/15">
                        <input
                          type="file"
                          className="sr-only"
                          accept="image/*,.pdf,.doc,.docx"
                          disabled={Boolean(uploadingId)}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            e.target.value = "";
                            void onPickFile(d.id, f);
                          }}
                        />
                        {uploadingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Upload
                      </label>
                    ) : null}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}

function ClientPipelineToolbar({
  pipelineListTab,
  setPipelineListTab,
  sortKey,
  setSortKey,
  viewMode,
  setViewMode,
}: {
  pipelineListTab: "active" | "archived";
  setPipelineListTab: (tab: "active" | "archived") => void;
  sortKey: PipelineSortKey;
  setSortKey: (key: PipelineSortKey) => void;
  viewMode: PipelineViewMode;
  setViewMode: (mode: PipelineViewMode) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#2C2C2C]/[0.06] bg-[#FAF8F4]/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPipelineListTab("active")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition",
            pipelineListTab === "active"
              ? "bg-[#2C2C2C] text-white shadow-sm"
              : "text-[#2C2C2C]/55 hover:text-[#2C2C2C]",
          )}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setPipelineListTab("archived")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition",
            pipelineListTab === "archived"
              ? "bg-[#2C2C2C] text-white shadow-sm"
              : "text-[#2C2C2C]/55 hover:text-[#2C2C2C]",
          )}
        >
          Archived
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="pipeline-sort">
          Sort properties
        </label>
        <select
          id="pipeline-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as PipelineSortKey)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-[#2C2C2C] shadow-sm outline-none focus:border-[#6B9E6E]/40"
        >
          <option value="recent">Most recent</option>
          <option value="stage">Stage</option>
          <option value="name">Property name</option>
        </select>
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
              viewMode === "list" ? "bg-[#2C2C2C] text-white" : "text-[#2C2C2C]/55",
            )}
            aria-label="List view"
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden />
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("card")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
              viewMode === "card" ? "bg-[#2C2C2C] text-white" : "text-[#2C2C2C]/55",
            )}
            aria-label="Card view"
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            Cards
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pipeline deals UI; use inside client dashboard layout (or any shell that already authenticates). */
export function ClientPipelineInner() {
  const searchParams = useSearchParams();
  const { user, role, loading: authLoading, profile } = useAuth();

  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsOpen, setDocsOpen] = useState<Record<number, boolean>>({});
  const [pipelineListTab, setPipelineListTab] = useState<"active" | "archived">("active");
  const [archiveModalDeal, setArchiveModalDeal] = useState<PipelineDeal | null>(null);
  const [archiveReason, setArchiveReason] = useState<ClientArchiveReasonKey>("not_interested");
  const [archiveNote, setArchiveNote] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [sortKey, setSortKey] = useState<PipelineSortKey>("recent");
  const [viewMode, setViewMode] = useState<PipelineViewMode>("list");
  const [detailDeal, setDetailDeal] = useState<PipelineDeal | null>(null);
  const isBelowLg = useIsBelowLg();

  const highlightLeadId = useMemo(() => {
    const raw = searchParams.get("lead");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const archived = pipelineListTab === "archived";
      const res = await fetch(`/api/client/pipeline?archived=${archived ? "true" : "false"}`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { deals?: PipelineDeal[]; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not load pipeline");
        setDeals([]);
        return;
      }
      setDeals(json.deals ?? []);
    } finally {
      setLoading(false);
    }
  }, [pipelineListTab]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || role !== "client") return;
    void load();
  }, [authLoading, user?.id, role, load]);

  useEffect(() => {
    if (!highlightLeadId || loading) return;
    const id = `lead-${highlightLeadId}`;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [highlightLeadId, loading, deals.length]);

  const submitArchive = async () => {
    if (!archiveModalDeal) return;
    const noteTrim = archiveNote.trim();
    if (archiveReason === "other" && !noteTrim) {
      toast.error("Please enter a short reason (max 300 characters).");
      return;
    }
    setArchiveBusy(true);
    try {
      const res = await fetch(`/api/client/leads/${archiveModalDeal.lead_id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          archive_reason: archiveReason,
          archive_note: archiveReason === "other" ? noteTrim.slice(0, 300) : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Could not remove from pipeline");
        return;
      }
      toast.success("Removed from your pipeline");
      setArchiveModalDeal(null);
      setArchiveNote("");
      setArchiveReason("not_interested");
      await load();
    } finally {
      setArchiveBusy(false);
    }
  };

  if (authLoading || !user?.id || role !== "client") {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
        <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" aria-hidden />
      </div>
    );
  }

  const sortedDeals = useMemo(() => sortPipelineDeals(deals, sortKey), [deals, sortKey]);

  return (
    <div className="w-full min-w-0 font-sans text-[#2C2C2C]">
      <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/[0.07] bg-white shadow-[0_2px_16px_rgba(44,44,44,0.06),0_1px_3px_rgba(44,44,44,0.04)]">
        <ClientPipelineToolbar
            pipelineListTab={pipelineListTab}
            setPipelineListTab={setPipelineListTab}
            sortKey={sortKey}
            setSortKey={setSortKey}
            viewMode={viewMode}
            setViewMode={setViewMode}
        />
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#6B9E6E]" aria-hidden />
          </div>
        ) : deals.length === 0 ? (
          <div className="border-t border-dashed border-[#2C2C2C]/10 px-6 py-20 text-center sm:px-10">
            <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">
              {pipelineListTab === "archived" ? "No archived properties" : "No properties yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#2C2C2C]/50">
              {pipelineListTab === "archived"
                ? "Properties you archive will appear here."
                : "Browse listings to find your next home."}
            </p>
            {pipelineListTab === "active" ? (
              <Link
                href="/"
                className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5a8a5d]"
              >
                Explore listings
              </Link>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              viewMode === "list" &&
                "lg:max-h-[min(72vh,calc(100dvh-14rem))] lg:overflow-y-auto lg:overscroll-contain",
            )}
          >
          {pipelineListTab === "active" && viewMode === "list" ? (
            <div className="sticky top-0 z-10 hidden border-b border-stone-200 bg-[#F5F2EC] px-6 py-3 lg:block">
              <PipelineColumnHeaders />
            </div>
          ) : null}
          <div
            className={cn(
              viewMode === "card" &&
                "grid items-stretch gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0",
            )}
          >
            {sortedDeals.map((deal) => (
              <DealCard
                key={deal.lead_id}
                deal={deal}
                clientUserId={user.id}
                clientDisplayName={profile?.full_name}
                clientAvatarUrl={profile?.avatar_url}
                docsOpen={docsOpen[deal.lead_id] ?? false}
                onToggleDocs={() => setDocsOpen((s) => ({ ...s, [deal.lead_id]: !s[deal.lead_id] }))}
                onUploaded={() => void load()}
                highlight={highlightLeadId === deal.lead_id}
                isArchived={pipelineListTab === "archived"}
                viewMode={viewMode}
                onRequestRemove={
                  pipelineListTab === "active"
                    ? () => {
                        setArchiveReason("not_interested");
                        setArchiveNote("");
                        setArchiveModalDeal(deal);
                      }
                    : undefined
                }
                onOpenDetail={() => setDetailDeal(deal)}
              />
            ))}
          </div>
          </div>
        )}
      </div>

      <PipelineDealDetailModal
        deal={detailDeal}
        open={detailDeal != null}
        onOpenChange={(open) => {
          if (!open) setDetailDeal(null);
        }}
        clientUserId={user.id}
        isMobile={isBelowLg}
        onUploaded={() => void load()}
        onRequestArchive={
          detailDeal && pipelineListTab === "active"
            ? () => {
                setArchiveReason("not_interested");
                setArchiveNote("");
                setArchiveModalDeal(detailDeal);
              }
            : undefined
        }
      />

      <Dialog
        open={archiveModalDeal != null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveModalDeal(null);
            setArchiveBusy(false);
          }
        }}
      >
        <DialogContent className="max-w-md border border-[#2C2C2C]/10 bg-white font-sans text-[#2C2C2C] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#2C2C2C]">Remove from pipeline</DialogTitle>
          </DialogHeader>
          {archiveModalDeal ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#2C2C2C]/75">
                {clientArchiveConfirmCopy(archiveModalDeal.pipeline_stage)}
              </p>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                Reason
                <select
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value as ClientArchiveReasonKey)}
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                >
                  {(Object.keys(CLIENT_ARCHIVE_REASON_LABEL) as ClientArchiveReasonKey[]).map((k) => (
                    <option key={k} value={k}>
                      {CLIENT_ARCHIVE_REASON_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              {archiveReason === "other" ? (
                <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Describe why (required, max 300 characters)
                  <textarea
                    value={archiveNote}
                    onChange={(e) => setArchiveNote(e.target.value.slice(0, 300))}
                    rows={3}
                    maxLength={300}
                    className="mt-1 w-full resize-none rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                    placeholder="Tell your agent briefly…"
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full border-[#2C2C2C]/20 sm:w-auto"
              disabled={archiveBusy}
              onClick={() => setArchiveModalDeal(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={archiveBusy}
              onClick={() => void submitArchive()}
              className="w-full rounded-full border-0 bg-red-600 px-5 text-white hover:bg-red-700 sm:w-auto"
            >
              {archiveBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : (
                "Remove from pipeline"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
