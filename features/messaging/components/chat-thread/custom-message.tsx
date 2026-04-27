import { useMemo } from "react";
import { Avatar, MessageText, useChannelStateContext, useMessageContext } from "stream-chat-react";

import { cn } from "@/lib/utils";
import { messageGapForIndex } from "@/features/messaging/lib/message-grouping";

export function CustomMessage() {
  const { messages: channelMessages } = useChannelStateContext("CustomMessage");
  const { isMyMessage, message, groupStyles, firstOfGroup, readBy, deliveredTo } = useMessageContext();
  const mine = isMyMessage();

  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const showName =
    !mine &&
    Boolean(message.user?.name) &&
    (firstOfGroup || groupStyles?.includes("top") || groupStyles?.includes("single"));
  const showAvatar =
    !mine && (firstOfGroup || groupStyles?.includes("top") || groupStyles?.includes("single"));
  const tight = Boolean(groupStyles?.includes("middle") || groupStyles?.includes("bottom"));

  const gap = useMemo(
    () =>
      messageGapForIndex({
        messages: channelMessages,
        messageId: message.id,
        currentSenderId: message.user?.id,
      }),
    [channelMessages, message.id, message.user?.id],
  );

  const myId = message.user?.id;
  const othersRead = mine && (readBy ?? []).some((u) => u.id && u.id !== myId);
  const othersDelivered = mine && (deliveredTo ?? []).some((u) => u.id && u.id !== myId);
  let readReceipt: string | null = null;
  if (mine && createdAt) {
    if (othersRead) readReceipt = "✓✓";
    else if (othersDelivered || message.status === "received" || message.status === "sent") readReceipt = "✓";
  }

  return (
    <div
      className={cn(
        "bhg-msg",
        mine ? "bhg-msg--mine" : "bhg-msg--other",
        tight && "bhg-msg--tight",
        gap === "start" && "bhg-msg--gap-start",
        gap === "same" && "bhg-msg--gap-same",
        gap === "turn" && "bhg-msg--gap-turn",
        !mine && (showAvatar ? "pl-0" : "pl-12"),
        "w-full",
      )}
    >
      {!mine && showAvatar ? (
        <div className="h-9 w-9 shrink-0">
          <Avatar
            className="h-9 w-9 [&_.str-chat__avatar-fallback]:text-sm"
            image={message.user?.image}
            name={message.user?.name || message.user?.id}
          />
        </div>
      ) : null}
      <div className="bhg-msg__body">
        {showName ? <span className="bhg-msg__name">{message.user?.name}</span> : null}
        <div className="bhg-msg__bubble">
          <MessageText />
        </div>
        {createdAt ? (
          <span className="bhg-msg__time">
            {createdAt}
            {readReceipt ? <span className="bhg-msg__receipt"> {readReceipt}</span> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

