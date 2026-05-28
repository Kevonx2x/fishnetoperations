"use client";

import { useEffect } from "react";
import type { Channel as StreamChannel, LocalMessage } from "stream-chat";
import { useChatContext } from "stream-chat-react";

import {
  getPeerUser,
  isSupportChannel,
  previewPlainText,
} from "@/features/messaging/lib/channel-helpers";
import {
  writeChannelListCache,
  type CachedChannelPreview,
} from "@/features/messaging/lib/channel-list-cache";
import { CHANNEL_LIST_OPTIONS, CHANNEL_LIST_SORT } from "@/features/messaging/hooks/use-channel-list";

function toTimeString(timeSource: unknown): string {
  if (!timeSource) return "";
  const t = new Date(String(timeSource)).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function channelToCachedPreview(ch: StreamChannel, selfUserId: string): CachedChannelPreview | null {
  const id = (ch.id ?? "").trim();
  if (!id) return null;

  const support = isSupportChannel(ch);
  const data = ch.data as { display_name?: string; display_avatar_url?: string; name?: string } | undefined;
  const peer = getPeerUser(ch, selfUserId);
  const lastMessage = ch.state?.messages?.[ch.state.messages.length - 1] as LocalMessage | undefined;
  const rawPreview = previewPlainText(undefined, lastMessage);
  const title = support
    ? (data?.display_name?.trim() || "BahayGo Support")
    : (peer?.name || peer?.id || data?.name || "Conversation").trim();

  let unread = 0;
  try {
    unread = ch.countUnread();
  } catch {
    unread = 0;
  }

  return {
    id,
    title: title || "Conversation",
    preview: rawPreview || (support ? "Get help from our team" : "No messages yet"),
    time: toTimeString(lastMessage?.created_at ?? ch.state?.last_message_at),
    unread,
    avatarUrl: support
      ? (data?.display_avatar_url?.trim() || "/apple-touch-icon.png")
      : (peer?.image ?? undefined),
    support,
  };
}

/** Persists channel list previews for stale-while-revalidate on next visit. */
export function ChannelListCacheSync({ selfUserId }: { selfUserId: string }) {
  const { client } = useChatContext();

  useEffect(() => {
    if (!client?.userID || !selfUserId) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const channels = await client.queryChannels(
          { type: "messaging", members: { $in: [client.userID!] } },
          CHANNEL_LIST_SORT,
          CHANNEL_LIST_OPTIONS,
        );
        if (cancelled) return;
        const rows = channels
          .map((ch) => channelToCachedPreview(ch, selfUserId))
          .filter((r): r is CachedChannelPreview => r != null);
        writeChannelListCache(selfUserId, rows);
      } catch {
        // ignore background cache write failures
      }
    };

    void sync();
    const events = ["message.new", "notification.message_new", "channel.updated", "channel.visible"] as const;
    for (const event of events) {
      client.on(event, sync);
    }

    return () => {
      cancelled = true;
      for (const event of events) {
        client.off(event, sync);
      }
    };
  }, [client, selfUserId]);

  return null;
}
