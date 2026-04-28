"use client";

import { useEffect, useState } from "react";
import type { OwnUserResponse, StreamChat } from "stream-chat";

import { useStreamChat } from "@/features/messaging/components/stream-chat-provider";

function totalUnreadFromClient(client: StreamChat | null): number {
  if (!client?.user) return 0;
  const u = client.user as OwnUserResponse;
  return typeof u.total_unread_count === "number" ? u.total_unread_count : 0;
}

/**
 * Global message unread for sidebar / list chrome: mirrors `client.user.total_unread_count` only.
 * Subscribes to the same events Stream uses to refresh that field after `channel.markRead()` on
 * conversation click (MessageList auto–mark-read can run too late for nav badges).
 */
export function useUnreadMessageCount(): number {
  const client = useStreamChat();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!client?.userID) {
      setCount(0);
      return;
    }

    const update = () => {
      setCount(totalUnreadFromClient(client));
    };

    update();

    client.on("notification.mark_read", update);
    client.on("notification.message_new", update);
    client.on("message.new", update);

    return () => {
      client.off("notification.mark_read", update);
      client.off("notification.message_new", update);
      client.off("message.new", update);
    };
  }, [client?.userID]);

  return count;
}
