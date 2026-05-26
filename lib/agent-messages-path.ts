/** Canonical unified inbox (mobile hub, bottom nav Inbox, deep links). */
export const UNIFIED_MESSAGES_PATH = "/messages";

/** @deprecated Use UNIFIED_MESSAGES_PATH — kept for imports. */
export const AGENT_MESSAGES_PATH = UNIFIED_MESSAGES_PATH;

export function agentMessagesHref(channelId?: string | null): string {
  if (!channelId) return UNIFIED_MESSAGES_PATH;
  return `${UNIFIED_MESSAGES_PATH}?channel=${encodeURIComponent(channelId)}`;
}
