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
  Eye,
  FileText,
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
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        variant === "sage" && "border-[#6B9E6E]/35 bg-[#6B9E6E]/12 text-[#2C2C2C]",
        variant === "neutral" && "border-[#2C2C2C]/12 bg-[#FAF8F4] text-[#2C2C2C]/65",
        variant === "gold" && "border-[#D4A843]/45 bg-[#D4A843]/15 text-[#2C2C2C]",
      )}
    >
      {text}
    </span>
  );
}

function ClientPipelineStepper({ deal }: { deal: PipelineDeal }) {
  const cur = clientPipelineCurrentStepIndex(deal);
  return (
    <div className="mt-6 w-full overflow-x-auto pb-1 font-sans">
      <div className="flex min-w-[280px] items-center">
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
                    "h-0.5 min-w-[4px] flex-1",
                    segmentBeforeGreen ? "bg-[#6B9E6E]" : "bg-[#2C2C2C]/12",
                  )}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-8 shrink-0 flex-col items-center gap-2">
                {done ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#6B9E6E] bg-[#6B9E6E] text-white">
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                  </span>
                ) : active ? (
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2",
                      offerGold ? "border-[#D4A843] bg-[#D4A843]" : "border-[#6B9E6E] bg-[#6B9E6E]",
                    )}
                    aria-hidden
                  />
                ) : (
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2C2C2C]/18 bg-white"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "w-[4.75rem] text-center text-[11px] font-semibold leading-tight tracking-tight",
                    done || active ? "text-[#2C2C2C]" : "text-[#2C2C2C]/40",
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
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#6B9E6E]/12 px-4 py-3 font-sans text-sm leading-snug text-[#2C2C2C]">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
          <span className="min-w-0 font-semibold">{viewingWhenLine}</span>
        </div>
        {deal.property.id ? (
          <Link
            href={`/properties/${encodeURIComponent(deal.property.id)}`}
            className="inline-flex shrink-0 items-center gap-0.5 font-bold text-[#6B9E6E] hover:underline"
          >
            View details <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    );
  }

  if (stage === "lead" && !viewingConfirmed) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#FAF8F4] px-4 py-3 font-sans text-sm leading-relaxed text-[#2C2C2C]/75 ring-1 ring-[#2C2C2C]/08">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
          <span className="min-w-0">We&apos;ve received your inquiry and will get back to you soon.</span>
        </div>
      </div>
    );
  }

  if (stage === "offer") {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#D4A843]/15 px-4 py-3 font-sans text-sm leading-relaxed text-[#2C2C2C]">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
          <span className="min-w-0 font-medium">You have a pending offer. Please review and respond.</span>
        </div>
        {deal.property.id ? (
          <Link
            href={`/properties/${encodeURIComponent(deal.property.id)}`}
            className="inline-flex shrink-0 items-center gap-0.5 font-bold text-[#2C2C2C] hover:underline"
          >
            View offer <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    );
  }

  if (viewingDeclined) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#FAF8F4] px-4 py-3 font-sans text-sm text-[#2C2C2C]/70 ring-1 ring-[#2C2C2C]/08">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/40" aria-hidden />
          <span className="min-w-0">Viewing was declined for this property.</span>
        </div>
      </div>
    );
  }

  if (deal.viewing && !viewingConfirmed) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#FAF8F4] px-4 py-3 font-sans text-sm text-[#2C2C2C]/70 ring-1 ring-[#2C2C2C]/08">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/40" aria-hidden />
          <span className="min-w-0">Viewing — awaiting confirmation from your agent.</span>
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

  return (
    <article
      id={`lead-${deal.lead_id}`}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-[0_2px_14px_rgba(44,44,44,0.07)] transition-shadow",
        highlight && "ring-2 ring-[#D4A843]/60",
      )}
    >
      <div className="pointer-events-none absolute right-4 top-4 z-20 xl:right-6 xl:top-6">
        <div className="pointer-events-auto">
          <StatusPill label={deal.status_label} variant={statusPillVariant} />
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-stretch">
        {/* Thumbnail */}
        <div className="flex shrink-0 justify-center p-4 pb-0 xl:block xl:w-[216px] xl:justify-start xl:p-6 xl:pr-4 xl:pb-6">
          <div className="relative z-0 aspect-square w-full max-w-[200px] overflow-hidden rounded-xl bg-[#2C2C2C]/5 xl:max-w-none">
            {deal.property.hero_image ? (
              <Image
                src={deal.property.hero_image}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1280px) 200px, 200px"
                unoptimized
              />
            ) : (
              <div className="flex h-full min-h-[160px] w-full items-center justify-center font-sans text-xs font-semibold text-[#2C2C2C]/40">
                No photo
              </div>
            )}
            {photosBadge ? (
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full bg-[#2C2C2C]/80 px-2.5 py-1 font-sans text-[11px] font-semibold text-white">
                {photosBadge}
              </div>
            ) : null}
          </div>
        </div>

        {/* Property + progress */}
        <div className="flex min-w-0 flex-1 flex-col border-t border-[#2C2C2C]/08 p-6 pt-5 font-sans xl:border-l xl:border-t-0 xl:pt-6">
          <h2 className="font-serif text-xl font-bold leading-snug text-[#2C2C2C] md:text-2xl">{deal.property.title}</h2>
          <p className="mt-2 font-sans text-base font-bold text-[#D4A843] md:text-lg">
            {formatPipelineCardPrice(deal.property.price)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-sans text-sm font-semibold text-[#2C2C2C]">
            <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E] ring-1 ring-[#2C2C2C]/10">
              {deal.agent.image_url?.trim() && !agentAvatarFailed ? (
                <Image
                  src={deal.agent.image_url}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-cover"
                  unoptimized
                  onError={() => setAgentAvatarFailed(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white">
                  {deal.agent.name?.trim()?.slice(0, 1)?.toUpperCase() || "?"}
                </span>
              )}
            </span>
            <span>{deal.agent.name}</span>
            {deal.agent.verified ? (
              <span className="inline-flex items-center gap-0.5 text-[#6B9E6E]" title="Verified agent">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                <span className="sr-only">Verified</span>
              </span>
            ) : null}
          </div>

          <ClientPipelineStepper deal={deal} />
          <DealStatusBanner deal={deal} />
        </div>

        {/* Your next steps */}
        <div className="flex w-full shrink-0 flex-col border-t border-[#2C2C2C]/08 bg-[#FAF8F4] p-6 font-sans xl:w-[min(100%,260px)] xl:border-l xl:border-t-0 xl:bg-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Your next steps</p>
          <ul className="mt-4 space-y-4 text-sm text-[#2C2C2C]">
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={3} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">Inquiry sent</p>
                <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/50">{formatShortDate(inquiryDate)}</p>
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
            </li>
            {viewingConfirmed ? (
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={3} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">Viewing scheduled</p>
                  <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/50">
                    {formatViewingWhen(deal.viewing!.scheduled_at)}
                  </p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
              </li>
            ) : viewingDeclined ? (
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-xs font-bold text-[#2C2C2C]/35" aria-hidden>
                  ×
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">Viewing declined</p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
              </li>
            ) : deal.viewing ? (
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/35" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">Viewing</p>
                  <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/50">Awaiting confirmation</p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
              </li>
            ) : (
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[#2C2C2C]/18" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight text-[#2C2C2C]/55">Viewing</p>
                  <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/45">Not scheduled yet</p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
              </li>
            )}
            {pendingCount > 0 ? (
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[#D4A843] bg-[#D4A843]/20" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">Documents requested</p>
                  <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/50">{pendingCount} pending</p>
                  <ul className="mt-2 space-y-2 border-l border-[#2C2C2C]/10 pl-3">
                    {pendingDocs.map((d) => (
                      <li key={d.id} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <span className="min-w-0 text-sm">
                          {d.display_label}
                          <span className="text-xs font-semibold text-[#2C2C2C]/45"> (required)</span>
                        </span>
                        <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-[#6B9E6E] bg-[#6B9E6E]/10 px-3 py-1 text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/20">
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
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
              </li>
            ) : deal.documents.some((d) => d.direction === "requested") ? (
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={3} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight">Documents</p>
                  <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/50">Submitted</p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
              </li>
            ) : null}
            <li className="flex items-start gap-3">
              {offerNotStarted ? (
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[#2C2C2C]/18" aria-hidden />
              ) : String(deal.pipeline_stage).toLowerCase() === "offer" ? (
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-[#D4A843] bg-[#D4A843]/25" aria-hidden />
              ) : (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={3} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("font-bold leading-tight", offerNotStarted && "text-[#2C2C2C]/55")}>
                  {offerNotStarted
                    ? "Offer"
                    : String(deal.pipeline_stage).toLowerCase() === "offer"
                      ? "Review offer"
                      : "Offer"}
                </p>
                {!offerNotStarted && String(deal.pipeline_stage).toLowerCase() === "offer" ? (
                  <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/50">Action needed</p>
                ) : offerNotStarted ? (
                  <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/45">Not yet</p>
                ) : null}
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#2C2C2C]/25" aria-hidden />
            </li>
          </ul>
        </div>

        {/* Quick actions */}
        <div className="flex w-full shrink-0 flex-col border-t border-[#2C2C2C]/08 p-6 pb-6 pt-12 font-sans xl:w-[200px] xl:border-l xl:border-t-0 xl:pb-6 xl:pt-14">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Quick actions</p>
          <div className="mt-3 flex w-full flex-col gap-2">
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
                className="w-full justify-center rounded-full border-0 bg-[#6B9E6E] px-5 py-3 text-sm font-bold text-white hover:bg-[#5d8a60]"
              />
            ) : null}
            {deal.property.id ? (
              <Link
                href={`/properties/${encodeURIComponent(deal.property.id)}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#2C2C2C]/15 bg-white px-5 py-3 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4]"
              >
                <Eye className="h-4 w-4 shrink-0 text-[#2C2C2C]/55" aria-hidden />
                View Property
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onToggleDocs}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#2C2C2C]/15 bg-white px-5 py-3 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4]"
            >
              <FileText className="h-4 w-4 shrink-0 text-[#2C2C2C]/55" aria-hidden />
              View Documents
            </button>
          </div>
        </div>
      </div>

      {docsOpen ? (
        <div className="border-t border-[#2C2C2C]/08 bg-[#FAF8F4] px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Documents</p>
          {deal.documents.length === 0 ? (
            <p className="mt-2 font-sans text-sm text-[#2C2C2C]/55">No documents for this deal yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {deal.documents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2C2C2C]/08 bg-white px-3 py-2"
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
        <div className="space-y-5">
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
