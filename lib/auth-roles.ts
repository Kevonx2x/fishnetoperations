export type ProfileRole = "admin" | "ops_admin" | "broker" | "agent" | "client" | "team_member";

/** Full admin dashboard (same surface as admin, minus ops-only restrictions in UI). */
export function isAdminPanelRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "ops_admin";
}

/** Owner-style admin: credentials, manual, VA reports, hiring, compensation fields. */
export function isFullAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function pathForRole(role: string | null | undefined): string {
  switch (role) {
    case "admin":
    case "ops_admin":
      return "/admin";
    case "broker":
      return "/dashboard/broker";
    case "agent":
    case "team_member":
      return "/dashboard/agent";
    case "client":
      return "/dashboard/client";
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
    r === "team_member"
  );
}
