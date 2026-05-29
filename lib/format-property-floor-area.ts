/**
 * Display floor area from the `properties.sqft` column.
 * Values are often stored as bare numbers or with an embedded unit (e.g. "110 sqm").
 */
export function formatPropertyFloorAreaDisplay(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return "—";

  const lower = t.toLowerCase();
  const numMatch = t.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  const num = numMatch?.[1];
  if (!num) return t;

  if (/\bsqft\b|\bsq\.?\s*ft\b/i.test(lower)) return `${num} sqft`;
  if (/\bsqm\b|\bm²\b|\bm2\b/i.test(lower)) return `${num} sqm`;

  return `${num} sqm`;
}
