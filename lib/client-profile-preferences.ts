/** Fields required before a client can request a viewing (matches settings → Profile). */

export type ClientPreferenceFields = {
  budget_min: number | null;
  budget_max: number | null;
  looking_to: string | null;
  preferred_property_type: string | null;
  country_of_origin: string | null;
};

export function getMissingClientPreferenceLabels(row: Partial<ClientPreferenceFields>): string[] {
  const missing: string[] = [];
  if (row.budget_min == null || row.budget_max == null) missing.push("Budget range");
  if (!row.looking_to?.trim()) missing.push("Looking to (Buy/Rent)");
  if (!row.preferred_property_type?.trim()) missing.push("Property preference");
  if (!row.country_of_origin?.trim()) missing.push("Country of origin");
  return missing;
}

export function isClientProfilePrefsComplete(row: Partial<ClientPreferenceFields>): boolean {
  return getMissingClientPreferenceLabels(row).length === 0;
}

export function formatBudgetRangePhp(min: number | null, max: number | null): string {
  const a = min != null ? `₱${Math.round(Number(min)).toLocaleString("en-US")}` : "—";
  const b = max != null ? `₱${Math.round(Number(max)).toLocaleString("en-US")}` : "—";
  return `${a}–${b}`;
}

export function lookingToLabel(lookingTo: string | null | undefined): string {
  if (!lookingTo?.trim()) return "—";
  const map: Record<string, string> = { buy: "Buy", rent: "Rent", both: "Both" };
  return map[lookingTo] ?? lookingTo;
}

/** `profiles.preferred_locations` JSON array of strings */
export function preferredLocationsLabel(preferredLocations: unknown): string {
  if (!Array.isArray(preferredLocations) || preferredLocations.length === 0) return "—";
  const labels = preferredLocations.filter((x): x is string => typeof x === "string");
  return labels.length ? labels.join(", ") : "—";
}
