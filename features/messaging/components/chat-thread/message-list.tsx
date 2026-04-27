import { MessageList as StreamMessageList } from "stream-chat-react";

import { CustomMessage } from "@/features/messaging/components/chat-thread/custom-message";

/**
 * Message list for the active channel.
 *
 * We intentionally use Stream's core `MessageList` (non-virtual) here because it
 * has the most reliable built-in scroll-to-bottom behavior across channel switches
 * and message sends in our layout.
 */
export function MessageList() {
  return (
    <StreamMessageList
      Message={CustomMessage}
      noGroupByUser={false}
      returnAllReadData
      maxTimeBetweenGroupedMessages={120000}
      scrolledUpThreshold={50}
      hideDeletedMessages
    />
  );
}

