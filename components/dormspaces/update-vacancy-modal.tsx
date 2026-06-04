"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";

import { resolveDormspaceGenderBedCounts } from "@/lib/dormspace-gender-beds";
import type { DormspaceRoomType } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

export type VacancyModalListing = {
  id: string;
  title: string;
  room_type: DormspaceRoomType;
  male_beds_total: number | null;
  male_beds_available: number | null;
  female_beds_total: number | null;
  female_beds_available: number | null;
  total_beds?: number | null;
  available_beds?: number | null;
  vacancy_notes?: string | null;
  hidden_from_browse?: boolean | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: VacancyModalListing | null;
  onSaved?: () => void;
};

export function UpdateVacancyModal({ open, onOpenChange, listing, onSaved }: Props) {
  const titleId = useId();
  const [maleAvail, setMaleAvail] = useState(0);
  const [femaleAvail, setFemaleAvail] = useState(0);
  const [notes, setNotes] = useState("");
  const [hiddenFromBrowse, setHiddenFromBrowse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    if (!listing) return;
    const counts = resolveDormspaceGenderBedCounts(listing);
    setMaleAvail(counts.maleAvailable);
    setFemaleAvail(counts.femaleAvailable);
    setNotes(listing.vacancy_notes?.trim() ?? "");
    setHiddenFromBrowse(Boolean(listing.hidden_from_browse));
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

  const counts = resolveDormspaceGenderBedCounts(listing);
  const hasMale = counts.maleTotal > 0;
  const hasFemale = counts.femaleTotal > 0;

  const handleClose = () => onOpenChange(false);

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
          male_beds_available: hasMale ? maleAvail : undefined,
          female_beds_available: hasFemale ? femaleAvail : undefined,
          vacancy_notes: notes.trim() || null,
          hidden_from_browse: hiddenFromBrowse,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          male_beds_available: number;
          female_beds_available: number;
        };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not save changes");
        return;
      }
      toast.success("Vacancy updated.");
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
            Update beds & visibility
          </h2>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="overflow-y-auto px-5 py-4">
          <p className="text-sm font-semibold text-[#2C2C2C]">{listing.title}</p>
          <p className="mt-1 text-xs text-[#888888]">
            Set how many beds are open. Full sides stay on your dashboard but won&apos;t show on the homepage.
          </p>

          {hasMale ? (
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Male beds available (of {counts.maleTotal})
              </span>
              <input
                type="number"
                min={0}
                max={counts.maleTotal}
                className={inputCls}
                value={maleAvail}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setMaleAvail(
                    Number.isFinite(n) ? Math.min(counts.maleTotal, Math.max(0, n)) : 0,
                  );
                }}
                required
              />
            </label>
          ) : null}

          {hasFemale ? (
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Female beds available (of {counts.femaleTotal})
              </span>
              <input
                type="number"
                min={0}
                max={counts.femaleTotal}
                className={inputCls}
                value={femaleAvail}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setFemaleAvail(
                    Number.isFinite(n) ? Math.min(counts.femaleTotal, Math.max(0, n)) : 0,
                  );
                }}
                required
              />
            </label>
          ) : null}

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              Notes for tenants (optional)
            </span>
            <input
              type="text"
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              placeholder='e.g. "2 male beds opening June 15th"'
              maxLength={300}
            />
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-3">
            <input
              type="checkbox"
              checked={hiddenFromBrowse}
              onChange={(e) => setHiddenFromBrowse(e.target.checked)}
              className="mt-0.5 size-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
            />
            <span className="text-sm font-medium text-[#2C2C2C]">
              Hide from homepage browse
              <span className="mt-0.5 block text-xs font-normal text-[#888888]">
                Still visible in your landlord listings. Use anytime — not only when full.
              </span>
            </span>
          </label>

          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="h-10 flex-1 rounded-full bg-[#6B9E6E] px-5 text-sm font-bold text-white disabled:opacity-60 sm:flex-none"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleClose}
              className="h-10 rounded-full border border-[#2C2C2C]/15 px-5 text-sm font-bold text-[#484848]"
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
