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
import { Loader2, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useDataConsentGate } from "@/components/legal/data-consent-modal";

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

type ClientDocRow = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  created_at: string;
  status: string;
};

/** Matches deal_documents columns used in the pipeline panel (no updated_at). */
type DealDocumentRow = {
  id: string;
  lead_id: number;
  agent_id: string | null;
  document_type: string;
  file_url: string;
  file_name: string | null;
  status: string;
  pipeline_stage: string | null;
  notes: string | null;
  sent_to_client?: boolean | null;
  sent_at?: string | null;
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

function sortDealsInStage(a: PipelineLeadRow, b: PipelineLeadRow): number {
  const pa = a.pipeline_position ?? 0;
  const pb = b.pipeline_position ?? 0;
  if (pa !== pb) return pa - pb;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function SortableDealCard({
  deal,
  indexInStage,
  propertyLabel,
  onOpenDocs,
  onOpenMoveModal,
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
  onOpenDocs: (lead: PipelineLeadRow) => void;
  onOpenMoveModal: (lead: PipelineLeadRow) => void;
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

  const otherStages = PIPELINE_STAGES.filter((s) => s.id !== deal.pipeline_stage);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-2xl border border-gray-100 border-l-4 border-l-[#6B9E6E] bg-white p-4 shadow-sm ${
        isDragging ? "scale-105 shadow-xl" : ""
      }`}
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
            </div>
          </div>
          <div
            ref={menuOpen ? menuWrapRef : undefined}
            className="pointer-events-auto relative shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {isHot ? (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-500">
                  🔥 Hot
                </span>
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
                className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
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
          <span className="text-xs text-gray-400">
            Created {new Date(deal.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
        </div>
      </div>

      <div
        className="mt-4 flex gap-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {next && moveLabel ? (
          <button
            type="button"
            onClick={() => {
              onOpenMoveModal(deal);
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
          className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-gray-50"
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
  propertyLabel,
  supabase,
  onRefresh,
  onOpenLeadDetails,
}: {
  leads: PipelineLeadRow[];
  propertyLabel: (propertyId: string | null) => string;
  supabase: SupabaseClient;
  onRefresh: () => void;
  onOpenLeadDetails: (leadId: number) => void;
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

  const [filterStage, setFilterStage] = useState<PipelineStageId>("lead");
  const [docsLead, setDocsLead] = useState<PipelineLeadRow | null>(null);
  const [docRows, setDocRows] = useState<DealDocumentRow[]>([]);
  const [clientDocRows, setClientDocRows] = useState<ClientDocRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [clientDocOpeningId, setClientDocOpeningId] = useState<string | null>(null);
  const [moveLead, setMoveLead] = useState<PipelineLeadRow | null>(null);
  const [moveNote, setMoveNote] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
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
  const [sendDealDocBusyId, setSendDealDocBusyId] = useState<string | null>(null);
  const [viewDealDocBusyId, setViewDealDocBusyId] = useState<string | null>(null);
  const { ensureConsent, dataConsentModal } = useDataConsentGate();
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 2000,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 2000,
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const agentUserId = user?.id;

        const { data: dealData, error: dealErr } = await supabase
          .from("deal_documents")
          .select(
            "id, lead_id, agent_id, document_type, file_url, file_name, status, pipeline_stage, notes, sent_to_client, sent_at",
          )
          .eq("lead_id", lead.id);

        if (dealErr) {
          toast.error(dealErr.message);
          setDocRows([]);
          setClientDocRows([]);
          return;
        }
        setDocRows((dealData ?? []) as DealDocumentRow[]);

        if (!lead.client_id || !agentUserId) {
          setClientDocRows([]);
          return;
        }

        const { data: clientData, error: clientErr } = await supabase
          .from("client_documents")
          .select("id, document_type, file_url, file_name, created_at, status")
          .eq("client_id", lead.client_id)
          .contains("shared_with", [agentUserId]);

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
    [supabase],
  );

  const openDocs = (lead: PipelineLeadRow) => {
    setDocsLead(lead);
    setDocRows([]);
    setClientDocRows([]);
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

  const docStatusFor = (key: string): "missing" | "uploaded" | "approved" => {
    const row = docRows.find((r) => r.document_type === key);
    if (!row) return "missing";
    if (row.status === "approved") return "approved";
    return "uploaded";
  };

  const viewDealDocument = async (doc: DealDocumentRow) => {
    setViewDealDocBusyId(doc.id);
    try {
      const res = await fetch("/api/agent/get-deal-document-url", {
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
      setViewDealDocBusyId(null);
    }
  };

  const replaceDealDocumentAfterConsent = async (
    lead: PipelineLeadRow,
    docKey: string,
    file: File,
    storagePath: string,
  ) => {
    setUploadingKey(docKey);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Sign in required");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("lead_id", String(lead.id));
      formData.append("document_type", docKey);
      formData.append("agent_id", user.id);
      formData.append("file_path", storagePath);

      const res = await fetch("/api/agent/upload-deal-document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Replace failed");
      }

      toast.success("Document replaced successfully");
      await loadDocs(lead);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Replace failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const replaceDealDocument = (
    lead: PipelineLeadRow,
    docKey: string,
    file: File,
    storagePath: string,
  ) => {
    ensureConsent(() => void replaceDealDocumentAfterConsent(lead, docKey, file, storagePath));
  };

  const sendDealDocumentToClient = async (doc: DealDocumentRow) => {
    if (!docsLead) return;
    if (!docsLead.client_id) {
      toast.error("This lead is not linked to a client account yet.");
      return;
    }
    setSendDealDocBusyId(doc.id);
    try {
      const res = await fetch("/api/agent/send-document-to-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deal_document_id: doc.id, lead_id: docsLead.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok) {
        toast.error(json.error ?? "Could not send document");
        return;
      }
      toast.success("Document sent to client");
      await loadDocs(docsLead);
    } finally {
      setSendDealDocBusyId(null);
    }
  };

  const uploadDocAfterConsent = async (lead: PipelineLeadRow, docKey: string, file: File) => {
    setUploadingKey(docKey);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Sign in required");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("lead_id", String(lead.id));
      formData.append("document_type", docKey);
      formData.append("agent_id", user.id);

      const res = await fetch("/api/agent/upload-deal-document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }

      toast.success("Uploaded");
      await loadDocs(lead);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadDoc = (lead: PipelineLeadRow, docKey: string, file: File) => {
    ensureConsent(() => void uploadDocAfterConsent(lead, docKey, file));
  };

  const approveDoc = async (lead: PipelineLeadRow, docKey: string) => {
    const { error } = await supabase
      .from("deal_documents")
      .update({ status: "approved" })
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

  const checklistForLead = docsLead ? PIPELINE_DOC_CHECKLIST[docsLead.pipeline_stage] : [];

  const sortableIds = useMemo(() => displayDeals.map((d) => String(d.id)), [displayDeals]);

  return (
    <div className="space-y-6">
      {dataConsentModal}
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Pipeline</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
          Track deals from lead to close — documents and stage updates in one place.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Pipeline overview</p>
        <div className="-mx-1 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex min-w-[min(100%,520px)] items-center justify-between gap-1 px-1 sm:min-w-0 sm:gap-0">
            {PIPELINE_STAGES.map((s, idx) => {
              const n = counts[s.id];
              const hasCount = n > 0;
              return (
                <div key={s.id} className="flex min-w-0 flex-1 items-center">
                  <div className="flex w-full min-w-[56px] flex-col items-center gap-1.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-white text-sm font-bold shadow-sm ${
                        hasCount ? "border-[#6B9E6E] text-[#6B9E6E]" : "border-gray-300 text-gray-400"
                      }`}
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

      <div className="space-y-3">
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
                  onOpenDocs={openDocs}
                  onOpenMoveModal={(d) => {
                    setMoveLead(d);
                    setMoveNote("");
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
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  {PIPELINE_STAGES.find((x) => x.id === docsLead.pipeline_stage)?.label} stage checklist
                </p>
                {docsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" />
                  </div>
                ) : (
                  <>
                    <ul className="space-y-3">
                      {checklistForLead.map((doc) => {
                        const st = docStatusFor(doc.key);
                        const row = docRows.find((r) => r.document_type === doc.key);
                        const showSendToClient =
                          row &&
                          (row.status === "uploaded" || row.status === "approved") &&
                          (st === "uploaded" || st === "approved");
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
                            <div className="mt-2 flex flex-wrap items-center gap-2">
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
                              {st !== "missing" &&
                              row &&
                              (row.status === "uploaded" || row.status === "approved") ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={viewDealDocBusyId === row.id}
                                    onClick={() => void viewDealDocument(row)}
                                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/80 hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    {viewDealDocBusyId === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : null}
                                    View
                                  </button>
                                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-50">
                                    {uploadingKey === doc.key ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : null}
                                    Replace
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        e.target.value = "";
                                        if (f && row.file_url) {
                                          void replaceDealDocument(docsLead, doc.key, f, row.file_url);
                                        }
                                      }}
                                    />
                                  </label>
                                </>
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
                              {showSendToClient && row ? (
                                row.sent_to_client !== true ? (
                                  <button
                                    type="button"
                                    disabled={sendDealDocBusyId === row.id}
                                    onClick={() => void sendDealDocumentToClient(row)}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#6B9E6E] px-3 py-1 text-xs font-semibold text-[#6B9E6E] hover:bg-[#6B9E6E]/10 disabled:opacity-50"
                                  >
                                    {sendDealDocBusyId === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : null}
                                    Send to Client
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">✓ Sent to client</span>
                                )
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

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
                        {clientDocRows.map((cd) => (
                          <li
                            key={cd.id}
                            className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-[#2C2C2C]">
                                {labelSharedClientDocType(cd.document_type)}
                              </p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  cd.status === "shared"
                                    ? "bg-emerald-100 text-emerald-900"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {cd.status === "shared" ? "Shared" : cd.status}
                              </span>
                            </div>
                            {cd.file_name ? (
                              <p className="mt-1 truncate text-xs font-medium text-[#2C2C2C]/60">
                                {cd.file_name}
                              </p>
                            ) : null}
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
                        ))}
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
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
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
