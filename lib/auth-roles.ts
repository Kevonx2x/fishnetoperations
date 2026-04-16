export type ProfileRole = "admin" | "broker" | "agent" | "client" | "team_member";

export function pathForRole(role: string | null | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "broker":
      return "/dashboard/broker";
    case "agent":
    case "team_member":
      return "/dashboard/agent";
    default:
      return "/";
  }
}

export function isProfileRole(r: string): r is ProfileRole {
  return r === "admin" || r === "broker" || r === "agent" || r === "client" || r === "team_member";
}
