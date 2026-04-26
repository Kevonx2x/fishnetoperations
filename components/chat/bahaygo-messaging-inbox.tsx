"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Archive, ArrowLeft, ListFilter, MoreHorizontal, Pin, Search } from "lucide-react";
import type { Channel as StreamChannel, ChannelFilters, ChannelSort, LocalMessage } from "stream-chat";
import {
  Avatar,
  Channel,
  ChannelList,
  Chat,
  MessageInput,
  VirtualizedMessageList,
  MessageText,
  Window,
  useChatContext,
  useChannelStateContext,
  useMessageContext,
} from "stream-chat-react";
import type { ChannelPreviewUIComponentProps } from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useProfileAvatarUrl } from "@/hooks/use-profile-avatar-url";

function getPeerUser(channel: StreamChannel | undefined, selfId: string) {
  const members = channel?.state?.members;
  if (!members) return null;
  for (const m of Object.values(members)) {
    const id = m.user?.id;
    if (id && id !== selfId) return m.user ?? null;
  }
  return null;
}

function previewPlainText(preview: ReactNode, lastMessage?: LocalMessage) {
  const t = lastMessage?.text?.trim();
  if (t) return t;
  if (typeof preview === "string" || typeof preview === "number") return String(preview);
  return "";
}

function BahaygoChannelPreview(props: ChannelPreviewUIComponentProps & { selfId: string }) {
  const { channel, active, displayTitle, latestMessagePreview, lastMessage, onSelect, selfId } = props;
  const { setActiveChannel, channel: activeChannel } = useChatContext();
  const peer = getPeerUser(channel, selfId);
  const peerAvatar = useProfileAvatarUrl(peer?.id, peer?.image);
  const title = (displayTitle || peer?.name || peer?.id || "Conversation").trim();
  const preview = previewPlainText(latestMessagePreview, lastMessage);
  const timeSource = lastMessage?.created_at ?? channel.state?.last_message_at;
  const timeStr = timeSource
    ? new Date(timeSource).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const pinned = Boolean(channel.state?.membership?.pinned_at);
  const peerOnline = Boolean(peer?.online);

  const handleRowClick = (e: MouseEvent) => {
    onSelect?.(e);
  };

  const handleRowKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onSelect?.(e as unknown as MouseEvent);
  };

  const togglePin = async () => {
    try {
      if (pinned) await channel.unpin();
      else await channel.pin();
    } catch {
      // ignore permission / network errors
    }
  };

  const archiveChannel = async () => {
    try {
      await channel.archive();
      if (activeChannel?.cid === channel.cid) setActiveChannel(undefined);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => {
        try {
          void channel.watch();
        } catch {
          // ignore prewarm errors
        }
      }}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      className={cn(
        "group relative flex w-full cursor-pointer items-start gap-3 border-b border-[#2C2C2C]/8 px-3 py-3 text-left outline-none transition-colors hover:bg-black/[0.02] focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/40",
        active ? "bg-[#2C2C2C]/[0.06]" : "bg-transparent",
      )}
    >
      <span className="relative shrink-0">
        <Avatar
          image={peerAvatar}
          name={title}
          className="h-11 w-11 [&_.str-chat__avatar-fallback]:text-sm"
        />
        {peerOnline ? (
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#6B9E6E]"
            aria-hidden
          />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate font-semibold text-[#2C2C2C]">{title}</span>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-[#2C2C2C]/45">{timeStr}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {pinned ? <Pin className="h-3 w-3 shrink-0 text-[#6B9E6E]" aria-hidden /> : null}
          <p className="truncate text-[13px] leading-snug text-[#2C2C2C]/50">{preview || "No messages yet"}</p>
        </div>
      </div>
      <div
        className={cn(
          "flex shrink-0 flex-col gap-1 pt-0.5 transition-opacity",
          pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void togglePin();
          }}
          className="rounded-md p-1 text-[#2C2C2C]/40 hover:bg-black/[0.04] hover:text-[#6B9E6E]"
          aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
        >
          <Pin className={cn("h-4 w-4", pinned && "fill-[#6B9E6E] text-[#6B9E6E]")} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void archiveChannel();
          }}
          className="rounded-md p-1 text-[#2C2C2C]/40 hover:bg-black/[0.04] hover:text-red-500/80"
          aria-label="Archive conversation"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CustomMessage() {
  const { isMyMessage, message, groupStyles, firstOfGroup, readBy, deliveredTo } = useMessageContext();
  const mine = isMyMessage();
  const otherAvatar = useProfileAvatarUrl(
    mine ? undefined : message.user?.id,
    mine ? undefined : message.user?.image,
  );
  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const showName =
    !mine &&
    Boolean(message.user?.name) &&
    (firstOfGroup || groupStyles?.includes("top") || groupStyles?.includes("single"));
  const showAvatar =
    !mine && (firstOfGroup || groupStyles?.includes("top") || groupStyles?.includes("single"));
  const tight = Boolean(groupStyles?.includes("middle") || groupStyles?.includes("bottom"));
  const myId = message.user?.id;
  const othersRead = mine && (readBy ?? []).some((u) => u.id && u.id !== myId);
  const othersDelivered = mine && (deliveredTo ?? []).some((u) => u.id && u.id !== myId);
  let readReceipt: string | null = null;
  if (mine && createdAt) {
    if (othersRead) readReceipt = "✓✓";
    else if (othersDelivered || message.status === "received" || message.status === "sent") readReceipt = "✓";
  }

  return (
    <div
      className={`bhg-msg ${mine ? "bhg-msg--mine" : "bhg-msg--other"} ${tight ? "bhg-msg--tight" : ""}`}
      style={{
        display: "flex",
        flexDirection: mine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: showAvatar || mine ? "8px" : "6px",
        padding: tight ? "0 8px 2px" : "4px 8px",
        width: "100%",
        ...(mine ? {} : { paddingLeft: showAvatar ? 8 : 36 }),
      }}
    >
      {!mine && showAvatar ? (
        <div style={{ width: 28, height: 28, flexShrink: 0 }}>
          <Avatar image={otherAvatar} name={message.user?.name || message.user?.id} />
        </div>
      ) : null}
      <div className="bhg-msg__body">
        {showName ? <span className="bhg-msg__name">{message.user?.name}</span> : null}
        <div className="bhg-msg__bubble">
          <MessageText />
        </div>
        {createdAt ? (
          <span className="bhg-msg__time">
            {createdAt}
            {readReceipt ? <span className="bhg-msg__receipt"> {readReceipt}</span> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MessagingChatBody({
  filters,
  sort,
  userId,
  setActiveChannelOnMount = true,
  layoutClassName,
}: {
  filters: ChannelFilters;
  sort: ChannelSort;
  userId: string;
  setActiveChannelOnMount?: boolean;
  layoutClassName: string;
}) {
  const { channel, setActiveChannel, client } = useChatContext();
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const fn = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (setActiveChannelOnMount) return;
    if (!isDesktop || channel) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await client.queryChannels(filters, sort, {
          state: true,
          presence: true,
          limit: 30,
        });
        if (cancelled || !rows[0]) return;
        setActiveChannel(rows[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDesktop, channel, client, filters, sort, setActiveChannel, setActiveChannelOnMount]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const channelQueryOptions = useMemo(() => ({ messages: { limit: 20 } }), []);

  const peerUser = useMemo(() => getPeerUser(channel, userId), [channel, userId]);
  const peerAvatar = useProfileAvatarUrl(peerUser?.id, peerUser?.image);

  const peerOnline = useMemo(() => {
    const peerId = peerUser?.id;
    const members = channel?.state?.members;
    if (!peerId || !members) return false;
    const member = (members as Record<string, { user?: { id?: string; online?: boolean } }>)[peerId];
    if (member?.user?.id === peerId) return Boolean(member.user.online);
    return Object.values(members).some((m) => m.user?.id === peerId && Boolean(m.user?.online));
  }, [channel, peerUser?.id]);

  const handleBackToList = useCallback(() => {
    setActiveChannel(undefined);
    setMobileView("list");
  }, [setActiveChannel]);

  const channelRenderFilterFn = useCallback(
    (channels: StreamChannel[]) => {
      let out = channels;
      const q = listSearch.trim().toLowerCase();
      if (q) {
        out = out.filter((ch) => {
          const peer = getPeerUser(ch, userId);
          const chName = (ch.data as { name?: string } | undefined)?.name;
          const title = (peer?.name || peer?.id || chName || "").toLowerCase();
          const last = ch.state?.messages?.[ch.state.messages.length - 1]?.text?.toLowerCase() ?? "";
          return title.includes(q) || last.includes(q);
        });
      }
      if (unreadOnly) {
        out = out.filter((ch) => ch.countUnread() > 0);
      }
      return out;
    },
    [listSearch, unreadOnly, userId],
  );

  const Preview = useCallback(
    (p: ChannelPreviewUIComponentProps) => (
      <BahaygoChannelPreview
        {...p}
        selfId={userId}
        onSelect={(event) => {
          p.onSelect?.(event);
          if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
            setChannelLoading(true);
            window.setTimeout(() => setMobileView("thread"), 300);
          }
        }}
      />
    ),
    [userId],
  );

  return (
    <div className={cn(layoutClassName)}>
      <div
        className={`flex min-h-0 w-full shrink-0 flex-col border-b border-[rgba(0,0,0,0.06)] md:w-[320px] md:min-w-[320px] md:max-w-[320px] md:border-b-0 md:border-r md:border-[rgba(0,0,0,0.06)] ${
          mobileView === "thread" ? "max-md:hidden" : ""
        }`}
      >
        <div className="hidden shrink-0 border-b border-[rgba(0,0,0,0.06)] bg-white px-4 pb-4 pt-5 md:block">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">Messages</h2>
          <div className="mt-3 flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/35"
                aria-hidden
              />
              <input
                type="search"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] py-2 pl-9 pr-3 text-sm text-[#2C2C2C] outline-none ring-[#6B9E6E]/30 placeholder:text-[#2C2C2C]/40 focus:ring-2"
              />
            </label>
            <button
              type="button"
              title="Show unread only"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((v) => !v)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/55 transition-colors hover:bg-[#FAF8F4]",
                unreadOnly && "border-[#6B9E6E]/40 bg-[#6B9E6E]/10 text-[#6B9E6E]",
              )}
            >
              <ListFilter className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="border-b border-[rgba(0,0,0,0.06)] bg-white px-4 py-3 md:hidden">
          <span className="font-serif text-xl font-semibold text-[#2C2C2C]">Messages</span>
          <div className="mt-2 flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/35"
                aria-hidden
              />
              <input
                type="search"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] py-2 pl-9 pr-3 text-sm text-[#2C2C2C] outline-none placeholder:text-[#2C2C2C]/40"
              />
            </label>
            <button
              type="button"
              title="Show unread only"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((v) => !v)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/55",
                unreadOnly && "border-[#6B9E6E]/40 bg-[#6B9E6E]/10 text-[#6B9E6E]",
              )}
            >
              <ListFilter className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChannelList
            filters={filters}
            sort={sort}
            options={{ state: true, presence: true, limit: 30 }}
            setActiveChannelOnMount={setActiveChannelOnMount}
            Preview={Preview}
            channelRenderFilterFn={channelRenderFilterFn}
          />
        </div>
      </div>
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${mobileView === "list" ? "max-md:hidden" : ""}`}
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[rgba(0,0,0,0.06)] bg-[#FAF8F4] px-4 md:hidden">
            <button type="button" onClick={handleBackToList} aria-label="Back to conversations">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="relative">
              <Avatar
                image={peerAvatar}
                name={peerUser?.name || peerUser?.id || ""}
                className="h-8 w-8 [&_.str-chat__avatar-fallback]:text-sm"
              />
              {peerOnline ? (
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#6B9E6E]" aria-hidden />
              ) : null}
            </span>
            <span className="font-semibold">{peerUser?.name?.trim() || peerUser?.id || "Conversation"}</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Channel
              channelQueryOptions={channelQueryOptions}
              {...({
                newMessageStateUpdateThrottleInterval: 2000,
                stateUpdateThrottleInterval: 800,
              } as unknown as Record<string, unknown>)}
            >
              <Window>
                <MessagingThreadInner
                  channelLoading={channelLoading}
                  onLoaded={() => setChannelLoading(false)}
                  userId={userId}
                />
              </Window>
            </Channel>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagingThreadInner({
  channelLoading,
  onLoaded,
  userId,
}: {
  channelLoading: boolean;
  onLoaded: () => void;
  userId: string;
}) {
  const { loading, channel } = useChannelStateContext();
  const { setActiveChannel, channel: activeChannel } = useChatContext();

  useEffect(() => {
    if (!loading) onLoaded();
  }, [loading, onLoaded]);

  const peerUser = useMemo(() => getPeerUser(channel, userId), [channel, userId]);
  const peerAvatar = useProfileAvatarUrl(peerUser?.id, peerUser?.image);

  const peerOnline = useMemo(() => {
    const peerId = peerUser?.id;
    const members = channel?.state?.members;
    if (!peerId || !members) return false;
    const member = (members as Record<string, { user?: { id?: string; online?: boolean } }>)[peerId];
    if (member?.user?.id === peerId) return Boolean(member.user.online);
    return Object.values(members).some((m) => m.user?.id === peerId && Boolean(m.user?.online));
  }, [channel, peerUser?.id]);

  const archiveOpenChannel = useCallback(async () => {
    if (!channel) return;
    try {
      await channel.archive();
      if (activeChannel?.cid === channel.cid) setActiveChannel(undefined);
    } catch {
      // ignore
    }
  }, [activeChannel?.cid, channel, setActiveChannel]);

  if (channelLoading || loading) {
    return (
      <div className="flex h-full min-h-[240px] flex-1 items-center justify-center bg-[#FAF8F4]">
        <div className="h-20 w-20 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#FAF8F4]">
      <header className="hidden h-14 shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.06)] bg-[#FAF8F4] px-4 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <Avatar
              image={peerAvatar}
              name={peerUser?.name || peerUser?.id || "Conversation"}
              className="h-10 w-10 [&_.str-chat__avatar-fallback]:text-sm"
            />
            {peerOnline ? (
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#6B9E6E]"
                aria-hidden
              />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-semibold text-[#2C2C2C]">
              {peerUser?.name?.trim() || peerUser?.id || "Conversation"}
            </p>
            <p className="text-xs text-[#2C2C2C]/50">{peerOnline ? "Online" : "Offline"}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-black/[0.04]"
              aria-label="Conversation menu"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onClick={() => void archiveOpenChannel()}>Archive conversation</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="bhg-chat-scroll min-h-0 flex-1 overflow-y-auto">
        <VirtualizedMessageList
          Message={CustomMessage}
          shouldGroupByUser
          returnAllReadData
          maxTimeBetweenGroupedMessages={120000}
        />
      </div>
      <div className="shrink-0 border-t border-[rgba(0,0,0,0.06)] bg-[#FAF8F4]">
        <MessageInput />
      </div>
    </div>
  );
}

export type BahaygoMessagingInboxProps = {
  filters: ChannelFilters;
  sort: ChannelSort;
  /** Root grid area: height, overflow, background, columns */
  layoutClassName?: string;
  /** When false, first channel is selected on desktop via query (client pattern). */
  setActiveChannelOnMount?: boolean;
};

export function BahaygoMessagingInbox({
  filters,
  sort,
  layoutClassName = "flex h-[calc(100dvh-12rem)] w-full min-h-0 flex-col overflow-hidden bg-[#FAF8F4] md:h-[min(720px,calc(100dvh-9rem))] md:grid md:grid-cols-[320px_minmax(0,1fr)]",
  setActiveChannelOnMount = true,
}: BahaygoMessagingInboxProps) {
  const client = useStreamChat();
  const { user } = useAuth();

  if (!client || !user?.id) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white font-sans text-sm font-medium text-[#2C2C2C]/55">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="bahaygo-stream-chat flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#FAF8F4]">
      <style jsx global>{`
        .bhg-msg {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 4px 8px;
          width: 100%;
        }
        .bhg-msg--tight {
          padding-top: 0 !important;
          padding-bottom: 2px !important;
        }
        .bhg-msg--mine {
          flex-direction: row-reverse;
          justify-content: flex-start;
        }
        .bhg-msg--other {
          flex-direction: row;
          justify-content: flex-start;
        }
        .bhg-msg__body {
          display: flex;
          flex-direction: column;
          max-width: 80%;
        }
        .bhg-msg--mine .bhg-msg__body {
          align-items: flex-end;
        }
        .bhg-msg--other .bhg-msg__body {
          align-items: flex-start;
        }
        .bhg-msg__name {
          font-size: 11px;
          color: #999;
          margin-bottom: 2px;
          padding-left: 4px;
        }
        .bhg-msg__bubble {
          padding: 8px 12px;
          border-radius: 18px;
          font-size: 13px;
          line-height: 1.4;
        }
        .bhg-msg--mine .bhg-msg__bubble {
          background-color: #6b9e6e;
          color: white;
          border-bottom-right-radius: 4px;
        }
        .bhg-msg--other .bhg-msg__bubble {
          background-color: #f0f0f0;
          color: #2c2c2c;
          border-bottom-left-radius: 4px;
        }
        .bhg-msg__bubble p {
          margin: 0 !important;
        }
        .bhg-msg__time {
          font-size: 10px;
          color: #aaa;
          margin-top: 2px;
          padding-right: 4px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .bhg-msg__receipt {
          font-size: 10px;
          letter-spacing: -2px;
          color: rgba(255, 255, 255, 0.85);
        }
        .bhg-msg--other .bhg-msg__receipt {
          color: #aaa;
        }
        .bahaygo-stream-chat .str-chat__list {
          padding: 8px 0 !important;
        }
        .bahaygo-stream-chat .str-chat__li {
          padding: 0 !important;
        }
        .bahaygo-stream-chat .str-chat__channel-list {
          background: #faf8f4 !important;
          height: 100%;
          min-height: 0;
        }
        .bahaygo-stream-chat .str-chat__channel-list-messenger {
          height: 100%;
          min-height: 0;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .bahaygo-stream-chat .str-chat__channel-list-messenger__main {
          height: 100%;
          min-height: 0;
          overflow-y: auto;
        }
        .bahaygo-stream-chat .str-chat__channel {
          background: #faf8f4 !important;
        }
        .bahaygo-stream-chat .str-chat__message-input {
          background: #faf8f4 !important;
        }
        .bahaygo-stream-chat .str-chat__send-button {
          background-color: #6b9e6e !important;
          border-radius: 9999px !important;
        }
        .bahaygo-stream-chat .str-chat__send-button:hover {
          background-color: #5d8a60 !important;
        }
        .bahaygo-stream-chat .str-chat__send-button svg path {
          fill: white !important;
        }
        .bahaygo-stream-chat {
          background: #faf8f4 !important;
        }
        .bahaygo-stream-chat .str-chat__avatar-fallback {
          background-color: #6b9e6e !important;
          color: #fff !important;
          font-weight: 600 !important;
        }
      `}</style>
      <div className="flex min-h-0 flex-1 flex-col">
        <Chat client={client} theme="messaging light">
          <MessagingChatBody
            filters={filters}
            sort={sort}
            userId={user.id}
            setActiveChannelOnMount={setActiveChannelOnMount}
            layoutClassName={layoutClassName}
          />
        </Chat>
      </div>
    </div>
  );
}
