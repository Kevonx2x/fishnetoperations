import type { DormspaceGenderPreference } from "@/lib/dormspaces";

export type DormspaceBunkKind = "upper" | "lower";

export type DormspaceBedTypeEntry = {
  gender: "male" | "female";
  bunk: DormspaceBunkKind | string;
  count: number;
  price: number;
};

export type BunkRowFormValue = {
  id: string;
  bunk: DormspaceBunkKind;
  count: string;
  price: string;
};

export const BUNK_KIND_OPTIONS: {
  value: DormspaceBunkKind;
  label: string;
  hint: string;
}[] = [
  { value: "upper", label: "Upper bunk", hint: "Usually cheaper" },
  { value: "lower", label: "Lower bunk", hint: "Usually higher" },
];

export function newBunkRowId(): string {
  return `bunk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultBunkRow(bunk: DormspaceBunkKind = "upper"): BunkRowFormValue {
  return { id: newBunkRowId(), bunk, count: "", price: "" };
}

export function defaultBunksForGender(): BunkRowFormValue[] {
  return [defaultBunkRow("upper"), defaultBunkRow("lower")];
}

export function parseBedTypesJson(raw: unknown): DormspaceBedTypeEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DormspaceBedTypeEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const gender = (item as { gender?: string }).gender;
    const bunk = (item as { bunk?: string }).bunk;
    const count = Number((item as { count?: unknown }).count);
    const price = Number((item as { price?: unknown }).price);
    if (gender !== "male" && gender !== "female") continue;
    if (!bunk || typeof bunk !== "string") continue;
    if (!Number.isFinite(count) || count <= 0) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      gender,
      bunk: bunk === "upper" || bunk === "lower" ? bunk : bunk,
      count: Math.min(50, Math.round(count)),
      price: Math.round(price),
    });
  }
  return out;
}

export function sumBunkCounts(rows: BunkRowFormValue[]): number {
  return rows.reduce((sum, r) => {
    const n = parseInt(r.count, 10);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

/** Adjust gender total by changing bunk row counts (bunks remain source of truth). */
export function adjustGenderBunkTotal(rows: BunkRowFormValue[], delta: number): BunkRowFormValue[] {
  if (delta === 0 || rows.length === 0) return rows;
  const copy = rows.map((r) => ({ ...r }));

  if (delta > 0) {
    for (let step = 0; step < delta; step++) {
      const target = copy.find((r) => (parseInt(r.count, 10) || 0) < 50) ?? copy[0]!;
      const c = parseInt(target.count, 10) || 0;
      target.count = String(c + 1);
    }
    return copy;
  }

  for (let step = 0; step < Math.abs(delta); step++) {
    let changed = false;
    for (let i = copy.length - 1; i >= 0; i--) {
      const c = parseInt(copy[i]!.count, 10) || 0;
      if (c > 0) {
        copy[i] = { ...copy[i]!, count: String(c - 1) };
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return copy;
}

export function cheapestBunkPrice(rows: BunkRowFormValue[]): number | null {
  const prices = rows
    .map((r) => Number(r.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function bedTypesFromBunkRows(
  gender: "male" | "female",
  rows: BunkRowFormValue[],
): DormspaceBedTypeEntry[] {
  const out: DormspaceBedTypeEntry[] = [];
  for (const row of rows) {
    const count = parseInt(row.count, 10);
    const price = Number(row.price);
    if (!Number.isFinite(count) || count <= 0) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    out.push({
      gender,
      bunk: row.bunk,
      count: Math.min(50, Math.round(count)),
      price: Math.round(price),
    });
  }
  return out;
}

export function deriveLegacyFromBedTypes(bedTypes: DormspaceBedTypeEntry[]): {
  male_beds_total: number;
  male_beds_available: number;
  female_beds_total: number;
  female_beds_available: number;
  male_monthly_price: number | null;
  female_monthly_price: number | null;
  total_beds: number;
  available_beds: number;
  monthly_price: number | null;
  gender_preference: DormspaceGenderPreference;
} {
  const maleRows = bedTypes.filter((b) => b.gender === "male");
  const femaleRows = bedTypes.filter((b) => b.gender === "female");
  const male_beds_total = maleRows.reduce((s, b) => s + b.count, 0);
  const female_beds_total = femaleRows.reduce((s, b) => s + b.count, 0);
  const malePrices = maleRows.map((b) => b.price).filter((p) => p > 0);
  const femalePrices = femaleRows.map((b) => b.price).filter((p) => p > 0);
  const allPrices = bedTypes.map((b) => b.price).filter((p) => p > 0);

  let gender_preference: DormspaceGenderPreference = "any";
  if (male_beds_total > 0 && female_beds_total === 0) gender_preference = "male";
  else if (female_beds_total > 0 && male_beds_total === 0) gender_preference = "female";
  else if (male_beds_total > 0 && female_beds_total > 0) gender_preference = "any";

  return {
    male_beds_total,
    male_beds_available: male_beds_total,
    female_beds_total,
    female_beds_available: female_beds_total,
    male_monthly_price: malePrices.length > 0 ? Math.min(...malePrices) : null,
    female_monthly_price: femalePrices.length > 0 ? Math.min(...femalePrices) : null,
    total_beds: Math.max(1, male_beds_total + female_beds_total),
    available_beds: male_beds_total + female_beds_total,
    monthly_price: allPrices.length > 0 ? Math.min(...allPrices) : null,
    gender_preference,
  };
}

export function bunkSummaryParts(
  gender: "male" | "female",
  rows: BunkRowFormValue[],
): string {
  const parts: string[] = [];
  for (const kind of ["upper", "lower"] as const) {
    const n = rows
      .filter((r) => r.bunk === kind)
      .reduce((s, r) => s + (parseInt(r.count, 10) || 0), 0);
    if (n > 0) parts.push(`${n} ${kind}`);
  }
  const other = rows.filter((r) => r.bunk !== "upper" && r.bunk !== "lower");
  for (const row of other) {
    const n = parseInt(row.count, 10) || 0;
    if (n > 0) parts.push(`${n} ${row.bunk}`);
  }
  const label = gender === "male" ? "Male" : "Female";
  const total = sumBunkCounts(rows);
  if (total === 0) return `${label} beds: 0`;
  return `${label} beds: ${total}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

export function formatBunkKindLabel(bunk: string): string {
  const opt = BUNK_KIND_OPTIONS.find((o) => o.value === bunk);
  return opt?.label ?? bunk;
}

export function formatBedTypeDetailLine(entry: DormspaceBedTypeEntry): string {
  const bunkLabel = formatBunkKindLabel(entry.bunk);
  const bedWord = entry.count === 1 ? "bed" : "beds";
  const price = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(entry.price);
  const genderLabel = entry.gender === "male" ? "Male" : "Female";
  return `${genderLabel} · ${bunkLabel} · ${entry.count} ${bedWord} · ₱${price}/mo each`;
}
