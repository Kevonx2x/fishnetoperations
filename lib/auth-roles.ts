export type ProfileRole =
  | "admin"
  | "ops_admin"
  | "broker"
  | "agent"
  | "client"
  | "team_member"
  | "landlord";

/** Profile fields used for dormspace landlord capability. */
export type LandlordCapableProfile = {
  role?: string | null;
  is_landlord?: boolean | null;
};

/** Full admin dashboard (same surface as admin, minus ops-only restrictions in UI). */
export function isAdminPanelRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "ops_admin";
}

/** Owner-style admin: credentials, manual, VA reports, hiring, compensation fields. */
export function isFullAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/** Main nav "Dormspacers" destination — universal dormspaces entry point. */
export function pathForDormspacesNav(
  _signedIn?: boolean,
  _role?: string | null | undefined,
): string {
  return "/dormspaces/welcome";
}

/** BahayGo homepage dormspacers promo banner — browse for most users; welcome for agents. */
export function pathForDormspacesHomeFromBahayGo(role: string | null | undefined): string {
  if (role === "agent") return "/dormspaces/welcome";
  return "/dormspaces";
}

export function pathForRole(role: string | null | undefined): string {
  switch (role) {
    case "admin":
    case "ops_admin":
      return "/admin";
    case "broker":
      return "/dashboard/agency";
    case "agent":
    case "team_member":
      return "/dashboard/agent";
    case "client":
      return "/dashboard/client";
    case "landlord":
      return "/dormspaces/dashboard/listings";
    default:
      return "/";
  }
}

export function isProfileRole(r: string): r is ProfileRole {
  return (
    r === "admin" ||
    r === "ops_admin" ||
    r === "broker" ||
    r === "agent" ||
    r === "client" ||
    r === "team_member" ||
    r === "landlord"
  );
}

/** Primary-role landlord accounts (legacy / welcome email signup). */
export function isLandlordRole(role: string | null | undefined): boolean {
  return role === "landlord";
}

/** Can manage dormspaces (dashboard, submit as returning landlord, landlord APIs). */
export function isLandlordCapable(profile: LandlordCapableProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_landlord === true) return true;
  return isLandlordRole(profile.role);
}

/** Staff roles that must never submit dormspaces or receive is_landlord via submit. */
export const DORMSPACE_SUBMIT_BLOCKED_ROLES: readonly ProfileRole[] = [
  "agent",
  "broker",
  "admin",
  "team_member",
  "ops_admin",
];

export function isDormspaceSubmitBlockedRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (DORMSPACE_SUBMIT_BLOCKED_ROLES as readonly string[]).includes(role);
}

/** Logged-in clients (or no role yet) may gain is_landlord on first dormspace submit. */
export function canSetLandlordFlagOnSubmit(role: string | null | undefined): boolean {
  return role == null || role === "client";
}

/** @deprecated Use canSetLandlordFlagOnSubmit */
export function canUpgradeToLandlordOnSubmit(role: string | null | undefined): boolean {
  return canSetLandlordFlagOnSubmit(role);
}

/** Human-readable role label for auth and onboarding copy. */
export function roleDisplayLabel(role: string | null | undefined): string {
  switch (role) {
    case "ops_admin":
      return "operations admin";
    case "team_member":
      return "team member";
    case "broker":
      return "broker";
    case "landlord":
      return "landlord";
    default:
      return role?.trim() || "user";
  }
}
