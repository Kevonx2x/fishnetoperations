import type { ProfileRole } from "@/lib/auth-roles";

/** Default route after the welcome screen for users who already completed it. */
export function postWelcomeHomeHref(role: ProfileRole | null | undefined): string {
  if (role === "agent" || role === "team_member") return "/dashboard/agent";
  if (role === "broker") return "/dashboard/broker";
  if (role === "client") return "/";
  return "/";
}
