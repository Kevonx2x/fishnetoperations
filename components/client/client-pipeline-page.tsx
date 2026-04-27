"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { StartChatButton } from "@/components/chat/start-chat-button";
import { useAuth } from "@/contexts/auth-context";
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

function StatusPill({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full border border-[#6B9E6E]/35 bg-[#6B9E6E]/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2C2C2C]">
      {label}
    </span>
  );
}

function DealCard({
  deal,
  clientUserId,
  expanded,
  onToggleExpand,
  docsOpen,
  onToggleDocs,
  onUploaded,
  highlight,
}: {
  deal: PipelineDeal;
  clientUserId: string;
  expanded: boolean;
  onToggleExpand: () => void;
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

  const offerNotStarted = !["offer", "reservation", "closed"].includes(deal.pipeline_stage);

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
        "overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm transition-shadow",
        highlight && "ring-2 ring-[#D4A843]/60",
      )}
    >
      <div className="flex gap-3 p-4">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#2C2C2C]/5">
          {deal.property.hero_image ? (
            <Image
              src={deal.property.hero_image}
              alt=""
              fill
              className="object-cover"
              sizes="96px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#888888]">
              No photo
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-serif text-lg font-bold leading-snug text-[#2C2C2C]">
              {deal.property.title}
            </h2>
            <StatusPill label={deal.status_label} />
          </div>
          <p className="mt-1 text-sm font-bold text-[#D4A843]">{deal.property.price}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#2C2C2C]">
            <span className="relative inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E] ring-1 ring-black/10">
              {deal.agent.image_url?.trim() && !agentAvatarFailed ? (
                <Image
                  src={deal.agent.image_url}
                  alt=""
                  fill
                  sizes="28px"
                  className="object-cover"
                  unoptimized
                  onError={() => {
                    console.error("Agent avatar failed to load", {
                      user_id: deal.agent.user_id,
                      url: deal.agent.image_url,
                    });
                    setAgentAvatarFailed(true);
                  }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white">
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
          </p>
        </div>
      </div>

      <div className="border-t border-[#2C2C2C]/8 px-4 py-3">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#888888]">Timeline</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-[#2C2C2C]/50" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-[#2C2C2C]/50" />
          )}
        </button>
        {expanded ? (
          <ul className="mt-3 space-y-2.5 text-sm">
            <li className="flex gap-2">
              <span className="text-[#6B9E6E]" aria-hidden>
                ✅
              </span>
              <span className="text-[#2C2C2C]">
                Inquiry sent — {formatShortDate(inquiryDate)}
              </span>
            </li>
            {viewingConfirmed ? (
              <li className="flex gap-2">
                <span className="text-[#6B9E6E]" aria-hidden>
                  ✅
                </span>
                <span className="text-[#2C2C2C]">
                  Viewing scheduled — {formatViewingWhen(deal.viewing!.scheduled_at)}
                </span>
              </li>
            ) : viewingDeclined ? (
              <li className="flex gap-2">
                <span className="text-[#888888]" aria-hidden>
                  ⛔
                </span>
                <span className="text-[#2C2C2C]">Viewing declined</span>
              </li>
            ) : deal.viewing ? (
              <li className="flex gap-2">
                <span className="text-[#888888]" aria-hidden>
                  ⏳
                </span>
                <span className="text-[#2C2C2C]">Viewing — awaiting confirmation</span>
              </li>
            ) : (
              <li className="flex gap-2">
                <span className="text-[#888888]" aria-hidden>
                  ⏳
                </span>
                <span className="text-[#2C2C2C]">Viewing — not scheduled yet</span>
              </li>
            )}
            {pendingCount > 0 ? (
              <li className="flex gap-2">
                <span className="text-[#D4A843]" aria-hidden>
                  ⏳
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-[#2C2C2C]">
                    Documents requested by agent — {pendingCount} pending
                  </span>
                  <ul className="mt-2 space-y-2 border-l border-[#2C2C2C]/10 pl-3">
                    {pendingDocs.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2 text-[#2C2C2C]">
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="text-[#888888]">├</span> {d.display_label}
                          <span className="text-xs font-semibold text-[#888888]"> (required)</span>
                        </span>
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#6B9E6E] bg-[#6B9E6E]/10 px-3 py-1 text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/20">
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
              </li>
            ) : deal.documents.some((d) => d.direction === "requested") ? (
              <li className="flex gap-2">
                <span className="text-[#6B9E6E]" aria-hidden>
                  ✅
                </span>
                <span className="text-[#2C2C2C]">Requested documents — submitted</span>
              </li>
            ) : null}
            <li className="flex gap-2">
              <span className={offerNotStarted ? "text-[#888888]" : "text-[#6B9E6E]"} aria-hidden>
                {offerNotStarted ? "⚪" : "✅"}
              </span>
              <span className={cn("text-[#2C2C2C]", offerNotStarted && "text-[#888888]")}>
                {offerNotStarted
                  ? "Offer (not yet)"
                  : deal.pipeline_stage === "offer"
                    ? "Offer in progress"
                    : "Offer"}
              </span>
            </li>
          </ul>
        ) : null}
      </div>

      {docsOpen ? (
        <div className="border-t border-[#2C2C2C]/8 bg-[#FAF8F4] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#888888]">Documents</p>
          {deal.documents.length === 0 ? (
            <p className="mt-2 text-sm text-[#2C2C2C]/55">No documents for this deal yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {deal.documents.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2C2C2C]/8 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2C2C2C]">{d.display_label}</p>
                    <p className="text-xs text-[#888888]">
                      {d.pending_upload ? "Awaiting upload" : d.status ?? "—"}
                    </p>
                  </div>
                  {!d.pending_upload && d.file_url ? (
                    <button
                      type="button"
                      disabled={openingId === d.id}
                      onClick={() => void openDoc(d.id, d.file_url)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#6B9E6E] px-3 py-1 text-xs font-bold text-[#6B9E6E] hover:bg-[#6B9E6E]/10 disabled:opacity-50"
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

      <div className="flex flex-wrap gap-2 border-t border-[#2C2C2C]/8 bg-white px-4 py-3">
        {deal.agent.user_id ? (
          <StartChatButton
            agentId={deal.agent.user_id}
            clientId={clientUserId}
            label="Message Agent"
            className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white hover:bg-[#5a8a5d]"
          />
        ) : null}
        {deal.property.id ? (
          <Link
            href={`/properties/${encodeURIComponent(deal.property.id)}`}
            className="inline-flex items-center justify-center rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-xs font-bold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
          >
            View Property
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onToggleDocs}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4A843]/50 bg-[#D4A843]/10 px-4 py-2 text-xs font-bold text-[#2C2C2C] hover:bg-[#D4A843]/20"
        >
          <FileText className="h-3.5 w-3.5 text-[#D4A843]" />
          View All Documents
        </button>
      </div>
    </article>
  );
}

/** Pipeline deals UI; use inside client dashboard layout (or any shell that already authenticates). */
export function ClientPipelineInner() {
  const searchParams = useSearchParams();
  const { user, role, loading: authLoading } = useAuth();

  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
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
    <div className="w-full max-w-2xl font-sans text-[#2C2C2C]">
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
              expanded={expanded[deal.lead_id] ?? false}
              onToggleExpand={() =>
                setExpanded((s) => ({ ...s, [deal.lead_id]: !(s[deal.lead_id] ?? false) }))
              }
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
