/**
 * PostgREST `or` filter: include legacy rows (no expires_at) or non-expired listings.
 * Use on public marketplace / property discovery queries.
 */
export function publicListingExpiryOrFilter(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}
