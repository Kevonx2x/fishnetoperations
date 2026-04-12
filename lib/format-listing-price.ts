/** Parse DB / form values: PostgREST may return numeric as string or number. */
function parsePriceToNumber(raw: string | number | bigint | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "bigint") return Number(raw);
  const s = String(raw).trim();
  if (!s || s === "null" || s === "undefined") return null;

  const noCommas = s.replace(/,/g, "").trim();
  const lower = noCommas.toLowerCase();
  const million = lower.match(/^[\s]*[^\d]*([\d.]+)\s*m(?:illion)?\b/);
  if (million) {
    const n = Number.parseFloat(million[1]);
    return Number.isFinite(n) ? n * 1_000_000 : null;
  }
  const thousand = lower.match(/^[\s]*[^\d]*([\d.]+)\s*k(?:thousand)?\b/);
  if (thousand) {
    const n = Number.parseFloat(thousand[1]);
    return Number.isFinite(n) ? n * 1_000 : null;
  }

  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Philippine Peso for agent dashboard listing cards.
 * Always uses comma grouping (e.g. ₱30,000, ₱1,500,000).
 */
export function formatListingPricePhp(
  priceRaw: string | number | bigint | null | undefined,
  status: "for_sale" | "for_rent" | "both",
): string {
  const n = parsePriceToNumber(priceRaw);
  if (n === null) {
    const t = String(priceRaw ?? "").trim();
    if (!t) return "—";
    return t.startsWith("₱") ? t : `₱${t}`;
  }
  const rounded = Math.round(n);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(rounded);
  const base = `₱${formatted}`;
  return status === "for_rent" ? `${base}/mo` : base;
}

/** Display any property price with ₱ + comma grouping (en-PH). Preserves non-numeric strings with optional ₱ prefix. */
export function formatPropertyPriceDisplay(
  priceRaw: string | number | bigint | null | undefined,
  status?: "for_sale" | "for_rent" | "sold" | "rented" | "both",
): string {
  const n = parsePriceToNumber(priceRaw);
  if (n === null) {
    const t = String(priceRaw ?? "").trim();
    if (!t) return "—";
    return t.startsWith("₱") ? t : `₱${t}`;
  }
  const rounded = Math.round(n);
  const formatted = new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(rounded);
  const base = `₱${formatted}`;
  if (status === "for_rent" || status === "rented") return `${base}/mo`;
  if (status === "both") return base;
  return base;
}

/** Sale + rent dual listing: two labeled lines for cards/detail. */
export function formatSaleAndRentLines(
  saleRaw: string | number | bigint | null | undefined,
  rentRaw: string | number | bigint | null | undefined,
): { sale: string; rent: string } {
  return {
    sale: formatPropertyPriceDisplay(saleRaw, "for_sale"),
    rent: formatPropertyPriceDisplay(rentRaw, "for_rent"),
  };
}

