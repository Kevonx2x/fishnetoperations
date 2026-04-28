import { useSyncExternalStore } from "react";
import type { Channel, Event, StreamChat } from "stream-chat";

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
