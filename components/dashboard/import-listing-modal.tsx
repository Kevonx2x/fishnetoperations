"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import { formatDigitsOnly, formatPriceInputDigits } from "@/lib/validation/listing-form";

export type ImportedListingPayload = {
  title: string | null;
  description: string | null;
  property_type: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area: number | null;
  lot_area: number | null;
  location: string | null;
  images: string[];
  source_url: string | null;
  source_hash: string | null;
};

type ListingsFormSlice = {
  location: string;
  name: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  description: string;
  listingImageUrls: string[];
  property_type: string;
  listing_type: "sale" | "rent";
  developer_name: string;
  turnover_date: string;
  unit_types: string[];
  source_url: string | null;
  source_hash: string | null;
};

function normalizePropertyType(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("presale")) return "Presale";
  if (s.includes("condo") || s.includes("condominium")) return "Condo";
  if (s.includes("townhouse")) return "Townhouse";
  if (s.includes("villa")) return "Villa";
  if (s.includes("apartment")) return "Apartment";
  if (s.includes("studio")) return "Studio";
  if (s.includes("commercial")) return "Commercial";
  if (s.includes("land")) return "Land";
  if (s.includes("house")) return "House";
  return "Condo";
}

function floorAreaToSqftString(area: number | null | undefined): string {
  if (area == null || !Number.isFinite(area) || area <= 0) return "";
  if (area > 300 && area < 100_000) return String(Math.round(area));
  return String(Math.round(area * 10.7639));
}

function buildFormPatch(data: ImportedListingPayload): Partial<ListingsFormSlice> {
  const patch: Partial<ListingsFormSlice> = {
    listingImageUrls: data.images ?? [],
    source_url: data.source_url,
    source_hash: data.source_hash,
  };
  if (data.title?.trim()) patch.name = data.title.trim();
  if (data.description?.trim()) patch.description = data.description.trim();
  if (data.location?.trim()) patch.location = data.location.trim();
  if (data.price != null && Number.isFinite(data.price) && data.price > 0) {
    patch.price = formatPriceInputDigits(String(Math.round(data.price)));
  }
  if (data.bedrooms != null && Number.isFinite(data.bedrooms)) {
    patch.beds = String(Math.max(0, Math.min(20, Math.round(data.bedrooms))));
  }
  if (data.bathrooms != null && Number.isFinite(data.bathrooms)) {
    patch.baths = String(Math.max(0, Math.min(20, Math.round(data.bathrooms))));
  }
  const sqftRaw = floorAreaToSqftString(data.floor_area);
  if (sqftRaw) patch.sqft = formatDigitsOnly(sqftRaw, 6);
  patch.property_type = normalizePropertyType(data.property_type);
  if (patch.property_type === "Presale") patch.listing_type = "sale";
  return patch;
}

export function ImportListingModal({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (patch: Partial<ListingsFormSlice>) => void;
}) {
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setPasteText("");
    }
  }, [open]);

  const runPasteImport = useCallback(async () => {
    const t = pasteText.trim();
    if (t.length < 20) {
      toast.error("Paste at least a few lines of listing text.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/import-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: t }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: ImportedListingPayload;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Analysis failed");
        return;
      }
      if (json.data) {
        const patch = buildFormPatch({ ...json.data, images: [], source_url: null, source_hash: null });
        onApply(patch);
        onClose();
        toast.success("Text analyzed — review and save.");
      }
    } finally {
      setBusy(false);
    }
  }, [pasteText, onApply, onClose]);

  const phaseLabel = busy ? "Analyzing with AI…" : "";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          onClick={() => !busy && onClose()}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]" style={{ fontFamily: "var(--font-serif)" }}>
                Import listing
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-full p-2 text-[#2C2C2C]/50 hover:bg-white disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                Raw listing text
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={busy}
                  rows={10}
                  placeholder="Paste full listing description, price, and location…"
                  className="mt-1 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50"
                />
              </label>
              {busy ? (
                <p className="text-center text-sm font-semibold text-[#6B9E6E]">{phaseLabel}</p>
              ) : null}
              <button
                type="button"
                disabled={busy || pasteText.trim().length < 20}
                onClick={() => void runPasteImport()}
                className="w-full rounded-full bg-[#D4A843] py-3 text-sm font-bold text-[#2C2C2C] shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Working…" : "Analyze with AI"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export type { ListingsFormSlice };
