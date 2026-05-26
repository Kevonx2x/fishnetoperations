/** URL segments and legacy `?tab=` redirects for the agent dashboard hub. */

export const AGENT_DASHBOARD_HUB_PATH = "/dashboard/agent";

export type AgentDashboardSectionId =
  | "pipeline"
  | "listings"
  | "inquiries"
  | "analytics"
  | "billing"
  | "profile"
  | "messages"
  | "documents";

/** Maps hub section routes to the tab id used inside `agent-dashboard.tsx`. */
export type AgentDashboardTabId =
  | "pipeline"
  | "listings"
  | "notifications"
  | "analytics"
  | "billing"
  | "profile"
  | "messages"
  | "documents";

export const AGENT_SECTION_TO_TAB: Record<AgentDashboardSectionId, AgentDashboardTabId> = {
  pipeline: "pipeline",
  listings: "listings",
  inquiries: "notifications",
  analytics: "analytics",
  billing: "billing",
  profile: "profile",
  messages: "messages",
  documents: "documents",
};

export const AGENT_SECTION_PATHS: Record<AgentDashboardSectionId, string> = {
  pipeline: "/dashboard/agent/pipeline",
  listings: "/dashboard/agent/listings",
  inquiries: "/dashboard/agent/inquiries",
  analytics: "/dashboard/agent/analytics",
  billing: "/dashboard/agent/billing",
  profile: "/dashboard/agent/profile",
  messages: "/dashboard/agent/messages",
  documents: "/dashboard/agent/documents",
};

export const AGENT_SECTION_TITLES: Record<AgentDashboardSectionId, string> = {
  pipeline: "Pipeline",
  listings: "My Listings",
  inquiries: "Inquiries",
  analytics: "Analytics",
  billing: "Billing",
  profile: "My Profile",
  messages: "Messages",
  documents: "Documents",
};

export function agentSectionIdFromPathname(pathname: string): AgentDashboardSectionId | null {
  const base = AGENT_DASHBOARD_HUB_PATH;
  if (!pathname.startsWith(base + "/")) return null;
  const rest = pathname.slice(base.length + 1).split("/")[0]?.trim();
  if (!rest) return null;
  if (rest in AGENT_SECTION_PATHS) {
    return rest as AgentDashboardSectionId;
  }
  return null;
}

export function agentTabPath(tab: AgentDashboardTabId): string {
  const entry = Object.entries(AGENT_SECTION_TO_TAB).find(([, t]) => t === tab);
  if (entry) return AGENT_SECTION_PATHS[entry[0] as AgentDashboardSectionId];
  return AGENT_DASHBOARD_HUB_PATH;
}

/** Legacy `?tab=` values → canonical paths (used by layout redirect). */
export const AGENT_LEGACY_TAB_REDIRECTS: Record<string, string> = {
  overview: AGENT_DASHBOARD_HUB_PATH,
  dashboard: AGENT_DASHBOARD_HUB_PATH,
  pipeline: AGENT_SECTION_PATHS.pipeline,
  leads: AGENT_SECTION_PATHS.pipeline,
  viewings: AGENT_SECTION_PATHS.pipeline,
  listings: AGENT_SECTION_PATHS.listings,
  profile: AGENT_SECTION_PATHS.profile,
  analytics: AGENT_SECTION_PATHS.analytics,
  notifications: AGENT_SECTION_PATHS.inquiries,
  billing: AGENT_SECTION_PATHS.billing,
  documents: AGENT_SECTION_PATHS.documents,
  messages: AGENT_SECTION_PATHS.messages,
  inquiries: AGENT_SECTION_PATHS.inquiries,
  team: "/dashboard/agency",
};
