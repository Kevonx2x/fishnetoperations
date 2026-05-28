"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { MobileSheetPortal } from "@/components/mobile/mobile-sheet-portal";
import type { PipelineLeadRow } from "@/components/dashboard/agent-pipeline-tab";
import {
  CLIENT_DOC_REQUEST_OPTIONS,
  DECLINE_REASON_OPTIONS,
  defaultClientDocSelections,
  type ClientDocRequestKey,
  type DeclineReasonKey,
} from "@/lib/agent-pipeline-card-menu";
import { manilaLocalDateTimeToOffsetIso, normalizeTimeHmForInput } from "@/lib/manila-datetime";

export function PipelineMobileDeclineSheet({
  deal,
  open,
  busy,
  onClose,
  onConfirm,
}: {
  deal: PipelineLeadRow | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reasonKey: DeclineReasonKey) => void;
}) {
  const [reasonKey, setReasonKey] = useState<DeclineReasonKey>("unavailable");

  useEffect(() => {
    if (open) setReasonKey("unavailable");
  }, [open, deal?.id]);

  return (
    <MobileSheetPortal>
      <AnimatePresence>
        {open && deal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4"
            onClick={() => !busy && onClose()}
          >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2C2C2C]/15" aria-hidden />
              <p className="font-sans text-lg font-semibold text-[#2C2C2C]">Decline this deal?</p>
              <p className="mt-2 text-sm text-[#888888]">
                This will notify {deal.name.trim() || "the client"} that you are no longer pursuing this
                inquiry.
              </p>
              <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#AAAAAA]">
                Reason
                <select
                  value={reasonKey}
                  onChange={(e) => setReasonKey(e.target.value as DeclineReasonKey)}
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C]"
                >
                  {DECLINE_REASON_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="shrink-0 border-t border-[#2C2C2C]/8 p-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onConfirm(reasonKey)}
                  className="min-h-12 flex-1 rounded-full bg-[#2C2C2C] text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "…" : "Send Decline & Archive"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="min-h-12 flex-1 rounded-full border border-[#2C2C2C]/15 text-sm font-semibold text-[#888888]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </MobileSheetPortal>
  );
}

export function PipelineMobileRequestDocsSheet({
  deal,
  open,
  busy,
  onClose,
  onSend,
}: {
  deal: PipelineLeadRow | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSend: (
    selections: Record<ClientDocRequestKey, boolean>,
    otherName: string,
  ) => void;
}) {
  const [selections, setSelections] = useState(defaultClientDocSelections);
  const [otherName, setOtherName] = useState("");

  useEffect(() => {
    if (open) {
      setSelections(defaultClientDocSelections());
      setOtherName("");
    }
  }, [open, deal?.id]);

  return (
    <MobileSheetPortal>
      <AnimatePresence>
        {open && deal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4"
            onClick={() => !busy && onClose()}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2C2C2C]/15" aria-hidden />
                <p className="font-sans text-lg font-semibold text-[#2C2C2C]">
                  Request documents from {deal.name}
                </p>
              <div className="mt-4 space-y-3">
                {CLIENT_DOC_REQUEST_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex min-h-12 cursor-pointer items-center gap-3 text-sm font-medium text-[#2C2C2C]"
                  >
                    <input
                      type="checkbox"
                      checked={selections[opt.key]}
                      onChange={(e) =>
                        setSelections((s) => ({ ...s, [opt.key]: e.target.checked }))
                      }
                      className="size-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
                    />
                    {opt.label}
                  </label>
                ))}
                {selections.other ? (
                  <input
                    type="text"
                    value={otherName}
                    onChange={(e) => setOtherName(e.target.value)}
                    placeholder="Document name (required)"
                    className="w-full rounded-xl border border-[#2C2C2C]/15 px-3 py-2.5 text-sm"
                  />
                ) : null}
              </div>
            </div>
            <div className="shrink-0 border-t border-[#2C2C2C]/8 p-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="min-h-12 rounded-full px-4 text-sm font-semibold text-[#888888]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSend(selections, otherName)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#6B9E6E] px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Send Request
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MobileSheetPortal>
  );
}

export function PipelineMobileViewingConfirmSheet({
  lead,
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  lead: PipelineLeadRow | null;
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (dateYmd: string, timeHm: string, notes: string) => void;
}) {
  const [dateYmd, setDateYmd] = useState("");
  const [timeHm, setTimeHm] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDateYmd("");
      setTimeHm("");
      setNotes("");
    }
  }, [open, lead?.id]);

  return (
    <MobileSheetPortal>
      <AnimatePresence>
        {open && lead ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4"
            onClick={() => !busy && onClose()}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2C2C2C]/15" aria-hidden />
                <p className="font-sans text-lg font-semibold text-[#2C2C2C]">Schedule viewing</p>
              <p className="mt-1 text-sm text-[#888888]">Confirm date and time for {lead.name}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-[#AAAAAA]">
                  Date
                  <input
                    type="date"
                    value={dateYmd}
                    onChange={(e) => setDateYmd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#AAAAAA]">
                  Time
                  <input
                    type="time"
                    value={timeHm}
                    onChange={(e) => setTimeHm(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-[#AAAAAA]">
                Notes (optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={300}
                  className="mt-1 w-full resize-none rounded-xl border border-[#2C2C2C]/15 px-3 py-2 text-sm"
                />
              </label>
              {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
            </div>
            <div className="shrink-0 border-t border-[#2C2C2C]/8 p-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onConfirm(dateYmd, timeHm, notes)}
                  className="min-h-12 flex-1 rounded-full bg-[#6B9E6E] text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "…" : "Confirm viewing"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="min-h-12 flex-1 rounded-full border border-[#2C2C2C]/15 text-sm font-semibold text-[#888888]"
                >
                  Cancel
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MobileSheetPortal>
  );
}

export async function confirmViewingForLead(
  leadId: number,
  dateYmd: string,
  timeHm: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = normalizeTimeHmForInput(timeHm.trim());
  if (!dateYmd.trim() || !normalized) {
    return { ok: false, message: "Choose a date and time." };
  }
  let scheduledIso: string;
  try {
    scheduledIso = manilaLocalDateTimeToOffsetIso(dateYmd.trim(), normalized);
  } catch {
    return { ok: false, message: "Choose a date and time." };
  }
  if (new Date(scheduledIso).getTime() < Date.now()) {
    return { ok: false, message: "Pick a future date and time." };
  }

  let res: Response;
  try {
    res = await fetch("/api/agent/pipeline-confirm-viewing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        leadId,
        date: dateYmd.trim(),
        time: normalized,
        notes: notes.trim() ? notes.trim().slice(0, 300) : null,
      }),
    });
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection and try again." };
  }
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { success?: boolean };
    message?: string;
    error?: string | { message?: string; code?: string };
  };
  const apiOk = res.ok && json.success === true && json.data?.success === true;
  if (!apiOk) {
    const msg =
      typeof json.message === "string" && json.message.trim()
        ? json.message.trim()
        : json?.error && typeof json.error === "object" && "message" in json.error
          ? String((json.error as { message?: string }).message)
          : typeof json?.error === "string"
            ? json.error
            : "Could not confirm viewing";
    return { ok: false, message: msg };
  }
  return { ok: true };
}
