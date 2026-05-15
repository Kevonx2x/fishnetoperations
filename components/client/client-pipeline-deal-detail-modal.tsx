"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { StartChatButton } from "@/features/messaging/components/start-chat-button";
import { formatListingPricePhp } from "@/lib/format-listing-price";
import { formatActivityTimelineRelative } from "@/lib/lead-activity-timeline";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PipelineDeal } from "@/components/client/client-pipeline-page";

const CLIENT_PIPELINE_STEPS = ["Inquiry", "Viewing", "Offer", "Reservation", "Completed"] as const;

type ClientActivityKind =
  | "inquiry_sent"
  | "viewing_requested"
  | "viewing_scheduled"
  | "viewing_rescheduled"
  | "viewing_cancelled"
  | "viewing_completed"
  | "document_requested"
  | "document_uploaded"
  | "offer_received"
  | "reservation_received"
  | "stage_completed";

type ClientActivityEvent = {
  kind: ClientActivityKind;
  timestamp: string;
  label: string;
  sublabel: string;
};

const ACTIVITY_ICON: Record<ClientActivityKind, LucideIcon> = {
  inquiry_sent: UserPlus,
  viewing_requested: Calendar,
  viewing_scheduled: Calendar,
  viewing_rescheduled: Calendar,
  viewing_cancelled: X,
  viewing_completed: Check,
  document_requested: FileText,
  document_uploaded: FileText,
  offer_received: ArrowRight,
  reservation_received: ArrowRight,
  stage_completed: Check,
};

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatViewingWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

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

function statusPillVariantForDeal(deal: PipelineDeal, pendingCount: number): "neutral" | "sage" | "gold" {
  const stageLc = String(deal.pipeline_stage ?? "").toLowerCase();
  if (stageLc === "offer") return "gold";
  if (stageLc === "lead" && deal.viewing?.status !== "confirmed" && pendingCount === 0) return "neutral";
  return "sage";
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

function ModalPipelineStepper({ deal, muted }: { deal: PipelineDeal; muted?: boolean }) {
  const cur = clientPipelineCurrentStepIndex(deal);
  const trackTop = "top-[10px]";
  return (
    <div className={cn("w-full min-w-0 font-sans", muted && "opacity-50 grayscale")}>
      <div className="relative flex w-full min-w-0 items-start">
        <div className={cn("pointer-events-none absolute right-2 left-2 z-0 h-px bg-[#2C2C2C]/08", trackTop)} aria-hidden />
        {CLIENT_PIPELINE_STEPS.map((label, i) => {
          const done = cur === 5 || i < cur;
          const active = cur !== 5 && i === cur;
          const offerGold = active && i === 2 && String(deal.pipeline_stage).toLowerCase() === "offer";
          const segmentAfterGreen = cur === 5 || cur > i;
          return (
            <div key={label} className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-px">
              <div className="relative flex h-6 w-full min-w-0 items-center justify-center">
                {i < CLIENT_PIPELINE_STEPS.length - 1 && segmentAfterGreen ? (
                  <div className={cn("absolute left-1/2 z-[1] h-px w-full min-w-0 bg-[#6B9E6E]/55", trackTop)} aria-hidden />
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

function ModalNextStepsChecklist({ deal, pendingCount }: { deal: PipelineDeal; pendingCount: number }) {
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
    <ul className="space-y-3 text-[14px] text-[#2C2C2C]/85">
      <li className="flex items-start gap-2.5">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        <span className="font-medium">Inquiry sent</span>
      </li>
      <li className="flex items-start gap-2.5">
        {viewingConfirmed ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        ) : viewingDeclined ? (
          <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-xs text-[#2C2C2C]/35" aria-hidden>
            ×
          </span>
        ) : deal.viewing ? (
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/15" aria-hidden />
        )}
        <span>
          Viewing
          {viewingConfirmed ? " · Scheduled" : viewingDeclined ? " · Declined" : deal.viewing ? " · Awaiting confirmation" : " · Not scheduled yet"}
        </span>
      </li>
      <li className="flex items-start gap-2.5">
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
      <li className="flex items-start gap-2.5">
        {hasOfferProgress ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/15" aria-hidden />
        )}
        <span>Offer{hasOfferProgress ? " · In progress or complete" : ""}</span>
      </li>
      <li className="flex items-start gap-2.5">
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

function DocumentStatusPill({ status }: { status: string | null }) {
  const s = String(status ?? "").trim().toLowerCase();
  const label = s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : s === "uploaded" ? "Received" : "Requested";
  const cls =
    s === "approved"
      ? "border-[#6B9E6E]/30 bg-[#6B9E6E]/12 text-[#2C5F32]"
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

function buildClientDealActivityEvents(deal: PipelineDeal): ClientActivityEvent[] {
  const events: ClientActivityEvent[] = [];

  events.push({
    kind: "inquiry_sent",
    timestamp: deal.lead_created_at,
    label: "Inquiry sent",
    sublabel: deal.property.title,
  });

  if (deal.viewing) {
    const v = deal.viewing;
    const status = String(v.status ?? "").toLowerCase();
    const createdMs = new Date(v.created_at).getTime();
    const updatedMs = new Date(v.updated_at).getTime();

    events.push({
      kind: "viewing_requested",
      timestamp: v.created_at,
      label: "Viewing requested",
      sublabel: v.scheduled_at ? formatViewingWhen(v.scheduled_at) : "Awaiting agent confirmation",
    });

    if (status === "confirmed" || status === "scheduled") {
      events.push({
        kind: "viewing_scheduled",
        timestamp: v.updated_at || v.created_at,
        label: "Viewing scheduled",
        sublabel: v.scheduled_at ? formatViewingWhen(v.scheduled_at) : "",
      });
    }

    if (Number.isFinite(createdMs) && Number.isFinite(updatedMs) && updatedMs - createdMs > 120_000 && status !== "declined") {
      events.push({
        kind: "viewing_rescheduled",
        timestamp: v.updated_at,
        label: "Viewing rescheduled",
        sublabel: v.scheduled_at ? formatViewingWhen(v.scheduled_at) : "",
      });
    }

    if (status === "declined" || status === "cancelled") {
      events.push({
        kind: "viewing_cancelled",
        timestamp: v.updated_at || v.created_at,
        label: status === "declined" ? "Viewing declined" : "Viewing cancelled",
        sublabel: "",
      });
    }

    if (status === "completed") {
      events.push({
        kind: "viewing_completed",
        timestamp: v.updated_at || v.created_at,
        label: "Viewing completed",
        sublabel: "",
      });
    }
  }

  for (const d of deal.documents) {
    const status = String(d.status ?? "").toLowerCase();
    const direction = String(d.direction ?? "").toLowerCase();
    if (direction === "requested" && status === "pending") {
      events.push({
        kind: "document_requested",
        timestamp: d.created_at,
        label: "Document requested",
        sublabel: d.display_label,
      });
    }
    if (status === "uploaded" || status === "approved") {
      events.push({
        kind: "document_uploaded",
        timestamp: d.created_at,
        label: "Document uploaded",
        sublabel: d.display_label,
      });
    }
  }

  for (const o of deal.offers ?? []) {
    events.push({
      kind: "offer_received",
      timestamp: o.created_at,
      label: "Offer received",
      sublabel: `From ${deal.agent.name}`,
    });
  }

  for (const r of deal.reservations ?? []) {
    events.push({
      kind: "reservation_received",
      timestamp: r.created_at,
      label: "Reservation received",
      sublabel: `From ${deal.agent.name}`,
    });
  }

  if (String(deal.pipeline_stage ?? "").toLowerCase() === "closed") {
    const latest = [...events].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0];
    events.push({
      kind: "stage_completed",
      timestamp: latest?.timestamp ?? deal.lead_created_at,
      label: "Deal completed",
      sublabel: "",
    });
  }

  return events
    .filter((e) => e.timestamp && Number.isFinite(new Date(e.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function ModalActivityTimeline({ events }: { events: ClientActivityEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? events : events.slice(0, 10);

  if (events.length === 0) {
    return <p className="text-sm text-[#2C2C2C]/55">No activity yet for this deal.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-[#2C2C2C]/[0.06] rounded-xl border border-[#2C2C2C]/[0.06] bg-white">
        {visible.map((event, idx) => {
          const Icon = ACTIVITY_ICON[event.kind];
          return (
            <li key={`${event.kind}-${event.timestamp}-${idx}`} className="flex min-h-11 items-start gap-2.5 px-3 py-2.5">
              <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[#2C2C2C]/55">
                <Icon className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight text-[#2C2C2C]">{event.label}</p>
                {event.sublabel ? (
                  <p className="mt-0.5 text-xs leading-snug text-[#2C2C2C]/50">{event.sublabel}</p>
                ) : null}
              </div>
              <span className="shrink-0 pt-0.5 text-xs text-[#2C2C2C]/40">
                {formatActivityTimelineRelative(event.timestamp)}
              </span>
            </li>
          );
        })}
      </ul>
      {events.length > 10 ? (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-[#6B9E6E] hover:underline"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show less" : `Show all (${events.length})`}
        </button>
      ) : null}
    </>
  );
}

export function PipelineDealDetailModal({
  deal,
  open,
  onOpenChange,
  clientUserId,
  isMobile,
  onUploaded,
  onRequestArchive,
}: {
  deal: PipelineDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientUserId: string;
  isMobile: boolean;
  onUploaded: () => void;
  onRequestArchive?: () => void;
}) {
  const [agentAvatarFailed, setAgentAvatarFailed] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAgentAvatarFailed(false);
      setOpeningId(null);
      setUploadingId(null);
    }
  }, [open, deal?.lead_id]);

  const pendingCount = useMemo(
    () => (deal?.documents ?? []).filter((d) => d.pending_upload).length,
    [deal?.documents],
  );
  const submittedDocCount = useMemo(
    () =>
      (deal?.documents ?? []).filter((d) => {
        const s = String(d.status ?? "").toLowerCase();
        return s === "uploaded" || s === "approved";
      }).length,
    [deal?.documents],
  );

  const activityEvents = useMemo(() => (deal ? buildClientDealActivityEvents(deal) : []), [deal]);

  const onPickFile = async (docId: string, file: File | null) => {
    if (!file || !deal) return;
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

  if (!deal) return null;

  const listingRemovedUi = Boolean(deal.property.listing_removed);
  const initials = pipelineAgentInitials(deal.agent.name);
  const statusVariant = statusPillVariantForDeal(deal, pendingCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(92dvh,900px)] w-full max-w-[min(800px,calc(100%-1.5rem))] flex-col gap-0 overflow-hidden border border-[#2C2C2C]/10 bg-[#FAF8F4] p-0 font-sans text-[#2C2C2C] shadow-2xl ring-1 ring-[#2C2C2C]/[0.06]",
          isMobile &&
            "fixed inset-x-0 bottom-0 top-auto max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none data-open:slide-in-from-bottom",
          !isMobile && "rounded-2xl",
        )}
      >
        <DialogTitle className="sr-only">{deal.property.title} — deal details</DialogTitle>
        <DialogDescription className="sr-only">Full pipeline details for this property inquiry</DialogDescription>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-[#2C2C2C]/[0.06] bg-white/80 px-5 pb-4 pt-5 sm:px-6">
            <button
              type="button"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/60 transition hover:bg-[#FAF8F4] hover:text-[#2C2C2C]"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <div className="flex gap-4 pr-10">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F3F0EA] ring-1 ring-[#2C2C2C]/[0.06]">
                {deal.property.hero_image ? (
                  <Image
                    src={deal.property.hero_image}
                    alt=""
                    fill
                    className={cn("object-cover", listingRemovedUi && "grayscale")}
                    sizes="64px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-[#2C2C2C]/38">No photo</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-xl font-semibold leading-snug tracking-tight text-[#2C2C2C] sm:text-2xl">
                  {deal.property.title}
                </h2>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#2C2C2C]">
                  {formatPipelineCardPrice(deal.property.price)}
                </p>
                <div className="mt-2">
                  {!listingRemovedUi ? (
                    <StatusPill label={deal.status_label} variant={statusVariant} />
                  ) : (
                    <span className="inline-flex shrink-0 rounded-full border border-[#B5453A]/30 bg-[#B5453A]/[0.12] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#B5453A]">
                      Unavailable
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <section className="mb-6">
              <ModalPipelineStepper deal={deal} muted={listingRemovedUi} />
            </section>

            <section className="mb-6 rounded-xl border border-[#2C2C2C]/[0.06] bg-white px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/40">Your agent</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#F3F0EA] ring-1 ring-inset ring-[#2C2C2C]/08">
                  {deal.agent.image_url?.trim() && !agentAvatarFailed ? (
                    <Image
                      src={deal.agent.image_url}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                      onError={() => setAgentAvatarFailed(true)}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#2C2C2C]/50">
                      {initials}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[#2C2C2C]">
                    <span className="truncate">{deal.agent.name}</span>
                    {deal.agent.verified ? (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-label="Verified agent" />
                    ) : null}
                  </p>
                </div>
                {deal.agent.user_id && !listingRemovedUi ? (
                  <StartChatButton
                    agentId={deal.agent.user_id}
                    clientId={clientUserId}
                    label="Message"
                    showMessageIcon
                    metadata={{
                      property_id: deal.property.id ?? null,
                      property_name: deal.property.title ?? null,
                      property_price: deal.property.price ?? null,
                      property_image: deal.property.hero_image ?? null,
                    }}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-[#6B9E6E] bg-white px-4 text-[13px] font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/10"
                  />
                ) : null}
              </div>
            </section>

            <section className="mb-6">
              <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">Your next steps</h3>
              <div className="mt-3 rounded-xl border border-[#2C2C2C]/[0.06] bg-white px-4 py-4">
                <ModalNextStepsChecklist deal={deal} pendingCount={pendingCount} />
              </div>
            </section>

            <section className="mb-6">
              <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">
                Documents ({submittedDocCount} submitted)
              </h3>
              <div className="mt-3">
                {deal.documents.length === 0 ? (
                  <p className="text-sm text-[#2C2C2C]/55">No documents for this deal yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {deal.documents.map((d) => {
                      const s = String(d.status ?? "").toLowerCase();
                      const canView = (s === "uploaded" || s === "approved") && Boolean(d.file_url?.trim());
                      const showUpload = s === "pending";
                      const uploadedDate = s === "uploaded" || s === "approved" ? formatShortDate(d.created_at) : "";
                      return (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2C2C2C]/[0.06] bg-white px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#2C2C2C]">{d.display_label}</p>
                            {uploadedDate ? (
                              <p className="text-xs text-[#2C2C2C]/45">Uploaded {uploadedDate}</p>
                            ) : null}
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <DocumentStatusPill status={d.status} />
                            {canView ? (
                              <button
                                type="button"
                                disabled={openingId === d.id}
                                onClick={() => void openDoc(d.id, d.file_url)}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#6B9E6E] px-2.5 py-1 text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10 disabled:opacity-50"
                              >
                                {openingId === d.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ExternalLink className="h-3.5 w-3.5" />
                                )}
                                View
                              </button>
                            ) : null}
                            {showUpload ? (
                              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#6B9E6E]/40 bg-[#6B9E6E]/8 px-2.5 py-1 text-xs font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/15">
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
            </section>

            <section className="mb-2">
              <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">Activity</h3>
              <p className="mt-1 text-sm text-[#2C2C2C]/55">Updates from your agent and this listing appear here.</p>
              <div className="mt-3">
                <ModalActivityTimeline events={activityEvents} />
              </div>
            </section>
          </div>

          <div
            className={cn(
              "shrink-0 border-t border-[#2C2C2C]/[0.08] bg-white/95 px-5 py-4 backdrop-blur sm:px-6",
              isMobile && "pb-[max(1rem,env(safe-area-inset-bottom))]",
            )}
            data-pipeline-card-action
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
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
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] px-4 text-[13px] font-semibold text-white hover:bg-[#5a8a5d]"
                />
              ) : (
                <span className="flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-400">
                  Messaging unavailable
                </span>
              )}
              {deal.property.id && !listingRemovedUi ? (
                <Link
                  href={`/properties/${encodeURIComponent(deal.property.id)}`}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#6B9E6E] bg-white px-4 text-[13px] font-bold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/10"
                >
                  <Home className="h-4 w-4 shrink-0" aria-hidden />
                  View Property
                </Link>
              ) : null}
            </div>
            {onRequestArchive ? (
              <button
                type="button"
                className="mt-3 w-full text-center text-sm font-medium text-[#2C2C2C]/55 transition hover:text-[#2C2C2C]"
                onClick={() => {
                  onOpenChange(false);
                  onRequestArchive();
                }}
              >
                Archive
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
