/**
 * Canonical Philippine city labels for marketplace grouping (`properties.city`)
 * and Featured Locations counts. Full `location` stays the display address.
 */

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Lowercase, trim, strip punctuation to spaces, collapse whitespace. */
function normalizeForMatch(raw: string): string {
  const t = stripDiacritics(raw)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `pattern` appears as a whole phrase in normalized `haystack` (space-separated words). */
function phraseMatches(haystack: string, pattern: string): boolean {
  const p = normalizeForMatch(pattern);
  if (!p) return false;
  const parts = p.split(/\s+/).map(escapeRegExp);
  const re = new RegExp(`(^|\\s)${parts.join("\\s+")}(\\s|$)`, "i");
  return re.test(haystack);
}

/**
 * Ordered: longer / more specific patterns first so e.g. "ortigas center" wins before "pasig"
 * when both could appear in one address.
 */
const CANONICAL_RULES: { canonical: string; patterns: string[] }[] = [
  {
    canonical: "BGC",
    patterns: [
      "bonifacio global city",
      "bgc taguig",
      "fort bonifacio",
      "bgc",
    ],
  },
  {
    canonical: "Makati",
    patterns: ["makati cbd", "makati city", "makati"],
  },
  {
    canonical: "Ortigas",
    patterns: ["ortigas center", "ortigas pasig", "ortigas"],
  },
  {
    canonical: "Quezon City",
    patterns: ["quezon city", "qc"],
  },
  {
    canonical: "Alabang",
    patterns: ["muntinlupa alabang", "alabang"],
  },
  {
    canonical: "Cebu City",
    patterns: ["cebu city", "cebu"],
  },
  {
    canonical: "Las Piñas",
    patterns: ["las pinas", "las piñas", "laspiñas"],
  },
  {
    canonical: "Parañaque",
    patterns: ["parañaque", "paranaque"],
  },
  { canonical: "Davao", patterns: ["davao city", "davao"] },
  { canonical: "Tagaytay", patterns: ["tagaytay"] },
  { canonical: "Pasig", patterns: ["pasig"] },
  { canonical: "Mandaluyong", patterns: ["mandaluyong"] },
  { canonical: "Pasay", patterns: ["pasay"] },
  { canonical: "Antipolo", patterns: ["antipolo"] },
  { canonical: "Batangas", patterns: ["batangas"] },
  { canonical: "Iloilo", patterns: ["iloilo"] },
  { canonical: "Bacolod", patterns: ["bacolod"] },
];

const FLAT_RULES: { canonical: string; pattern: string }[] = [];
for (const r of CANONICAL_RULES) {
  for (const p of r.patterns) FLAT_RULES.push({ canonical: r.canonical, pattern: p });
}
FLAT_RULES.sort((a, b) => b.pattern.length - a.pattern.length);

function titleCaseWords(s: string): string {
  const t = stripDiacritics(s).trim();
  if (!t) return "";
  return t
    .split(/\s+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("en-US") + w.slice(1).toLocaleLowerCase("en-US"))
    .join(" ");
}

/** First comma-separated segment, title-cased, for unknown locations. */
function titleCaseFallback(raw: string): string {
  const first = raw.split(",").map((x) => x.trim()).find(Boolean) ?? raw.trim();
  return titleCaseWords(normalizeForMatch(first).replace(/\s+/g, " "));
}

/**
 * Maps a raw address / neighborhood string to a canonical city label for grouping.
 * Known aliases collapse (e.g. BGC / Bonifacio Global City → `"BGC"`).
 */
export function normalizeCity(rawLocation: string): string {
  const raw = rawLocation.trim();
  if (!raw) return "";

  const key = normalizeForMatch(raw);
  if (!key) return "";

  for (const { pattern, canonical } of FLAT_RULES) {
    if (phraseMatches(key, pattern)) return canonical;
  }

  return titleCaseFallback(raw);
}

/** Prefer persisted `city`; otherwise derive from full `location`. */
export function propertyCanonicalCity(p: { city?: string | null; location: string }): string {
  const c = typeof p.city === "string" ? p.city.trim() : "";
  if (c) return c;
  return normalizeCity(p.location ?? "");
}
