export type SortMode = "newest" | "price_asc" | "price_desc" | "beds_desc";

/**
 * Parses display prices like:
 * - "₱52M+"
 * - "₱90M-"
 * - "₱125,000,000"
 * - "52000000"
 */
export function parsePriceValue(price: string): number {
  const raw = typeof price === "string" ? price : "";
  const t = raw.replace(/\s/g, "").replace(/₱/g, "").toUpperCase();
  const cleaned = t.replace(/[+\-]/g, "");

  const hasM = cleaned.includes("M");
  const hasB = cleaned.includes("B");
  const hasK = cleaned.includes("K");

  if (hasB || hasM || hasK) {
    const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
    const base = Number.isFinite(num) ? num : 0;
    if (hasB) return base * 1_000_000_000;
    if (hasM) return base * 1_000_000;
    return base * 1_000;
  }

  const digits = parseInt(cleaned.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(digits) ? digits : 0;
}

export function sortProperties<T extends { created_at: string; price: string; beds: number }>(
  list: T[],
  mode: SortMode,
): T[] {
  const toTime = (iso: string) => {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : 0;
  };

  const cmpNewest = (a: T, b: T) => toTime(b.created_at) - toTime(a.created_at);
  const cmpPriceAsc = (a: T, b: T) => {
    const d = parsePriceValue(a.price) - parsePriceValue(b.price);
    return d !== 0 ? d : cmpNewest(a, b);
  };
  const cmpPriceDesc = (a: T, b: T) => {
    const d = parsePriceValue(b.price) - parsePriceValue(a.price);
    return d !== 0 ? d : cmpNewest(a, b);
  };
  const cmpBedsDesc = (a: T, b: T) => {
    const d = b.beds - a.beds;
    return d !== 0 ? d : cmpNewest(a, b);
  };

  const out = [...list];
  if (mode === "price_asc") return out.sort(cmpPriceAsc);
  if (mode === "price_desc") return out.sort(cmpPriceDesc);
  if (mode === "beds_desc") return out.sort(cmpBedsDesc);
  return out.sort(cmpNewest);
}

function normalizeType(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferTypeFromLocation(location: string): string {
  const t = normalizeType(location);
  if (/\b(condo|minium|tower|rockwell|residence|residences)\b/.test(t)) return "condo";
  if (/\b(villa|village|hills)\b/.test(t)) return "villa";
  if (/\b(townhouse)\b/.test(t)) return "townhouse";
  if (/\b(land|lot)\b/.test(t)) return "land";
  return "house";
}

function canonicalType(v: string): string {
  const t = normalizeType(v);
  if (!t) return "";
  if (t === "any" || t === "all") return "";
  if (t.includes("condo") || t.includes("condominium") || t.includes("apartment")) return "condo";
  if (t.includes("villa")) return "villa";
  if (t.includes("townhouse") || t === "town house") return "townhouse";
  if (t.includes("land") || t.includes("lot")) return "land";
  if (t.includes("house") || t.includes("home")) return "house";
  return t.replace(/\s+/g, "");
}

/**
 * Matches a user-selected type against the DB `property_type` (or inferred from location if null).
 */
export function matchesPropertyTypeDb(
  location: string,
  propertyTypeDb: string | null,
  selectedType: string | null,
): boolean {
  if (!selectedType?.trim()) return true;
  const want = canonicalType(selectedType);
  if (!want) return true;

  const have = propertyTypeDb?.trim()
    ? canonicalType(propertyTypeDb)
    : inferTypeFromLocation(location);

  return have === want;
}

