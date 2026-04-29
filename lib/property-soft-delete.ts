/** True when a listing was soft-deleted (`properties.deleted_at` set). */
export function isPropertyListingRemoved(
  row: { deleted_at?: string | null } | null | undefined,
): boolean {
  if (row == null) return false;
  const v = row.deleted_at;
  return v != null && String(v).trim() !== "";
}
