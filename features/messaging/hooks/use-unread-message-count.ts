"use client";

import { useEffect, useState } from "react";
import type { OwnUserResponse, StreamChat } from "stream-chat";

import { useStreamChat } from "@/features/messaging/components/stream-chat-provider";

function totalUnreadFromClient(client: StreamChat | null): number {
  if (!client?.user) return 0;
  const u = client.user as OwnUserResponse;
  return typeof u.total_unread_count === "number" ? u.total_unread_count : 0;
}

const UNREAD_REFRESH_EVENTS = [
  "notification.mark_read",
  "notification.message_new",
  "notification.added_to_channel",
  "message.new",
  "message.read",
  "user.updated",
] as const;

/**
 * Global message unread for sidebar / list chrome: mirrors `client.user.total_unread_count`.
 * Updates when channels are read (e.g. opening a conversation and Stream marks read).
 */
export function useUnreadMessageCount(): number {
  const client = useStreamChat();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!client?.userID) {
      setCount(0);
      return;
    }

    const refresh = () => {
      setCount(totalUnreadFromClient(client));
    };

    setCount(totalUnreadFromClient(client));

    for (const evt of UNREAD_REFRESH_EVENTS) {
      client.on(evt, refresh);
    }

    return () => {
      for (const evt of UNREAD_REFRESH_EVENTS) {
        client.off(evt, refresh);
      }
    };
  }, [client, client?.userID]);

  return count;
}
