"use client";

import {
  ArrowLeft,
  MoreVertical,
  Phone,
  Search,
  Video,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { cn } from "@/lib/utils";
import type {
  MessengerConversation,
  MessengerMessage,
  MessengerSendPayload,
} from "../types";
import { MessengerAvatar } from "./avatar";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

const NEAR_BOTTOM_THRESHOLD_PX = 100;

type Props = {
  conversation: MessengerConversation | null;
  showBack?: boolean;
  onBack?: () => void;
  onSend?: (payload: MessengerSendPayload) => void;
  className?: string;
};

function lastRealMessage(messages: MessengerMessage[]): MessengerMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (!m.dateDivider) return m;
  }
  return undefined;
}

export function ChatThread({ conversation, showBack, onBack, onSend, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const pendingThreadScrollRef = useRef(false);
  const forceScrollOnSendRef = useRef(false);
  const prevLastMessageIdRef = useRef<string | undefined>(undefined);

  const conversationId = conversation?.id;
  const messages = conversation?.messages ?? [];
  const messagesLoading = Boolean(conversation?.messagesLoading);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  const clampScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    if (el.scrollTop > maxScrollTop) {
      el.scrollTop = maxScrollTop;
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const run = () => {
      const el = scrollRef.current;
      if (!el) return;
      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTo({ top: maxScrollTop, behavior });
      clampScrollPosition();
    };
    requestAnimationFrame(run);
  }, [clampScrollPosition]);

  const handleScroll = useCallback(() => {
    clampScrollPosition();
    nearBottomRef.current = isNearBottom();
  }, [clampScrollPosition, isNearBottom]);

  const handleAttachmentImageLoad = useCallback(() => {
    if (nearBottomRef.current || isNearBottom()) {
      scrollToBottom("auto");
      nearBottomRef.current = true;
    }
  }, [isNearBottom, scrollToBottom]);

  const handleSend = useCallback(
    (payload: MessengerSendPayload) => {
      forceScrollOnSendRef.current = true;
      nearBottomRef.current = true;
      onSend?.(payload);
    },
    [onSend],
  );

  useEffect(() => {
    if (!conversationId) return;
    pendingThreadScrollRef.current = true;
    nearBottomRef.current = true;
    prevLastMessageIdRef.current = undefined;
  }, [conversationId]);

  useLayoutEffect(() => {
    if (!conversationId || messagesLoading) return;

    if (pendingThreadScrollRef.current) {
      pendingThreadScrollRef.current = false;
      scrollToBottom("auto");
      nearBottomRef.current = true;
      prevLastMessageIdRef.current = lastRealMessage(messages)?.id;
      return;
    }

    const last = lastRealMessage(messages);
    const lastId = last?.id;
    if (!lastId) return;

    const prevLastId = prevLastMessageIdRef.current;
    if (prevLastId === lastId) return;

    prevLastMessageIdRef.current = lastId;

    if (prevLastId === undefined) return;

    if (forceScrollOnSendRef.current) {
      forceScrollOnSendRef.current = false;
      scrollToBottom("auto");
      nearBottomRef.current = true;
      return;
    }

    if (last.sent) {
      scrollToBottom("smooth");
      nearBottomRef.current = true;
      return;
    }

    if (nearBottomRef.current || isNearBottom()) {
      scrollToBottom("smooth");
      nearBottomRef.current = true;
    }
  }, [conversationId, messagesLoading, messages, scrollToBottom, isNearBottom]);

  if (!conversation) {
    return (
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center bg-[#FAF8F4] text-center",
          className,
        )}
      >
        <p className="font-serif text-lg font-semibold text-[#2C2C2C]/80">
          Select a conversation
        </p>
        <p className="mt-1 text-sm text-[#888888]">Choose a thread from the list to start chatting.</p>
      </section>
    );
  }

  const { participant, typing } = conversation;

  return (
    <section
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col bg-[#FAF8F4]", className)}
      aria-label={`Chat with ${participant.name}`}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-[#2C2C2C]/8 bg-[#FAF8F4] px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2C2C2C] hover:bg-[#2C2C2C]/5 md:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}

        <MessengerAvatar
          initials={participant.initials}
          imageUrl={participant.avatarUrl}
          online={participant.online}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-[17px] font-semibold text-[#2C2C2C]">
            {participant.name}
          </h2>
          <p className="text-xs text-[#888888]">
            {participant.online ? (
              <span className="text-[#6B9E6E]">Active now</span>
            ) : (
              "Offline"
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {[
            { icon: Search, label: "Search in conversation" },
            { icon: Phone, label: "Call" },
            { icon: Video, label: "Video call" },
            { icon: MoreVertical, label: "More options" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C]"
              aria-label={label}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
      >
        <div className="mt-auto w-full pt-4">
          {messagesLoading ? (
            <p className="py-8 text-center text-sm font-medium text-[#888888]">Loading messages…</p>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onAttachmentImageLoad={handleAttachmentImageLoad}
              />
            ))
          )}
          {!messagesLoading && typing ? <TypingIndicator /> : null}
          <div ref={bottomAnchorRef} className="h-px w-full shrink-0" aria-hidden />
        </div>
      </div>

      <Composer onSend={handleSend} />
    </section>
  );
}
