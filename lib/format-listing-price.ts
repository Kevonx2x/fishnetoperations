/** Philippine Peso display for dashboard listing cards. */
export function formatListingPricePhp(priceRaw: string, status: "for_sale" | "for_rent"): string {
  const digits = String(priceRaw).replace(/[^\d.]/g, "");
  const n = Number.parseFloat(digits);
  if (!Number.isFinite(n)) {
    const trimmed = String(priceRaw).trim();
    return trimmed.startsWith("₱") ? trimmed : `₱${trimmed}`;
  }
  const formatted = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(n);
  const base = `₱${formatted}`;
  return status === "for_rent" ? `${base}/mo` : base;
}
