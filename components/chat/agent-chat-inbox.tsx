"use client";

import { useMemo } from "react";
import {
  Avatar,
  Channel,
  ChannelList,
  Chat,
  MessageInput,
  MessageList,
  MessageText,
  Window,
  useMessageContext,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";

function CustomMessage() {
  const { isMyMessage, message } = useMessageContext();
  const mine = isMyMessage();
  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`bhg-msg ${mine ? 'bhg-msg--mine' : 'bhg-msg--other'}`}>
      {!mine && (
        <Avatar image={message.user?.image} name={message.user?.name || message.user?.id} />
      )}
      <div className="bhg-msg__body">
        {!mine && message.user?.name && (
          <span className="bhg-msg__name">{message.user.name}</span>
        )}
        <div className="bhg-msg__bubble">
          <MessageText />
        </div>
        {createdAt && <span className="bhg-msg__time">{createdAt}</span>}
      </div>
    </div>
  );
}

export function AgentChatInbox(_props: {
  /** Custom channel id (not cid) to select when opening from a deep link */
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
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white font-sans text-sm font-medium text-[#2C2C2C]/55">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="bahaygo-stream-chat h-[600px] overflow-hidden rounded-2xl border border-[#2C2C2C]/10 shadow-sm">
      <style jsx global>{`
        .bhg-msg {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 2px 12px;
          width: 100%;
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
          max-width: 65%;
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
          font-family: Inter, sans-serif;
        }
        .bhg-msg__bubble {
          padding: 8px 14px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.5;
          font-family: Inter, sans-serif;
        }
        .bhg-msg--mine .bhg-msg__bubble {
          background-color: #6B9E6E;
          color: white;
          border-bottom-right-radius: 4px;
        }
        .bhg-msg--other .bhg-msg__bubble {
          background-color: #F0F0F0;
          color: #2C2C2C;
          border-bottom-left-radius: 4px;
        }
        .bhg-msg__bubble p {
          margin: 0 !important;
        }
        .bhg-msg__time {
          font-size: 10px;
          color: #aaa;
          margin-top: 2px;
          font-family: Inter, sans-serif;
        }
        .bahaygo-stream-chat .str-chat__list {
          padding: 8px 0 !important;
        }
        .bahaygo-stream-chat .str-chat__li {
          padding: 0 !important;
        }
      `}</style>
      <Chat client={client} theme="messaging light">
        <div className="flex h-[600px]">
          <div className="w-[300px] shrink-0 border-r border-[#2C2C2C]/10">
            <ChannelList
              filters={filters}
              sort={sort}
              options={{ state: true, presence: true, limit: 30 }}
            />
          </div>
          <div className="flex-1">
            <Channel>
              <Window>
                <MessageList Message={CustomMessage} />
                <MessageInput />
              </Window>
            </Channel>
          </div>
        </div>
      </Chat>
    </div>
  );
}
