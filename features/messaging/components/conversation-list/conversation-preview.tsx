import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useCallback } from "react";
import { Archive, Pin } from "lucide-react";
import type { Channel as StreamChannel, LocalMessage } from "stream-chat";
import { Avatar, useChatContext } from "stream-chat-react";
import type { ChannelPreviewUIComponentProps } from "stream-chat-react";

import { cn } from "@/lib/utils";
import { getPeerUser, previewPlainText } from "@/features/messaging/lib/channel-helpers";

function toTimeString(timeSource: unknown): string {
  if (!timeSource) return "";
  const t = new Date(String(timeSource)).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getTitle(params: { displayTitle?: string; peerName?: string; peerId?: string; fallback?: string }) {
  const t = (params.displayTitle || params.peerName || params.peerId || params.fallback || "Conversation").trim();
  return t || "Conversation";
}

export function ConversationPreview(
  props: ChannelPreviewUIComponentProps & { selfId: string; onChannelListMutate?: () => void },
) {
  const { channel, active, displayTitle, latestMessagePreview, lastMessage, onSelect, selfId } = props;
  const { setActiveChannel, channel: activeChannel } = useChatContext();

  const peer = getPeerUser(channel, selfId);
  const peerAvatar = peer?.image;
  const title = getTitle({ displayTitle, peerName: peer?.name, peerId: peer?.id });
  const preview = previewPlainText(latestMessagePreview as ReactNode, lastMessage as LocalMessage | undefined);
  const timeSource = (lastMessage as LocalMessage | undefined)?.created_at ?? channel.state?.last_message_at;
  const timeStr = toTimeString(timeSource);
  const pinned = Boolean(channel.state?.membership?.pinned_at);
  const peerOnline = Boolean(peer?.online);

  const activateChannel = useCallback(() => {
    if (activeChannel?.cid !== channel.cid) setActiveChannel(channel);
  }, [activeChannel?.cid, channel, setActiveChannel]);

  const handleRowClick = (e: MouseEvent) => {
    activateChannel();
    onSelect?.(e);
  };

  const handleRowKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    activateChannel();
    onSelect?.(e as unknown as MouseEvent);
  };

  const togglePin = async () => {
    try {
      if (pinned) await channel.unpin();
      else await channel.pin();
      props.onChannelListMutate?.();
    } catch {
      // ignore permission / network errors
    }
  };

  const archiveChannel = async () => {
    try {
      await channel.archive();
      if (activeChannel?.cid === channel.cid) setActiveChannel(undefined);
      props.onChannelListMutate?.();
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
        <Avatar image={peerAvatar} name={title} className="h-11 w-11 [&_.str-chat__avatar-fallback]:text-sm" />
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

