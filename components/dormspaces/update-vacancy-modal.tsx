"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";

import { resolveDormspaceBedCounts } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

export type VacancyModalListing = {
  id: string;
  title: string;
  room_type: import("@/lib/dormspaces").DormspaceRoomType;
  total_beds: number | null;
  available_beds: number | null;
  vacancy_notes?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: VacancyModalListing | null;
  onSaved?: () => void;
};

export function UpdateVacancyModal({ open, onOpenChange, listing, onSaved }: Props) {
  const titleId = useId();
  const [available, setAvailable] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    if (!listing) return;
    const { total, available: avail } = resolveDormspaceBedCounts(listing);
    setAvailable(avail);
    setNotes(listing.vacancy_notes?.trim() ?? "");
    setError(null);
  }, [listing]);

  useEffect(() => {
    if (!open || !listing) return;
    reset();
  }, [open, listing, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  if (!open || !listing) return null;

  const { total } = resolveDormspaceBedCounts(listing);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/dormspaces/${listing.id}/vacancy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          available_beds: available,
          vacancy_notes: notes.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { available_beds: number; total_beds: number };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not save changes");
        return;
      }
      const avail = json.data?.available_beds ?? available;
      const tot = json.data?.total_beds ?? total;
      toast.success(`Vacancy updated. ${avail} of ${tot} beds now available.`);
      onSaved?.();
      handleClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[#FAF8F4] shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#2C2C2C]/8 px-5 py-4">
          <h2 id={titleId} className="font-serif text-lg font-bold text-[#2C2C2C]">
            Update vacancy
          </h2>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Property</span>
            <p className="mt-1.5 rounded-xl border border-[#2C2C2C]/10 bg-white/80 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]">
              {listing.title}
            </p>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Total beds</span>
            <p className="mt-1.5 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#484848]">
              {total} {total === 1 ? "bed" : "beds"} (set when listing was created)
            </p>
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Available beds</span>
            <input
              type="number"
              min={0}
              max={total}
              className={inputCls}
              value={available}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setAvailable(Number.isFinite(n) ? Math.min(total, Math.max(0, n)) : 0);
              }}
              required
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              Notes for tenants (optional)
            </span>
            <input
              type="text"
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              placeholder='e.g. "2 beds opening June 15th"'
              maxLength={300}
            />
          </label>

          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="h-10 flex-1 rounded-full bg-[#6B9E6E] px-5 text-sm font-bold text-white disabled:opacity-60 sm:flex-none"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleClose}
              className={cn(
                "h-10 rounded-full border border-[#2C2C2C]/15 px-5 text-sm font-bold text-[#484848]",
              )}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
