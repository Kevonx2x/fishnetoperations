import { cn } from "@/lib/utils";
import type { MessengerConversation } from "../types";
import { MessengerAvatar } from "./avatar";

type Props = {
  conversation: MessengerConversation;
  active: boolean;
  onSelect: () => void;
};

export function ConversationRow({ conversation, active, onSelect }: Props) {
  const { participant, lastMessage, timestamp, unread, typing } = conversation;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 items-center gap-3 border-b border-[#2C2C2C]/6 px-4 py-3.5 text-left transition-colors",
        active ? "bg-[#6B9E6E]/10" : "hover:bg-[#2C2C2C]/[0.03]",
      )}
    >
      <MessengerAvatar
        initials={participant.initials}
        online={participant.online}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-serif text-[15px] font-semibold text-[#2C2C2C]">
            {participant.name}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-[#888888]">{timestamp}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13px]",
              unread > 0 ? "font-semibold text-[#2C2C2C]" : "text-[#888888]",
            )}
          >
            {typing ? (
              <span className="italic text-[#6B9E6E]">typing…</span>
            ) : (
              lastMessage
            )}
          </p>
          {unread > 0 ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#D4A843] px-1.5 text-[10px] font-bold text-white">
              {unread}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
