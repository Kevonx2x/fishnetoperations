/** True when a listing was soft-deleted or marked removed in availability_state. */
export function isPropertyListingRemoved(
  row: { deleted_at?: string | null; availability_state?: string | null } | null | undefined,
): boolean {
  if (row == null) return false;
  if (String(row.availability_state ?? "").trim().toLowerCase() === "removed") return true;
  const v = row.deleted_at;
  return v != null && String(v).trim() !== "";
}
