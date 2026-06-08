/**
 * Display floor area from the `properties.sqft` column.
 * Values are often stored as bare numbers or with an embedded unit (e.g. "110 sqm").
 * Normalizes messy values like "78 sqm sqft" or "78 sqm\nsqft".
 */
export function formatPropertyFloorAreaDisplay(raw: string | null | undefined): string {
  const original = String(raw ?? "").trim();
  if (!original) return "—";

  const normalized = original.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  const numMatch = normalized.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  const num = numMatch?.[1];
  if (!num) return normalized;

  const hasSqm = /\bsqm\b|\bm²\b|\bm2\b/i.test(lower);
  const hasSqft = /\bsqft\b|\bsq\.?\s*ft\b/i.test(lower);

  if (hasSqm) return `${num} sqm`;
  if (hasSqft) return `${num} sqft`;
  return `${num} sqm`;
}

/** Beds · baths · area line for compact listing cards (mobile peek rows). */
export function buildListingBedsBathsAreaLine(options: {
  beds: number;
  baths: number;
  sqft: string | null | undefined;
}): string {
  const bedsLabel = options.beds === 0 ? "Studio" : `${options.beds} bed`;
  const area = formatPropertyFloorAreaDisplay(options.sqft);
  const parts = [bedsLabel, `${options.baths} bath`];
  if (area !== "—") parts.push(area);
  return parts.join(" · ");
}
