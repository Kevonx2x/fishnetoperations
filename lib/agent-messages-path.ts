/** Agent in-house messenger — single messages destination on the agent dashboard. */
export const AGENT_MESSENGER_TAB_PATH = "/dashboard/agent?tab=messages";

/** @deprecated Use role-aware paths; kept for legacy imports during migration. */
export const UNIFIED_MESSAGES_PATH = AGENT_MESSENGER_TAB_PATH;

/** @deprecated Use AGENT_MESSENGER_TAB_PATH. */
export const AGENT_MESSAGES_PATH = AGENT_MESSENGER_TAB_PATH;

export function agentMessagesHref(conversationId?: string | null): string {
  const params = new URLSearchParams({ tab: "messages" });
  if (conversationId?.trim()) {
    params.set("c", conversationId.trim());
  }
  return `/dashboard/agent?${params.toString()}`;
}
