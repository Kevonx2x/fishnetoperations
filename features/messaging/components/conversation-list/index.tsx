import { useCallback } from "react";
import { ChannelList, useChatContext } from "stream-chat-react";
import type { ChannelPreviewUIComponentProps } from "stream-chat-react";

import { ConversationFilter } from "@/features/messaging/components/conversation-list/conversation-filter";
import { SearchBar } from "@/features/messaging/components/conversation-list/search-bar";
import { ConversationPreview } from "@/features/messaging/components/conversation-list/conversation-preview";
import { ChannelListCacheSync } from "@/features/messaging/components/conversation-list/channel-list-cache-sync";
import {
  ConversationListChannelSkeleton,
  ConversationListLoadingShell,
} from "@/features/messaging/components/conversation-list/conversation-list-loading-shell";
import { CHANNEL_LIST_OPTIONS, CHANNEL_LIST_SORT, useChannelList } from "@/features/messaging/hooks/use-channel-list";
import { useEnsureSupportChannel } from "@/features/messaging/hooks/use-ensure-support-channel";
import { useUnreadMessageCount } from "@/features/messaging/hooks/use-unread-message-count";

export function ConversationListPanel(props: {
  selfUserId: string;
  setActiveChannelOnMount: boolean;
  variant: "desktop" | "mobile";
  suppressMobileHeader?: boolean;
}) {
  const { client } = useChatContext();
  const streamMessagesUnreadTotal = useUnreadMessageCount();
  const {
    filters,
    channelListKey,
    bumpChannelListKey,
    listSearch,
    setListSearch,
    filterMode,
    setFilterMode,
    channelRenderFilterFn,
  } = useChannelList({ selfUserId: props.selfUserId });

  useEnsureSupportChannel({
    enabled: Boolean(filters && client.userID),
    onEnsured: bumpChannelListKey,
  });

  const Preview = useCallback(
    (p: ChannelPreviewUIComponentProps) => (
      <ConversationPreview
        {...p}
        selfId={props.selfUserId}
        onChannelListMutate={bumpChannelListKey}
      />
    ),
    [bumpChannelListKey, props.selfUserId],
  );

  const showLargeHeader = props.variant === "desktop";

  if (!filters || !client.userID) {
    return (
      <ConversationListLoadingShell
        selfUserId={props.selfUserId}
        variant={props.variant}
        suppressMobileHeader={props.suppressMobileHeader}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-b border-subtle md:border-b-0 md:border-r md:border-subtle md:w-[320px] md:min-w-[320px] md:max-w-[320px]">
      <ChannelListCacheSync selfUserId={props.selfUserId} />
      {showLargeHeader ? (
        <div className="hidden shrink-0 border-b border-subtle bg-surface-page px-4 pb-4 pt-5 md:block">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-fg">Messages</h2>
            {streamMessagesUnreadTotal > 0 ? (
              <span className="rounded-full bg-fg/10 px-2 py-0.5 text-xs font-bold tabular-nums text-fg/80">
                {streamMessagesUnreadTotal > 99 ? "99+" : streamMessagesUnreadTotal}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            <SearchBar value={listSearch} onChange={setListSearch} />
            <ConversationFilter value={filterMode} onChange={setFilterMode} />
          </div>
        </div>
      ) : props.suppressMobileHeader ? (
        <div className="border-b border-subtle bg-[#FAF8F4] px-4 py-3 md:hidden">
          <div className="flex gap-2">
            <SearchBar
              value={listSearch}
              onChange={setListSearch}
              className="min-w-0 flex-1"
            />
            <ConversationFilter value={filterMode} onChange={setFilterMode} />
          </div>
        </div>
      ) : (
        <div className="border-b border-subtle bg-[#FAF8F4] px-4 py-3 md:hidden">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-xl font-semibold text-[#2C2C2C]">Messages</span>
            {streamMessagesUnreadTotal > 0 ? (
              <span className="rounded-full bg-[#2C2C2C]/10 px-2 py-0.5 text-xs font-bold tabular-nums text-[#2C2C2C]/80">
                {streamMessagesUnreadTotal > 99 ? "99+" : streamMessagesUnreadTotal}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex gap-2">
            <SearchBar
              value={listSearch}
              onChange={setListSearch}
              className="min-w-0 flex-1"
            />
            <ConversationFilter value={filterMode} onChange={setFilterMode} />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <ChannelList
          key={`${client.userID}-${channelListKey}`}
          filters={filters}
          sort={CHANNEL_LIST_SORT}
          options={CHANNEL_LIST_OPTIONS}
          setActiveChannelOnMount={props.setActiveChannelOnMount}
          Preview={Preview}
          channelRenderFilterFn={channelRenderFilterFn}
          LoadingIndicator={ConversationListChannelSkeleton}
        />
      </div>
    </div>
  );
}

