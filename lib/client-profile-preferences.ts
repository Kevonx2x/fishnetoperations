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

/** Optional profile fields for viewing-request notes + public display */
export type ClientProfileHouseholdNotes = {
  visa_type?: string | null;
  occupant_count?: number | null;
  has_pets?: boolean | null;
  move_in_timeline?: string | null;
  agent_notes?: string | null;
};

export type ClientProfileExtendedRow = ClientPreferenceFields &
  ClientProfileHouseholdNotes & {
    preferred_locations?: unknown;
  };

function pesoFmtNotes(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-US")}`;
}

/** Pre-fill string for viewing request notes (pipe-separated blocks; extras in second block). */
export function buildClientViewingNotesPrefill(row: ClientProfileExtendedRow): string {
  const core: string[] = [];
  if (row.budget_min != null || row.budget_max != null) {
    const a = row.budget_min != null ? pesoFmtNotes(Number(row.budget_min)) : "—";
    const b = row.budget_max != null ? pesoFmtNotes(Number(row.budget_max)) : "—";
    core.push(`Budget: ${a}–${b}`);
  }
  if (row.looking_to) {
    const map: Record<string, string> = { buy: "Buy", rent: "Rent", both: "Both" };
    core.push(`Looking to: ${map[row.looking_to] ?? row.looking_to}`);
  }
  if (row.preferred_property_type?.trim()) {
    core.push(`Property type: ${row.preferred_property_type.trim()}`);
  }
  const locs = row.preferred_locations;
  if (Array.isArray(locs) && locs.length) {
    const labels = locs.filter((x): x is string => typeof x === "string");
    if (labels.length) core.push(`Preferred areas: ${labels.join(", ")}`);
  }
  if (row.country_of_origin?.trim()) {
    core.push(`Country: ${row.country_of_origin.trim()}`);
  }
  const country = row.country_of_origin?.trim().toLowerCase() ?? "";
  if (country && country !== "philippines" && row.visa_type?.trim()) {
    core.push(`Visa: ${row.visa_type.trim()}`);
  }

  const extra: string[] = [];
  if (row.occupant_count != null && Number.isFinite(Number(row.occupant_count))) {
    extra.push(`Occupants: ${Math.round(Number(row.occupant_count))}`);
  }
  if (row.has_pets === true) extra.push("Pets: Yes");
  else if (row.has_pets === false) extra.push("Pets: No");
  if (row.move_in_timeline?.trim()) {
    extra.push(`Move-in: ${row.move_in_timeline.trim()}`);
  }
  if (row.agent_notes?.trim()) {
    extra.push(`Notes: ${row.agent_notes.trim()}`);
  }

  const lines: string[] = [];
  if (core.length) lines.push(core.join(" | "));
  if (extra.length) lines.push(extra.join(" | "));
  if (!lines.length) return "";
  return lines.join("\n\n") + (lines.length ? "\n\n" : "");
}

export function isNonFilipinoCountry(country: string | null | undefined): boolean {
  const c = country?.trim().toLowerCase() ?? "";
  return Boolean(c && c !== "philippines");
}
