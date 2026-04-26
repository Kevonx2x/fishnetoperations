"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
        "group relative flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left outline-none transition-colors hover:bg-fg/[0.03] focus-visible:ring-2 focus-visible:ring-brand-sage/40",
        active ? "bg-fg/[0.06]" : "bg-transparent",
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
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface-panel bg-brand-sage"
            aria-hidden
          />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate font-semibold text-fg">{title}</span>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-fg/45">{timeStr}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {pinned ? <Pin className="h-3 w-3 shrink-0 text-brand-sage" aria-hidden /> : null}
          <p className="truncate text-[13px] leading-snug text-fg/50">{preview || "No messages yet"}</p>
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
          className="rounded-md p-1 text-fg/40 hover:bg-fg/[0.04] hover:text-brand-sage"
          aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
        >
          <Pin className={cn("h-4 w-4", pinned && "fill-brand-sage text-brand-sage")} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void archiveChannel();
          }}
          className="rounded-md p-1 text-fg/40 hover:bg-fg/[0.04] hover:text-red-500/80"
          aria-label="Archive conversation"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CustomMessage() {
  const { messages: channelMessages } = useChannelStateContext("CustomMessage");
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
  const messageIndex = useMemo(
    () => (channelMessages ? channelMessages.findIndex((m) => m.id === message.id) : -1),
    [channelMessages, message.id],
  );
  const prevMessage = messageIndex > 0 && channelMessages ? channelMessages[messageIndex - 1] : undefined;
  const currentSenderId = message.user?.id;
  const prevSenderId = prevMessage?.user?.id;
  const sameSenderAsPrevious =
    Boolean(currentSenderId && prevSenderId && currentSenderId === prevSenderId);
  const marginGap = useMemo((): "start" | "same" | "turn" => {
    if (messageIndex <= 0) return "start";
    if (sameSenderAsPrevious) return "same";
    return "turn";
  }, [messageIndex, sameSenderAsPrevious]);
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
      className={cn(
        "bhg-msg",
        mine ? "bhg-msg--mine" : "bhg-msg--other",
        tight && "bhg-msg--tight",
        marginGap === "start" && "bhg-msg--gap-start",
        marginGap === "same" && "bhg-msg--gap-same",
        marginGap === "turn" && "bhg-msg--gap-turn",
        !mine && (showAvatar ? "pl-0" : "pl-12"),
        "w-full",
      )}
    >
      {!mine && showAvatar ? (
        <div className="h-9 w-9 shrink-0">
          <Avatar
            className="h-9 w-9 [&_.str-chat__avatar-fallback]:text-sm"
            image={otherAvatar}
            name={message.user?.name || message.user?.id}
          />
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
        className={`flex h-full min-h-0 w-full shrink-0 flex-col border-b border-subtle md:w-[320px] md:min-w-[320px] md:max-w-[320px] md:border-b-0 md:border-r md:border-subtle ${
          mobileView === "thread" ? "max-md:hidden" : ""
        }`}
      >
        <div className="hidden shrink-0 border-b border-subtle bg-surface-page px-4 pb-4 pt-5 md:block">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-fg">Messages</h2>
          <div className="mt-3 flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/35"
                aria-hidden
              />
              <input
                type="search"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-full border border-fg/10 bg-surface-page py-2 pl-9 pr-3 text-sm text-fg outline-none ring-brand-sage/30 placeholder:text-fg/40 focus:ring-2"
              />
            </label>
            <button
              type="button"
              title="Show unread only"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((v) => !v)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fg/10 bg-surface-panel text-fg/55 transition-colors hover:bg-surface-page",
                unreadOnly && "border-brand-sage/40 bg-brand-sage/10 text-brand-sage",
              )}
            >
              <ListFilter className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="border-b border-subtle bg-surface-page px-4 py-3 md:hidden">
          <span className="font-serif text-xl font-semibold text-fg">Messages</span>
          <div className="mt-2 flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/35"
                aria-hidden
              />
              <input
                type="search"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-full border border-fg/10 bg-surface-page py-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-fg/40"
              />
            </label>
            <button
              type="button"
              title="Show unread only"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((v) => !v)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-fg/10 bg-surface-panel text-fg/55",
                unreadOnly && "border-brand-sage/40 bg-brand-sage/10 text-brand-sage",
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
        className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${mobileView === "list" ? "max-md:hidden" : ""}`}
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-subtle bg-surface-page px-4 py-3 md:hidden">
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
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-brand-sage" aria-hidden />
              ) : null}
            </span>
            <span className="text-lg font-bold text-fg">
              {peerUser?.name?.trim() || peerUser?.id || "Conversation"}
            </span>
          </div>
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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
      <aside
        className="hidden h-full max-h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-subtle bg-surface-page max-md:hidden md:flex"
        aria-label="Conversation sidebar"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <h2 className="text-sm font-semibold text-fg/45">Conversation</h2>
          <p className="mt-1 truncate text-base font-bold tracking-tight text-fg/50">
            {channel ? peerUser?.name?.trim() || peerUser?.id || "—" : "—"}
          </p>
        </div>
      </aside>
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
  const { loading, channel, messages } = useChannelStateContext();
  const { setActiveChannel, channel: activeChannel } = useChatContext();
  const listScrollHostRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages?.length ? messages[messages.length - 1]?.id : null;

  useEffect(() => {
    if (!loading) onLoaded();
  }, [loading, onLoaded]);

  /** Stream Virtuoso followOutput can miss edge cases; keep the list scrolled when the tail message changes (send/receive). */
  useLayoutEffect(() => {
    if (channelLoading || loading) return;
    if (!lastMessageId) return;
    const root = listScrollHostRef.current;
    if (!root) return;
    const list =
      root.querySelector<HTMLElement>(".str-chat__message-list") ??
      root.querySelector<HTMLElement>(".str-chat__message-list-scroll");
    if (!list) return;
    const scrollToEnd = () => {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToEnd);
    });
  }, [channelLoading, loading, lastMessageId]);

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
      <div className="flex h-full min-h-[240px] flex-1 items-center justify-center bg-surface-page">
        <div className="h-20 w-20 animate-pulse rounded-2xl bg-fg/[0.06]" />
      </div>
    );
  }

  return (
    <div className="bhg-chat-panel flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-surface-page">
      <header className="hidden shrink-0 items-center justify-between border-b border-subtle bg-surface-page px-4 py-4 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <Avatar
              image={peerAvatar}
              name={peerUser?.name || peerUser?.id || "Conversation"}
              className="h-10 w-10 [&_.str-chat__avatar-fallback]:text-sm"
            />
            {peerOnline ? (
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface-panel bg-brand-sage"
                aria-hidden
              />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-fg">
              {peerUser?.name?.trim() || peerUser?.id || "Conversation"}
            </p>
            <p className="text-xs text-fg/50">{peerOnline ? "Online" : "Offline"}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full p-2 text-fg/55 hover:bg-fg/[0.04]"
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
      <div ref={listScrollHostRef} className="bhg-chat-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <VirtualizedMessageList
          Message={CustomMessage}
          shouldGroupByUser
          returnAllReadData
          maxTimeBetweenGroupedMessages={120000}
          stickToBottomScrollBehavior="smooth"
          suppressAutoscroll={false}
          additionalVirtuosoProps={{
            className: "str-chat__message-list-scroll str-chat__message-list",
          }}
        />
      </div>
      <MessageInput />
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
  layoutClassName = "flex h-[calc(100dvh-12rem)] w-full min-h-0 flex-1 flex-col overflow-hidden bg-surface-page md:h-full md:max-h-full md:min-h-0 md:grid md:grid-cols-[320px_minmax(0,1fr)_300px]",
  setActiveChannelOnMount = true,
}: BahaygoMessagingInboxProps) {
  const client = useStreamChat();
  const { user } = useAuth();

  if (!client || !user?.id) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-fg/10 bg-surface-panel font-sans text-sm font-medium text-fg/55">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="bahaygo-stream-chat flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface-page">
      <div className="flex h-full min-h-0 flex-1 flex-col">
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
