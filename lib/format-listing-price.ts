/** Parse DB / form values: PostgREST may return numeric as string or number. */
function parsePriceToNumber(raw: string | number | bigint | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "bigint") return Number(raw);
  const s = String(raw).trim();
  if (!s || s === "null" || s === "undefined") return null;
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
  status: "for_sale" | "for_rent",
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
