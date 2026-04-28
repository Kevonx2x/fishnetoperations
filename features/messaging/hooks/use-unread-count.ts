import { useEffect, useState, useSyncExternalStore } from "react";
import type { Channel, Event, OwnUserResponse, StreamChat } from "stream-chat";

function totalUnreadFromClient(client: StreamChat | null): number {
  if (!client?.user) return 0;
  const u = client.user as OwnUserResponse;
  return typeof u.total_unread_count === "number" ? u.total_unread_count : 0;
}

/** Event types that typically change `client.user.total_unread_count` (Stream is source of truth). */
const TOTAL_UNREAD_EVENT_TYPES = new Set<string>([
  "message.new",
  "message.read",
  "notification.message_new",
  "notification.mark_read",
  "notification.mark_unread",
  "connection.changed",
  "connection.recovered",
  "user.updated",
]);

/**
 * Reactive global unread count from Stream (`client.user.total_unread_count`).
 * Subscribes with `client.on` + effect cleanup; also applies `event.me` when present for instant updates.
 */
export function useUnreadCount(client: StreamChat | null): number {
  const [count, setCount] = useState(() => totalUnreadFromClient(client));

  useEffect(() => {
    setCount(totalUnreadFromClient(client));
    if (!client) return;

    const syncFromClient = () => {
      setCount(totalUnreadFromClient(client));
    };

    const onEvent = (event: Event) => {
      const meUnread = event.me?.total_unread_count;
      if (typeof meUnread === "number") {
        setCount(meUnread);
        return;
      }
      if (TOTAL_UNREAD_EVENT_TYPES.has(event.type)) {
        syncFromClient();
      }
    };

    const subscription = client.on(onEvent);
    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  return count;
}

function channelUnreadSnapshot(channel: Channel): number {
  try {
    return channel.countUnread();
  } catch {
    return 0;
  }
}

/**
 * Per-channel unread for list rows; subscribes to Stream channel + client read events (no app-owned unread state).
 */
export function useChannelUnreadCount(channel: Channel, client: StreamChat | null): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      const subs: { unsubscribe: () => void }[] = [];
      subs.push(channel.on("message.new", onStoreChange));
      subs.push(channel.on("message.updated", onStoreChange));
      subs.push(channel.on("message.deleted", onStoreChange));
      subs.push(channel.on("message.read", onStoreChange));
      if (client) {
        subs.push(client.on("notification.mark_read", onStoreChange));
        subs.push(
          client.on("message.new", (event: Event) => {
            if (event.cid === channel.cid) onStoreChange();
          }),
        );
        subs.push(
          client.on("message.read", (event: Event) => {
            if (event.cid === channel.cid) onStoreChange();
          }),
        );
      }
      return () => {
        for (const s of subs) s.unsubscribe();
      };
    },
    () => channelUnreadSnapshot(channel),
    () => channelUnreadSnapshot(channel),
  );
}
