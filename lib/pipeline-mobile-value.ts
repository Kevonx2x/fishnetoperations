import { parsePriceToNumber } from "@/lib/format-listing-price";

export type PipelinePropertyPriceInput = {
  price?: string | number | null;
  rent_price?: string | number | null;
  listing_type?: string | null;
  status?: string | null;
};

/** Annualized deal value: sale price, or rent × 12 for rent listings. */
export function propertyPipelineValueNumber(p: PipelinePropertyPriceInput): number {
  const lt = String(p.listing_type ?? "").trim().toLowerCase();
  const status = String(p.status ?? "").trim().toLowerCase();
  const isRent = lt === "rent" || status === "for_rent";
  const raw = isRent ? p.rent_price : p.price;
  const n = parsePriceToNumber(raw ?? null);
  if (n == null || !Number.isFinite(n) || n <= 0) return 0;
  return isRent ? n * 12 : n;
}

/** Format total pipeline value per mobile mockup rules. */
export function formatPipelineTotalValue(sum: number): string {
  if (!Number.isFinite(sum) || sum <= 0) return "—";
  if (sum < 1_000_000) {
    const k = Math.round(sum / 1000);
    return `₱${k.toLocaleString("en-PH")}K`;
  }
  if (sum < 10_000_000) {
    return `₱${(sum / 1_000_000).toFixed(1)}M`;
  }
  return `₱${Math.round(sum / 1_000_000)}M`;
}

export function formatDealPriceLine(p: PipelinePropertyPriceInput): string | null {
  const lt = String(p.listing_type ?? "").trim().toLowerCase();
  const status = String(p.status ?? "").trim().toLowerCase();
  const isRent = lt === "rent" || status === "for_rent";
  const raw = isRent ? p.rent_price : p.price;
  const n = parsePriceToNumber(raw ?? null);
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  try {
    const base = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(n);
    return isRent ? `${base}/mo` : base;
  } catch {
    return isRent ? `₱${Math.round(n).toLocaleString()}/mo` : `₱${Math.round(n).toLocaleString()}`;
  }
}
