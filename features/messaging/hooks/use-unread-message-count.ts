"use client";

import { useEffect, useState } from "react";
import type { Event, OwnUserResponse, StreamChat } from "stream-chat";

import { useStreamChat } from "@/features/messaging/components/stream-chat-provider";

function totalUnreadFromClient(client: StreamChat | null): number {
  if (!client?.user) return 0;
  const u = client.user as OwnUserResponse;
  return typeof u.total_unread_count === "number" ? u.total_unread_count : 0;
}

/** TEMPORARY: broad client events to see which ones correlate with `total_unread_count` changes. Remove after diagnosis. */
const DIAGNOSTIC_UNREAD_EVENTS = [
  "notification.mark_read",
  "notification.message_new",
  "notification.added_to_channel",
  "message.new",
  "message.read",
  "user.updated",
  "user.watching.start",
  "connection.changed",
] as const;

/**
 * Global message unread for sidebar / list chrome: mirrors `client.user.total_unread_count` only.
 * Subscribes to the same events Stream uses to refresh that field after `channel.markRead()` on
 * conversation click (MessageList auto–mark-read can run too late for nav badges).
 *
 * @todo DIAGNOSTIC — remove `console.log` / extra `DIAGNOSTIC_UNREAD_EVENTS` listeners after root cause is fixed.
 */
export function useUnreadMessageCount(): number {
  const client = useStreamChat();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!client?.userID) {
      setCount(0);
      return;
    }

    const logAndSetCount = (eventType: string) => {
      const newCount = totalUnreadFromClient(client);
      console.log("[unread-badge]", {
        eventType,
        total_unread_count: newCount,
        timestamp: new Date().toISOString(),
      });
      setCount(newCount);
    };

    const onStreamEvent = (event: Event) => {
      logAndSetCount(event.type);
    };

    logAndSetCount("initial-hook");

    for (const evt of DIAGNOSTIC_UNREAD_EVENTS) {
      client.on(evt, onStreamEvent);
    }

    return () => {
      for (const evt of DIAGNOSTIC_UNREAD_EVENTS) {
        client.off(evt, onStreamEvent);
      }
    };
  }, [client?.userID]);

  return count;
}
