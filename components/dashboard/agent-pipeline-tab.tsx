"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";

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
  pipeline_stage: PipelineStageId;
  property_id: string | null;
  created_at: string;
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

function stageBadgeClass(stage: PipelineStageId): string {
  switch (stage) {
    case "lead":
      return "bg-[#2C2C2C]/10 text-[#2C2C2C]/80";
    case "viewing":
      return "bg-blue-100 text-blue-900";
    case "offer":
      return "bg-[#D4A843]/25 text-[#8a6d32]";
    case "reservation":
      return "bg-purple-100 text-purple-900";
    case "closed":
      return "bg-[#6B9E6E]/20 text-[#2d5a30]";
    default:
      return "bg-[#2C2C2C]/10 text-[#2C2C2C]/80";
  }
}

function normalizeStage(raw: string | null | undefined): PipelineStageId {
  const s = (raw ?? "lead").trim().toLowerCase();
  if (STAGE_ORDER.includes(s as PipelineStageId)) return s as PipelineStageId;
  return "lead";
}

export function AgentPipelineTab({
  leads,
  propertyLabel,
  supabase,
  onRefresh,
}: {
  leads: PipelineLeadRow[];
  propertyLabel: (propertyId: string | null) => string;
  supabase: SupabaseClient;
  onRefresh: () => void;
}) {
  const deals = useMemo(
    () =>
      leads.map((l) => ({
        ...l,
        pipeline_stage: normalizeStage(l.pipeline_stage as string),
      })),
    [leads],
  );

  const [filterStage, setFilterStage] = useState<PipelineStageId>("lead");
  const [docsLead, setDocsLead] = useState<PipelineLeadRow | null>(null);
  const [docRows, setDocRows] = useState<
    { document_type: string; status: string; file_url: string }[]
  >([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [moveLead, setMoveLead] = useState<PipelineLeadRow | null>(null);
  const [moveNote, setMoveNote] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

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

  const filtered = useMemo(
    () => deals.filter((d) => d.pipeline_stage === filterStage),
    [deals, filterStage],
  );

  const loadDocs = useCallback(
    async (lead: PipelineLeadRow) => {
      setDocsLoading(true);
      const { data, error } = await supabase
        .from("deal_documents")
        .select("document_type, status, file_url")
        .eq("lead_id", lead.id);
      setDocsLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setDocRows((data ?? []) as { document_type: string; status: string; file_url: string }[]);
    },
    [supabase],
  );

  const openDocs = (lead: PipelineLeadRow) => {
    setDocsLead(lead);
    setDocRows([]);
    void loadDocs(lead);
  };

  const docStatusFor = (key: string): "missing" | "uploaded" | "approved" => {
    const row = docRows.find((r) => r.document_type === key);
    if (!row) return "missing";
    if (row.status === "approved") return "approved";
    return "uploaded";
  };

  const uploadDoc = async (lead: PipelineLeadRow, docKey: string, file: File) => {
    const ext = file.name.split(".").pop() || "pdf";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "pdf";
    const path = `${lead.id}/${docKey}.${safeExt}`;
    setUploadingKey(docKey);
    try {
      const { error: upErr } = await supabase.storage.from("deals").upload(path, file, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { error: rowErr } = await supabase.from("deal_documents").upsert(
        {
          lead_id: lead.id,
          document_type: docKey,
          status: "uploaded",
          file_url: path,
        },
        { onConflict: "lead_id,document_type" },
      );
      if (rowErr) {
        toast.error(rowErr.message);
        return;
      }
      toast.success("Uploaded");
      await loadDocs(lead);
      onRefresh();
    } finally {
      setUploadingKey(null);
    }
  };

  const approveDoc = async (lead: PipelineLeadRow, docKey: string) => {
    const { error } = await supabase
      .from("deal_documents")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("lead_id", lead.id)
      .eq("document_type", docKey);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked approved");
    await loadDocs(lead);
    onRefresh();
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

  const checklistForLead = docsLead ? PIPELINE_DOC_CHECKLIST[docsLead.pipeline_stage] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Pipeline</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
          Track deals from lead to close — documents and stage updates in one place.
        </p>
      </div>

      {/* Pipeline overview */}
      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-[#2C2C2C] p-4 shadow-inner ring-1 ring-white/10">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Pipeline overview</p>
        <div className="-mx-1 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex min-w-[min(100%,520px)] items-center justify-between gap-1 px-1 sm:min-w-0 sm:gap-0">
            {PIPELINE_STAGES.map((s, idx) => (
              <div key={s.id} className="flex min-w-0 flex-1 items-center">
                <div className="flex w-full min-w-[56px] flex-col items-center gap-1.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#6B9E6E]/80 bg-[#6B9E6E]/20 text-sm font-bold text-[#6B9E6E] shadow-sm ring-2 ring-[#D4A843]/20">
                    {counts[s.id]}
                  </div>
                  <span className="text-center text-[10px] font-bold text-white/85 sm:text-[11px]">{s.label}</span>
                </div>
                {idx < PIPELINE_STAGES.length - 1 ? (
                  <div
                    className="mx-0.5 h-0.5 min-w-[8px] flex-1 bg-gradient-to-r from-[#6B9E6E]/50 to-[#D4A843]/40 sm:min-w-[12px]"
                    aria-hidden
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-[9px] font-semibold text-[#6B9E6E]/90">
          Lead → Viewing → Offer → Reservation → Closed
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {PIPELINE_STAGES.map((s) => {
          const active = filterStage === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilterStage(s.id)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
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

      {/* Deals list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center text-sm font-semibold text-[#2C2C2C]/45">
            No deals at this stage.
          </p>
        ) : (
          filtered.map((deal) => {
            const next = nextStage(deal.pipeline_stage);
            const propLine = propertyLabel(deal.property_id);
            return (
              <div
                key={deal.id}
                className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#2C2C2C]">{deal.name}</p>
                    <p className="truncate text-sm text-[#2C2C2C]/55">{deal.email}</p>
                    {deal.property_id ? (
                      <Link
                        href={`/properties/${deal.property_id}`}
                        className="mt-1 inline-block text-sm font-semibold text-[#6B9E6E] underline-offset-2 hover:underline"
                      >
                        {propLine}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-[#2C2C2C]/65">{propLine}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stageBadgeClass(deal.pipeline_stage)}`}
                      >
                        {
                          PIPELINE_STAGES.find((x) => x.id === deal.pipeline_stage)?.label ??
                          deal.pipeline_stage
                        }
                      </span>
                      <span className="text-xs font-medium text-[#2C2C2C]/45">
                        Created {new Date(deal.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {next ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMoveLead(deal);
                          setMoveNote("");
                        }}
                        className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#5a8a5d]"
                      >
                        Move to next stage
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openDocs(deal)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View Documents
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Move modal */}
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

      {/* Documents panel */}
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
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  {PIPELINE_STAGES.find((x) => x.id === docsLead.pipeline_stage)?.label} stage checklist
                </p>
                {docsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" />
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {checklistForLead.map((doc) => {
                      const st = docStatusFor(doc.key);
                      return (
                        <li
                          key={doc.key}
                          className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-[#2C2C2C]">{doc.label}</p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                st === "missing"
                                  ? "bg-red-100 text-red-800"
                                  : st === "uploaded"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-emerald-100 text-emerald-900"
                              }`}
                            >
                              {st === "missing" ? "Missing" : st === "uploaded" ? "Uploaded" : "Approved"}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {st === "missing" ? (
                              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#6B9E6E] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#5a8a5d]">
                                {uploadingKey === doc.key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Upload
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) void uploadDoc(docsLead, doc.key, f);
                                  }}
                                />
                              </label>
                            ) : null}
                            {st === "uploaded" ? (
                              <button
                                type="button"
                                onClick={() => void approveDoc(docsLead, doc.key)}
                                className="rounded-full border border-[#2C2C2C]/15 bg-white px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
                              >
                                Mark approved
                              </button>
                            ) : null}
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
    </div>
  );
}
