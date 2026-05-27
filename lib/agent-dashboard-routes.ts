import { UNIFIED_MESSAGES_PATH } from "@/lib/agent-messages-path";

/**
 * Mobile legacy `?tab=` links on `/dashboard/agent` redirect to dedicated routes.
 * Tabs not listed here stay on the hub workspace (`?tab=` on the main agent page).
 */
export const AGENT_LEGACY_TAB_REDIRECTS: Record<string, string> = {
  pipeline: "/dashboard/agent/pipeline",
  messages: UNIFIED_MESSAGES_PATH,
};
