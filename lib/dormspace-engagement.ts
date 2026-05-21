
/** Staff and landlord accounts browse/manage — they must not like dorm listings. */
const DORMSPACE_LIKE_BLOCKED_ROLES = new Set([
  "landlord",
  "agent",
  "broker",
  "admin",
  "ops_admin",
  "team_member",
]);

export function canLikeDormspaces(role: string | null | undefined): boolean {
  if (!role) return true;
  return !DORMSPACE_LIKE_BLOCKED_ROLES.has(role);
}

export function isDormspaceLikeBlockedRole(role: string | null | undefined): boolean {
  return Boolean(role && DORMSPACE_LIKE_BLOCKED_ROLES.has(role));
}

export const ONLY_SEEKERS_CAN_LIKE_DORMS =
  "Only students and tenants can save dorm listings. Landlords use My Listings.";

export function dormspaceLikeSignInPath(nextPath: string): string {
  return `/auth/login?next=${encodeURIComponent(nextPath)}`;
}

/** Dormspacers logo/watermark home — public listing browse page. */
export function dormspaceLogoHref(): string {
  return "/dormspaces";
}

/** True when the signed-in user owns this dormspace listing. */
export function isOwnDormspaceListing(
  viewerUserId: string | null | undefined,
  landlordUserId: string | null | undefined,
): boolean {
  return Boolean(viewerUserId && landlordUserId && viewerUserId === landlordUserId);
}

export const CANNOT_LIKE_OWN_DORMSPACE = "Cannot like your own listing";
export const CANNOT_SAVE_OWN_DORMSPACE = "Cannot save your own listing";
