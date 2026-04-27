import { VirtualizedMessageList } from "stream-chat-react";

import { CustomMessage } from "@/features/messaging/components/chat-thread/custom-message";

export function MessageList() {
  return (
    <VirtualizedMessageList
      Message={CustomMessage}
      shouldGroupByUser
      returnAllReadData
      maxTimeBetweenGroupedMessages={120000}
      stickToBottomScrollBehavior="smooth"
      suppressAutoscroll={false}
      additionalVirtuosoProps={{
        className: "str-chat__message-list-scroll str-chat__message-list",
      }}
    />
  );
}

