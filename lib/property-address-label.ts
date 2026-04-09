/** Fallback when a property has no name/location for client-facing notification copy. */
export const PROPERTY_ADDRESS_FALLBACK = "your property inquiry";

/**
 * Single line for notifications: name + location when both exist, else best available.
 */
export function propertyAddressLabel(
  row: { name?: string | null; location?: string | null } | null | undefined,
): string {
  if (!row) return PROPERTY_ADDRESS_FALLBACK;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const loc = typeof row.location === "string" ? row.location.trim() : "";
  if (name && loc) return `${name} — ${loc}`;
  if (loc) return loc;
  if (name) return name;
  return PROPERTY_ADDRESS_FALLBACK;
}
