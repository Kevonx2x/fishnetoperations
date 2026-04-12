"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

const REASONS = [
  "Fake listing",
  "Scam",
  "Inappropriate behavior",
  "Spam",
  "Impersonation",
  "Other",
] as const;

type Reason = (typeof REASONS)[number];

export function ReportProfileButton({
  reportedUserId,
  disabled,
}: {
  reportedUserId: string | null | undefined;
  /** When true, hides the control (e.g. own profile). */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("Other");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!reportedUserId?.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reported_user_id: reportedUserId,
          reason,
          notes: notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Could not submit report");
        return;
      }
      toast.success("Report submitted. Thank you.");
      setOpen(false);
      setNotes("");
      setReason("Other");
    } finally {
      setSubmitting(false);
    }
  }, [reportedUserId, reason, notes]);

  if (disabled || !reportedUserId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-gray-400 transition hover:text-gray-500"
      >
        Report
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-profile-title"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="report-profile-title" className="font-serif text-lg font-semibold text-[#2C2C2C]">
                  Report profile
                </h2>
                <p className="mt-1 text-sm text-[#2C2C2C]/55">Tell us what happened. We review every report.</p>
                <label className="mt-4 block text-xs font-semibold text-[#2C2C2C]/55" htmlFor="report-reason">
                  Reason
                </label>
                <select
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as Reason)}
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FAF8F4] px-3 py-2 text-sm font-medium text-[#2C2C2C]"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <label className="mt-4 block text-xs font-semibold text-[#2C2C2C]/55" htmlFor="report-notes">
                  Additional notes (optional)
                </label>
                <textarea
                  id="report-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="mt-1 w-full resize-y rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                  placeholder="Details that help us investigate…"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void onSubmit()}
                    className="rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
