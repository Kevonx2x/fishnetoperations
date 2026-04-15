"use client";

import { useMemo } from "react";
import {
  Channel,
  ChannelList,
  Chat,
  MessageInput,
  MessageList,
  Window,
  useChannelStateContext,
} from "stream-chat-react";
import type { ChannelPreviewUIComponentProps } from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";
import { cn } from "@/lib/utils";

function ClientThreadHeader({ currentUserId }: { currentUserId: string }) {
  const { channel } = useChannelStateContext();
  const members = Object.values(channel?.state?.members ?? {});
  const other = members.find((m) => m.user?.id && m.user.id !== currentUserId);
  const title = other?.user?.name ?? "Conversation";
  const image = other?.user?.image;
  const propertyTitle =
    channel?.data && typeof channel.data === "object" && "property_title" in channel.data
      ? String((channel.data as { property_title?: string }).property_title ?? "").trim()
      : "";

  return (
    <div className="border-b border-[#2C2C2C]/10 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]/15 ring-1 ring-black/5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-sm font-bold text-[#2C2C2C]">
              {title.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold leading-tight text-[#2C2C2C]">{title}</h2>
          {propertyTitle ? (
            <p className="mt-0.5 font-sans text-xs font-medium text-[#2C2C2C]/55">{propertyTitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ClientChannelPreview(props: ChannelPreviewUIComponentProps) {
  const { channel, active, unread, latestMessagePreview, onSelect } = props;
  const { user } = useAuth();
  const uid = user?.id;
  const members = Object.values(channel.state?.members ?? {});
  const other = members.find((m) => m.user?.id && m.user.id !== uid);
  const name = other?.user?.name ?? "Agent";
  const image = other?.user?.image;
  const lastAt = channel.state?.last_message_at
    ? new Date(channel.state.last_message_at as string | Date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const n = unread ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-b border-[#2C2C2C]/10 px-3 py-3 text-left transition hover:bg-white/80",
        active ? "bg-[#6B9E6E]/10" : "bg-transparent",
      )}
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]/15 ring-1 ring-black/5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-serif text-sm font-bold text-[#2C2C2C]">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-serif text-sm font-semibold text-[#2C2C2C]">{name}</p>
          {lastAt ? <span className="shrink-0 text-[10px] font-medium text-[#2C2C2C]/45">{lastAt}</span> : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate font-sans text-xs text-[#2C2C2C]/65">{latestMessagePreview}</p>
          {n > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] px-1.5 text-[10px] font-bold text-white">
              {n > 99 ? "99+" : n}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function ClientChatView({
  initialChannelId,
}: {
  initialChannelId?: string | null;
}) {
  const client = useStreamChat();
  const { user } = useAuth();

  const filters = useMemo(() => {
    if (!user?.id) return { type: "messaging" as const, members: { $in: [] as string[] } };
    return {
      type: "messaging" as const,
      members: { $in: [user.id] },
    };
  }, [user?.id]);

  const sort = useMemo(() => ({ last_message_at: -1 as const }), []);

  if (!client || !user?.id) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white font-sans text-sm font-medium text-[#2C2C2C]/55">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="bahaygo-stream-chat-client font-sans text-[#2C2C2C]">
      <style jsx global>{`
        .bahaygo-stream-chat-client {
          --str-chat__primary-color: #6b9e6e;
          --str-chat__active-primary-color: #5d8a60;
          --str-chat__background-color: #faf8f4;
          --str-chat__secondary-background-color: #ffffff;
          --str-chat__own-message-bubble-color: #6b9e6e;
        }
        .bahaygo-stream-chat-client .str-chat__channel-list {
          background: #faf8f4;
        }
        .bahaygo-stream-chat-client .str-chat__main-panel {
          background: #faf8f4;
        }
        .bahaygo-stream-chat-client .str-chat__input-flat {
          background: #fff;
          border-radius: 1rem;
        }
      `}</style>

      <Chat client={client} theme="messaging light">
        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-sm">
          <div className="max-h-[42vh] w-full flex-shrink-0 overflow-hidden border-b border-[#2C2C2C]/10 md:max-h-[min(60vh,420px)]">
            <p className="bg-[#FAF8F4] px-3 py-2 font-serif text-xs font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/45">
              Your agents
            </p>
            <div className="max-h-[min(38vh,360px)] overflow-y-auto">
              <ChannelList
                filters={filters}
                sort={sort}
                options={{ state: true, presence: true, limit: 30 }}
                customActiveChannel={initialChannelId ?? undefined}
                Preview={ClientChannelPreview}
                EmptyStateIndicator={() => (
                  <p className="px-3 py-6 text-center font-sans text-sm text-[#2C2C2C]/55">
                    No conversations yet. Message an agent from their profile.
                  </p>
                )}
              />
            </div>
          </div>

          <div className="min-h-[280px] flex-1 bg-[#FAF8F4]">
            <Channel EmptyPlaceholder={<ClientEmptyThread />}>
              <Window>
                <ClientThreadHeader currentUserId={user.id} />
                <MessageList />
                <MessageInput focus />
              </Window>
            </Channel>
          </div>
        </div>
      </Chat>
    </div>
  );
}

function ClientEmptyThread() {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-lg font-semibold text-[#2C2C2C]">Select a conversation</p>
      <p className="mt-2 font-sans text-sm text-[#2C2C2C]/55">Tap an agent above to open the thread.</p>
    </div>
  );
}
