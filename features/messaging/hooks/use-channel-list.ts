import { useCallback, useEffect, useMemo, useState } from "react";
import type { Channel as StreamChannel, ChannelFilters, ChannelSort } from "stream-chat";
import { useChatContext } from "stream-chat-react";

import type { ConversationFilterMode } from "@/features/messaging/types";
import {
  getPeerUser,
  isChannelArchived,
  isChannelPinned,
  isSupportChannel,
  msFromDateLike,
} from "@/features/messaging/lib/channel-helpers";

export type UseChannelListParams = {
  selfUserId: string;
};

export const CHANNEL_LIST_SORT: ChannelSort = { last_message_at: -1 };
export const CHANNEL_LIST_OPTIONS = { state: true, presence: true, limit: 30 } as const;

/**
 * Centralized conversation list state:
 * - Stream-native filters gated on `client.userID`
 * - search + filter mode
 * - client-side render filtering + sorting (pinned first)
 * - forces immediate re-render on Stream channel updates/visibility changes by bumping a key
 */
export function useChannelList(params: UseChannelListParams) {
  const { client } = useChatContext();
  const [channelListKey, setChannelListKey] = useState(0);
  const bumpChannelListKey = useCallback(() => setChannelListKey((k) => k + 1), []);

  const filters = useMemo((): ChannelFilters | null => {
    if (!client?.userID) return null;
    return { type: "messaging", members: { $in: [client.userID] } };
  }, [client?.userID]);

  const [listSearch, setListSearch] = useState("");
  const [filterMode, setFilterMode] = useState<ConversationFilterMode>("all");

  useEffect(() => {
    const handler = () => bumpChannelListKey();
    client.on("channel.updated", handler);
    client.on("channel.hidden", handler);
    client.on("channel.visible", handler);
    return () => {
      client.off("channel.updated", handler);
      client.off("channel.hidden", handler);
      client.off("channel.visible", handler);
    };
  }, [bumpChannelListKey, client]);

  const channelRenderFilterFn = useMemo(() => {
    return (channels: StreamChannel[]) => {
      let out = channels;
      const q = listSearch.trim().toLowerCase();
      if (q) {
        out = out.filter((ch) => {
          if (isSupportChannel(ch)) {
            const data = ch.data as { display_name?: string } | undefined;
            const dn = (data?.display_name || "BahayGo Support").toLowerCase();
            if (dn.includes(q)) return true;
          }
          const peer = getPeerUser(ch, params.selfUserId);
          const chName = (ch.data as { name?: string } | undefined)?.name;
          const title = (peer?.name || peer?.id || chName || "").toLowerCase();
          const last = ch.state?.messages?.[ch.state.messages.length - 1]?.text?.toLowerCase() ?? "";
          return title.includes(q) || last.includes(q);
        });
      }

      if (filterMode === "unread") {
        out = out.filter(
          (ch) =>
            ch.countUnread() > 0 && (!isChannelArchived(ch) || isSupportChannel(ch)),
        );
      } else if (filterMode === "pinned") {
        out = out.filter((ch) => isChannelPinned(ch) || isSupportChannel(ch));
      } else if (filterMode === "archived") {
        out = out.filter((ch) => isChannelArchived(ch) && !isSupportChannel(ch));
      } else {
        out = out.filter((ch) => !isChannelArchived(ch) || isSupportChannel(ch));
      }

      return [...out].sort((a, b) => {
        const aSup = isSupportChannel(a);
        const bSup = isSupportChannel(b);
        if (aSup && !bSup) return -1;
        if (!aSup && bSup) return 1;
        const aPinned = isChannelPinned(a);
        const bPinned = isChannelPinned(b);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        const aTime = msFromDateLike(a.state?.last_message_at);
        const bTime = msFromDateLike(b.state?.last_message_at);
        return bTime - aTime;
      });
    };
  }, [filterMode, listSearch, params.selfUserId]);

  return {
    filters,
    channelListKey,
    bumpChannelListKey,
    listSearch,
    setListSearch,
    filterMode,
    setFilterMode,
    channelRenderFilterFn,
  };
}

