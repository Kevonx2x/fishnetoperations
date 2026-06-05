import { AGENT_INHOUSE_MESSENGER_PATH } from "@/lib/messenger/agent-messages-path";

/**
 * Mobile legacy `?tab=` links on `/dashboard/agent` redirect to dedicated routes.
 * Tabs not listed here stay on the hub workspace (`?tab=` on the main agent page).
 */
export const AGENT_MOBILE_PIPELINE_PATH = "/dashboard/agent/pipeline";

export const AGENT_LEGACY_TAB_REDIRECTS: Record<string, string> = {
  pipeline: AGENT_MOBILE_PIPELINE_PATH,
  /** Legacy separate messenger route → unified `?tab=messages`. */
  messenger: AGENT_INHOUSE_MESSENGER_PATH,
};
