"use client";

import { useMemo, useState } from "react";
import {
  Channel,
  ChannelList,
  Chat,
  MessageInput,
  MessageList,
  Window,
  useChannelStateContext,
  useMessageInputContext,
} from "stream-chat-react";
import type { ChannelPreviewUIComponentProps, MessageUIComponentProps } from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";
import { cn } from "@/lib/utils";

function relTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return formatDistanceToNow(dt, { addSuffix: true });
}

type ChannelPropertyMeta = {
  property_id?: string | null;
  property_name?: string | null;
  property_price?: string | null;
  property_image?: string | null;
  property_location?: string | null;
};

function PropertyContextCard() {
  const { channel } = useChannelStateContext();
  const data = (channel?.data ?? {}) as ChannelPropertyMeta;
  const name = (data.property_name ?? "").trim();
  const price = (data.property_price ?? "").trim();
  const image = (data.property_image ?? "").trim();
  const location = (data.property_location ?? "").trim();

  if (!name && !price && !image && !location) return null;

  return (
    <div className="border-b border-[#2C2C2C]/10 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-lg bg-[#FAF8F4] ring-1 ring-black/5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          {name ? <p className="truncate font-semibold text-gray-900">{name}</p> : null}
          {price ? <p className="mt-0.5 text-sm font-semibold text-[#D4A843]">{price}</p> : null}
          {location ? <p className="mt-0.5 text-xs text-gray-500">{location}</p> : null}
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
  const lastAt = relTime(channel.state?.last_message_at as Date | string | null | undefined);
  const n = unread ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-b border-[#2C2C2C]/10 px-4 py-3 text-left transition hover:bg-white/80",
        active ? "bg-white" : "bg-transparent",
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
          <p className="truncate text-sm font-semibold text-[#2C2C2C]">{name}</p>
          {lastAt ? <span className="shrink-0 text-[11px] font-medium text-[#2C2C2C]/45">{lastAt}</span> : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-[#2C2C2C]/65">{latestMessagePreview}</p>
          {n > 0 ? <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E]" /> : null}
        </div>
      </div>
    </button>
  );
}

function AirbnbMessage(props: MessageUIComponentProps) {
  const { message } = props;
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const mine = message.user?.id === currentUserId;

  const { channel } = useChannelStateContext();
  const messages = channel?.state?.messages ?? [];
  const idx = messages.findIndex((m) => m.id && message.id && m.id === message.id);
  const prev = idx > 0 ? messages[idx - 1] : null;
  const t = message.created_at ? new Date(message.created_at as string | Date) : null;
  const prevT = prev?.created_at ? new Date(prev.created_at as string | Date) : null;
  const showTime =
    Boolean(t) &&
    (!prevT || Math.abs((t as Date).getTime() - (prevT as Date).getTime()) > 30 * 60 * 1000);

  const otherAvatar = message.user?.image;
  const text = (message.text ?? "").trim();

  if (!text) return null;

  return (
    <div className={cn("px-4", mine ? "flex justify-end" : "flex justify-start")}>
      <div className={cn("max-w-[82%]", mine ? "items-end" : "items-start")}>
        {showTime && t ? (
          <div className="mb-2 text-center text-[11px] font-medium text-[#2C2C2C]/45">
            {relTime(t)}
          </div>
        ) : null}
        <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
          {!mine ? (
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gray-200">
              {otherAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={otherAvatar} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
          ) : null}
          <div
            className={cn(
              "whitespace-pre-wrap px-4 py-2 text-sm leading-relaxed",
              mine
                ? "rounded-2xl rounded-br-sm bg-[#6B9E6E] text-white"
                : "rounded-2xl rounded-bl-sm bg-gray-100 text-gray-800",
            )}
          >
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

function AirbnbMessageInput() {
  const { text, handleChange, handleSubmit } = useMessageInputContext();
  return (
    <form
      className="flex items-center gap-2 border-t border-[#2C2C2C]/10 bg-white px-3 py-3"
    >
      <input
        value={text}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        placeholder="Type a message"
        className="h-11 flex-1 rounded-full border border-[#2C2C2C]/15 bg-white px-4 text-sm font-medium text-[#2C2C2C] outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/30"
      />
      <button
        type="button"
        onClick={() => {
          void handleSubmit();
        }}
        className="inline-flex h-11 items-center justify-center rounded-full bg-[#6B9E6E] px-5 text-sm font-semibold text-white hover:bg-[#5d8a60]"
      >
        Send
      </button>
    </form>
  );
}

export function ClientChatView({
  initialChannelId,
}: {
  initialChannelId?: string | null;
}) {
  const client = useStreamChat();
  const { user } = useAuth();
  const [q, setQ] = useState("");

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
        <div className="grid min-h-[70vh] overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-sm md:grid-cols-[360px_1fr]">
          <div className="border-b border-[#2C2C2C]/10 bg-white md:border-b-0 md:border-r">
            <div className="p-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="h-11 w-full rounded-full border border-[#2C2C2C]/15 bg-[#FAF8F4] px-4 text-sm font-medium text-[#2C2C2C] outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/30"
              />
            </div>
            <div className="max-h-[calc(70vh-76px)] overflow-y-auto">
              <ChannelList
                filters={filters}
                sort={sort}
                options={{ state: true, presence: true, limit: 30 }}
                customActiveChannel={initialChannelId ?? undefined}
                Preview={ClientChannelPreview}
                channelRenderFilterFn={(channels) => {
                  const qq = q.trim().toLowerCase();
                  if (!qq) return channels;
                  return channels.filter((c) => {
                    const members = Object.values(c.state?.members ?? {});
                    const other = members.find((m) => m.user?.id && m.user.id !== user.id);
                    const name = String(other?.user?.name ?? "").toLowerCase();
                    const last = String(c.state?.messageSets?.[0]?.messages?.slice(-1)[0]?.text ?? "").toLowerCase();
                    return name.includes(qq) || last.includes(qq);
                  });
                }}
                EmptyStateIndicator={() => (
                  <p className="px-4 py-10 text-center text-sm font-medium text-[#2C2C2C]/55">
                    No conversations yet. Message an agent from their profile.
                  </p>
                )}
              />
            </div>
          </div>

          <div className="min-h-[70vh] bg-[#FAF8F4]">
            <Channel EmptyPlaceholder={<ClientEmptyThread />}>
              <Window>
                <PropertyContextCard />
                <MessageList Message={AirbnbMessage} />
                <MessageInput focus Input={AirbnbMessageInput} />
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
