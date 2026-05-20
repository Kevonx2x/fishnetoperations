export type ProfileRole =
  | "admin"
  | "ops_admin"
  | "broker"
  | "agent"
  | "client"
  | "team_member"
  | "landlord";

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
      return "/dormspaces/dashboard";
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

export function isLandlordRole(role: string | null | undefined): boolean {
  return role === "landlord";
}

/** Staff roles that must never be upgraded to landlord via dormspace submit. */
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

/** Only clients (or profiles with no role yet) may be promoted to landlord on submit. */
export function canUpgradeToLandlordOnSubmit(role: string | null | undefined): boolean {
  return role == null || role === "client";
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
