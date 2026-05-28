import { useMemo, useState } from "react";
import type { Channel as StreamChannel, ChannelFilters, ChannelSort } from "stream-chat";
import { useChatContext } from "stream-chat-react";

import type { ConversationFilterMode } from "@/features/messaging/types";
import {
  getPeerUser,
  isChannelArchived,
  isChannelPinned,
  isSupportChannel,
} from "@/features/messaging/lib/channel-helpers";

export type UseChannelListParams = {
  selfUserId: string;
};

export const CHANNEL_LIST_SORT: ChannelSort = { last_message_at: -1 };
export const CHANNEL_LIST_OPTIONS = { state: true, presence: true, limit: 30 } as const;

function listTier(ch: StreamChannel): number {
  if (isSupportChannel(ch)) return 0;
  if (isChannelPinned(ch)) return 1;
  return 2;
}

/**
 * Centralized conversation list state:
 * - Stream-native filters gated on `client.userID`
 * - search + filter mode
 * - client-side render filtering + stable tier grouping (support, pinned, then Stream order)
 */
export function useChannelList(params: UseChannelListParams) {
  const { client } = useChatContext();

  const filters = useMemo((): ChannelFilters | null => {
    if (!client?.userID) return null;
    return { type: "messaging", members: { $in: [client.userID] } };
  }, [client?.userID]);

  const [listSearch, setListSearch] = useState("");
  const [filterMode, setFilterMode] = useState<ConversationFilterMode>("all");

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

      // Preserve Stream's last_message_at order within each tier — no redundant time re-sort.
      const indexed = out.map((ch, index) => ({ ch, index }));
      indexed.sort((a, b) => {
        const tierDiff = listTier(a.ch) - listTier(b.ch);
        if (tierDiff !== 0) return tierDiff;
        return a.index - b.index;
      });
      return indexed.map(({ ch }) => ch);
    };
  }, [filterMode, listSearch, params.selfUserId]);

  return {
    filters,
    listSearch,
    setListSearch,
    filterMode,
    setFilterMode,
    channelRenderFilterFn,
  };
}
