"use client";

import { useMemo } from "react";
import { Channel, ChannelList, Chat, MessageInput, MessageList, Window } from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useAuth } from "@/contexts/auth-context";
import { useStreamChat } from "@/components/chat/stream-chat-provider";

export function ClientChatView(_props: {
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
    <div className="bahaygo-stream-chat h-[600px] overflow-hidden rounded-2xl border border-[#2C2C2C]/10 shadow-sm">
      <style jsx global>{`
        .bahaygo-stream-chat {
          --str-chat__primary-color: #6b9e6e;
          --str-chat__active-primary-color: #5d8a60;
          --str-chat__background-color: #faf8f4;
          --str-chat__secondary-background-color: #ffffff;
          --str-chat__own-message-bubble-background-color: #6b9e6e;
          --str-chat__own-message-bubble-color: #ffffff;
          --str-chat__font-family: Inter, sans-serif;
        }
        .bahaygo-stream-chat .str-chat__avatar {
          display: flex !important;
          visibility: visible !important;
        }
        .bahaygo-stream-chat .str-chat__avatar img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 9999px !important;
        }
        .bahaygo-stream-chat .str-chat__input-flat {
          min-height: 56px !important;
          padding: 12px 16px !important;
          font-size: 15px !important;
        }
        .bahaygo-stream-chat .str-chat__textarea textarea {
          min-height: 40px !important;
          font-size: 15px !important;
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
                <MessageList />
                <MessageInput />
              </Window>
            </Channel>
          </div>
        </div>
      </Chat>
    </div>
  );
}
