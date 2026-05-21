import { isLandlordRole } from "@/lib/auth-roles";

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

/** Logo home target by portal area. */
export function dormspaceLogoHref(
  role: string | null | undefined,
  variant: "browse" | "landlord",
): string {
  if (variant === "landlord" || isLandlordRole(role)) return "/dormspaces/dashboard";
  return "/dormspaces";
}
