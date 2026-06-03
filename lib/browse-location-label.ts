/** Collapse duplicate comma segments (e.g. "Manila, Manila" → "Manila"). */
export function normalizeBrowseLocationLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!unique.some((u) => u.toLowerCase() === lower)) unique.push(p);
  }

  if (unique.length === 0) return t;
  if (unique.length === 1) return unique[0]!;
  return unique.join(", ");
}

/** Chip line under the search bar (BahayGo / Dormspacers). */
export function formatBrowseNearLine(place: string, fallback = "Metro Manila"): string {
  const normalized = normalizeBrowseLocationLabel(place);
  if (!normalized) return `Near ${fallback}`;
  return `Near ${normalized}`;
}
