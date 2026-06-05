export const CLIENT_MESSENGER_PATH = "/dashboard/client/messages";

export function clientMessagesHref(conversationId?: string | null): string {
  if (!conversationId?.trim()) return CLIENT_MESSENGER_PATH;
  return `${CLIENT_MESSENGER_PATH}?c=${encodeURIComponent(conversationId.trim())}`;
}
