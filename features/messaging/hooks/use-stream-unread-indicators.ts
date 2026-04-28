import { useSyncExternalStore } from "react";
import type { Channel, Event, StreamChat } from "stream-chat";

function streamTotalUnreadSnapshot(client: StreamChat | null): number {
  if (!client?.user) return 0;
  const u = client.user as { total_unread_count?: number };
  return typeof u.total_unread_count === "number" ? u.total_unread_count : 0;
}

function subscribeStreamTotalUnread(client: StreamChat | null, onStoreChange: () => void) {
  if (!client) return () => {};
  const handler = () => onStoreChange();
  const events = [
    "message.new",
    "message.read",
    "notification.message_new",
    "notification.mark_read",
    "notification.mark_unread",
    "connection.recovered",
    "user.updated",
  ] as const;
  for (const e of events) client.on(e, handler);
  return () => {
    for (const e of events) client.off(e, handler);
  };
}

/** Subscribes to Stream `client.user.total_unread_count` (no local unread state). */
export function useStreamTotalUnreadCount(client: StreamChat | null): number {
  return useSyncExternalStore(
    (onStoreChange) => subscribeStreamTotalUnread(client, onStoreChange),
    () => streamTotalUnreadSnapshot(client),
    () => 0,
  );
}

function channelUnreadSnapshot(channel: Channel): number {
  try {
    return channel.countUnread();
  } catch {
    return 0;
  }
}

/**
 * Subscribes to Stream channel + client events so `countUnread()` stays in sync without remounting the list.
 */
export function useChannelUnreadCount(channel: Channel, client: StreamChat | null): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      const subs: { unsubscribe: () => void }[] = [];
      subs.push(channel.on("message.new", onStoreChange));
      subs.push(channel.on("message.updated", onStoreChange));
      subs.push(channel.on("message.deleted", onStoreChange));
      if (client) {
        subs.push(client.on("notification.mark_read", onStoreChange));
        subs.push(
          client.on("message.new", (event: Event) => {
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
