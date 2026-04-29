"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { StartChatButton } from "@/features/messaging/components/start-chat-button";
import { useAuth } from "@/contexts/auth-context";
import { formatListingPricePhp } from "@/lib/format-listing-price";
import { cn } from "@/lib/utils";

type PipelineDeal = {
  lead_id: number;
  pipeline_stage: string;
  status_label: string;
  property: {
    id: string | null;
    title: string;
    price: string;
    hero_image: string;
    photo_count?: number;
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

function formatViewingWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

const CLIENT_PIPELINE_STEPS = ["Inquiry", "Viewing", "Offer", "Reservation", "Closed"] as const;

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
        variant === "neutral" && "border-[#2C2C2C]/08 bg-[#FAF8F4] text-[#2C2C2C]/60",
        variant === "gold" && "border-[#D4A843]/30 bg-[#D4A843]/12 text-[#2C2C2C]/90",
      )}
    >
      {text}
    </span>
  );
}

function ClientPipelineStepper({ deal }: { deal: PipelineDeal }) {
  const cur = clientPipelineCurrentStepIndex(deal);
  return (
    <div className="mt-7 w-full min-w-0 font-sans">
      {/* No horizontal scroll container here — avoids a “thick bar” (OS scrollbar) under labels */}
      <div className="flex w-full min-w-0 items-center">
        {CLIENT_PIPELINE_STEPS.map((label, i) => {
          const done = cur === 5 || i < cur;
          const active = cur !== 5 && i === cur;
          const offerGold = active && i === 2 && String(deal.pipeline_stage).toLowerCase() === "offer";
          const segmentBeforeGreen = cur === 5 || cur > i - 1;
          return (
            <div key={label} className="flex min-w-0 flex-1 items-center">
              {i > 0 ? (
                <div
                  className={cn(
                    "h-px min-w-[2px] flex-1",
                    segmentBeforeGreen ? "bg-[#6B9E6E]/70" : "bg-[#2C2C2C]/08",
                  )}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-6 shrink-0 flex-col items-center gap-1.5 sm:w-7">
                {done ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#6B9E6E] bg-[#6B9E6E] text-white sm:h-6 sm:w-6">
                    <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : active ? (
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm",
                      offerGold ? "border-[#D4A843] bg-[#D4A843]" : "border-[#6B9E6E] bg-[#6B9E6E]",
                    )}
                    aria-hidden
                  />
                ) : (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-[#2C2C2C]/10 bg-white sm:h-6 sm:w-6"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "max-w-[4rem] text-center text-[9px] font-medium leading-tight tracking-tight sm:max-w-[4.25rem] sm:text-[10px]",
                    done || active ? "text-[#2C2C2C]/70" : "text-[#2C2C2C]/35",
                  )}
                >
                  {label}
                </span>
              </div>
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
      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-[#6B9E6E]/10 px-4 py-3.5 font-sans text-sm leading-snug text-[#2C2C2C]/90">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
          <span className="min-w-0 font-medium">{viewingWhenLine}</span>
        </div>
        {deal.property.id ? (
          <Link
            href={`/properties/${encodeURIComponent(deal.property.id)}`}
            className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-[#6B9E6E] hover:underline"
          >
            View details <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    );
  }

  if (stage === "lead" && !viewingConfirmed) {
    return (
      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-[#FAF8F4] px-4 py-3.5 font-sans text-sm leading-relaxed text-[#2C2C2C]/65">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]/90" aria-hidden />
          <span className="min-w-0 font-normal">We&apos;ve received your inquiry and will get back to you soon.</span>
        </div>
      </div>
    );
  }

  if (stage === "offer") {
    return (
      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-[#D4A843]/12 px-4 py-3.5 font-sans text-sm leading-relaxed text-[#2C2C2C]/85">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
          <span className="min-w-0 font-normal">You have a pending offer. Please review and respond.</span>
        </div>
        {deal.property.id ? (
          <Link
            href={`/properties/${encodeURIComponent(deal.property.id)}`}
            className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-[#2C2C2C]/90 hover:underline"
          >
            View offer <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    );
  }

  if (viewingDeclined) {
    return (
      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-[#FAF8F4] px-4 py-3.5 font-sans text-sm text-[#2C2C2C]/65">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/35" aria-hidden />
          <span className="min-w-0 font-normal">Viewing was declined for this property.</span>
        </div>
      </div>
    );
  }

  if (deal.viewing && !viewingConfirmed) {
    return (
      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-[#FAF8F4] px-4 py-3.5 font-sans text-sm text-[#2C2C2C]/60">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/35" aria-hidden />
          <span className="min-w-0 font-normal">Viewing — awaiting confirmation from your agent.</span>
        </div>
      </div>
    );
  }

  return null;
}

function DealCard({
  deal,
  clientUserId,
  docsOpen,
  onToggleDocs,
  onUploaded,
  highlight,
}: {
  deal: PipelineDeal;
  clientUserId: string;
  docsOpen: boolean;
  onToggleDocs: () => void;
  onUploaded: () => void;
  highlight: boolean;
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [agentAvatarFailed, setAgentAvatarFailed] = useState(false);

  const pendingDocs = deal.documents.filter((d) => d.pending_upload);
  const pendingCount = pendingDocs.length;

  const inquiryDate = deal.viewing?.created_at ?? deal.lead_created_at;
  const viewingConfirmed = deal.viewing?.status === "confirmed";
  const viewingDeclined = deal.viewing?.status === "declined";

  const offerNotStarted = !["offer", "reservation", "closed"].includes(
    String(deal.pipeline_stage ?? "").toLowerCase(),
  );

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
  const accentGold = stageLc === "offer" || pendingCount > 0;

  return (
    <article
      id={`lead-${deal.lead_id}`}
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl border border-[#2C2C2C]/[0.05] bg-white shadow-[0_2px_20px_rgba(44,44,44,0.05)] transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(44,44,44,0.09)]",
        highlight && "ring-2 ring-[#D4A843]/50",
      )}
    >
      {/* Mock: thin vertical accent on card edge */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-5 left-0 top-5 z-10 w-[3px] rounded-r-full sm:bottom-6 sm:top-6",
          accentGold ? "bg-[#D4A843]" : "bg-[#6B9E6E]",
        )}
        aria-hidden
      />

      <div className="flex flex-col gap-10 px-6 py-8 pl-7 sm:px-8 sm:py-9 sm:pl-9 xl:flex-row xl:items-stretch xl:gap-x-10 xl:gap-y-0 xl:px-10 xl:py-10 xl:pl-11">
        {/* LEFT — property image (mock: taller portrait) */}
        <div className="flex shrink-0 justify-center xl:block xl:w-[min(100%,220px)] xl:max-w-[240px] xl:justify-start">
          <div className="relative z-0 aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-xl bg-[#FAF8F4] ring-1 ring-[#2C2C2C]/[0.04] xl:max-w-none">
            {deal.property.hero_image ? (
              <Image
                src={deal.property.hero_image}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1280px) 220px, 240px"
                unoptimized
              />
            ) : (
              <div className="flex h-full min-h-[168px] w-full items-center justify-center font-sans text-xs font-medium text-[#2C2C2C]/38">
                No photo
              </div>
            )}
            {photosBadge ? (
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full bg-[#2C2C2C]/75 px-2.5 py-1 font-sans text-[11px] font-medium text-white">
                {photosBadge}
              </div>
            ) : null}
          </div>
        </div>

        {/* CENTER — property info, progress, banner (mock: title in Inter) */}
        <div className="flex min-w-0 flex-1 flex-col font-sans xl:min-w-0 xl:border-l xl:border-[#2C2C2C]/[0.05] xl:pl-10 xl:pr-2">
          <h2 className="pr-2 font-sans text-xl font-bold leading-snug tracking-tight text-[#2C2C2C] sm:text-[1.35rem] sm:leading-snug">
            {deal.property.title}
          </h2>
          <p className="mt-3 font-sans text-lg font-semibold text-[#D4A843] sm:text-xl">
            {formatPipelineCardPrice(deal.property.price)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-inset ring-[#2C2C2C]/10">
              {deal.agent.image_url?.trim() && !agentAvatarFailed ? (
                <Image
                  src={deal.agent.image_url}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                  unoptimized
                  onError={() => setAgentAvatarFailed(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-sans text-[11px] font-semibold tracking-tight text-[#2C2C2C]/55">
                  {initials}
                </span>
              )}
            </span>
            <span className="font-sans text-[13px] font-medium text-[#2C2C2C]/50">{deal.agent.name}</span>
            {deal.agent.verified ? (
              <span className="inline-flex items-center gap-0.5 text-[#6B9E6E]" title="Verified agent">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Verified</span>
              </span>
            ) : null}
          </div>

          <ClientPipelineStepper deal={deal} />
          <DealStatusBanner deal={deal} />
        </div>

        {/* RIGHT — status, next steps, quick actions (mock) */}
        <div className="flex w-full shrink-0 flex-col gap-0 pt-1 font-sans xl:w-[min(100%,280px)] xl:shrink-0 xl:border-l xl:border-[#2C2C2C]/[0.05] xl:pl-8">
          <div className="flex justify-end">
            <StatusPill label={deal.status_label} variant={statusPillVariant} />
          </div>

          <section className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/38">Your next steps</p>
            <ul className="mt-4 space-y-4 text-sm text-[#2C2C2C]/80">
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Inquiry sent</p>
                  <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">{formatShortDate(inquiryDate)}</p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
              </li>
              {viewingConfirmed ? (
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Viewing scheduled</p>
                    <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">
                      {formatViewingWhen(deal.viewing!.scheduled_at)}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
                </li>
              ) : viewingDeclined ? (
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-xs font-medium text-[#2C2C2C]/30" aria-hidden>
                    ×
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Viewing declined</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
                </li>
              ) : deal.viewing ? (
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/30" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Viewing</p>
                    <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">Awaiting confirmation</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
                </li>
              ) : (
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/12" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight text-[#2C2C2C]/50">Viewing</p>
                    <p className="mt-1 text-xs font-normal text-[#2C2C2C]/40">Not scheduled yet</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
                </li>
              )}
              {pendingCount > 0 ? (
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D4A843]/50 bg-[#D4A843]/15" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Documents requested</p>
                    <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">{pendingCount} pending</p>
                    <ul className="mt-3 space-y-2.5 border-l border-[#2C2C2C]/[0.06] pl-3">
                      {pendingDocs.map((d) => (
                        <li key={d.id} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                          <span className="min-w-0 text-[13px] text-[#2C2C2C]/75">
                            {d.display_label}
                            <span className="text-xs font-normal text-[#2C2C2C]/40"> (required)</span>
                          </span>
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
                            {uploadingId === d.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Upload
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
                </li>
              ) : deal.documents.some((d) => d.direction === "requested") ? (
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight text-[#2C2C2C]/90">Documents</p>
                    <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">Submitted</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
                </li>
              ) : null}
              <li className="flex items-start gap-3">
                {offerNotStarted ? (
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/12" aria-hidden />
                ) : String(deal.pipeline_stage).toLowerCase() === "offer" ? (
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D4A843]/45 bg-[#D4A843]/15" aria-hidden />
                ) : (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px] font-semibold leading-tight", offerNotStarted ? "text-[#2C2C2C]/50" : "text-[#2C2C2C]/90")}>
                    {offerNotStarted
                      ? "Offer"
                      : String(deal.pipeline_stage).toLowerCase() === "offer"
                        ? "Review offer"
                        : "Offer"}
                  </p>
                  {!offerNotStarted && String(deal.pipeline_stage).toLowerCase() === "offer" ? (
                    <p className="mt-1 text-xs font-normal text-[#2C2C2C]/45">Action needed</p>
                  ) : offerNotStarted ? (
                    <p className="mt-1 text-xs font-normal text-[#2C2C2C]/40">Not yet</p>
                  ) : null}
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/15" aria-hidden />
              </li>
            </ul>
          </section>

          <div className="my-7 h-px w-full bg-[#2C2C2C]/[0.06]" aria-hidden />

          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/38">Quick actions</p>
          <div className="mt-4 flex w-full flex-col gap-3">
            {deal.agent.user_id ? (
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
                className="h-10 w-full justify-center rounded-full border-0 bg-[#6B9E6E] px-4 py-0 text-[13px] font-semibold text-white hover:bg-[#5d8a60]"
              />
            ) : null}
            {deal.property.id ? (
              <Link
                href={`/properties/${encodeURIComponent(deal.property.id)}`}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#2C2C2C]/12 bg-transparent px-4 text-[13px] font-semibold text-[#2C2C2C]/85 transition hover:border-[#2C2C2C]/18 hover:bg-[#FAF8F4]/80"
              >
                <Home className="h-3.5 w-3.5 shrink-0 text-[#2C2C2C]/45" aria-hidden />
                View Property
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onToggleDocs}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#2C2C2C]/12 bg-transparent px-4 text-[13px] font-semibold text-[#2C2C2C]/85 transition hover:border-[#2C2C2C]/18 hover:bg-[#FAF8F4]/80"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#2C2C2C]/45" aria-hidden />
              View Documents
            </button>
          </div>
        </div>
      </div>

      {docsOpen ? (
        <div className="border-t border-[#2C2C2C]/[0.06] bg-[#FAF8F4]/80 px-6 py-6 sm:px-10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Documents</p>
          {deal.documents.length === 0 ? (
            <p className="mt-2 font-sans text-sm text-[#2C2C2C]/55">No documents for this deal yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {deal.documents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2C2C2C]/[0.06] bg-white px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-semibold text-[#2C2C2C]">{d.display_label}</p>
                    <p className="font-sans text-xs text-[#2C2C2C]/45">
                      {d.pending_upload ? "Awaiting upload" : d.status ?? "—"}
                    </p>
                  </div>
                  {!d.pending_upload && d.file_url ? (
                    <button
                      type="button"
                      disabled={openingId === d.id}
                      onClick={() => void openDoc(d.id, d.file_url)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#6B9E6E] px-3 py-1 font-sans text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10 disabled:opacity-50"
                    >
                      {openingId === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      View
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </article>
  );
}

/** Pipeline deals UI; use inside client dashboard layout (or any shell that already authenticates). */
export function ClientPipelineInner() {
  const searchParams = useSearchParams();
  const { user, role, loading: authLoading } = useAuth();

  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsOpen, setDocsOpen] = useState<Record<number, boolean>>({});

  const highlightLeadId = useMemo(() => {
    const raw = searchParams.get("lead");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/client/pipeline", { credentials: "include" });
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
  }, []);

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

  if (authLoading || !user?.id || role !== "client") {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
        <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" aria-hidden />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl font-sans text-[#2C2C2C]">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-[#6B9E6E]" aria-hidden />
        </div>
      ) : deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#2C2C2C]/55">
            No active deals yet. Request a viewing on a listing to see it here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5a8a5d]"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {deals.map((deal) => (
            <DealCard
              key={deal.lead_id}
              deal={deal}
              clientUserId={user.id}
              docsOpen={docsOpen[deal.lead_id] ?? false}
              onToggleDocs={() => setDocsOpen((s) => ({ ...s, [deal.lead_id]: !s[deal.lead_id] }))}
              onUploaded={() => void load()}
              highlight={highlightLeadId === deal.lead_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
