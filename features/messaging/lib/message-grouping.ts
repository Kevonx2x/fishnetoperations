import type { LocalMessage } from "stream-chat";

export type MessageGap = "start" | "same" | "turn";

export function messageGapForIndex(params: {
  messages: LocalMessage[] | undefined;
  messageId: string | undefined;
  currentSenderId: string | undefined;
}): MessageGap {
  const { messages, messageId, currentSenderId } = params;
  if (!messages?.length || !messageId) return "start";
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx <= 0) return "start";
  const prev = messages[idx - 1];
  const prevSenderId = prev?.user?.id;
  if (currentSenderId && prevSenderId && currentSenderId === prevSenderId) return "same";
  return "turn";
}

