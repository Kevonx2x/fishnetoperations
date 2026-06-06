"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { useConversations } from "../hooks/use-conversations";
import { useMarkConversationRead } from "../hooks/use-mark-conversation-read";
import { useMessages } from "../hooks/use-messages";
import type { MessengerConversation, MessengerMessage } from "../types";
import { MessengerCore } from "./messenger-core";

const MARK_READ_DEBOUNCE_MS = 400;

function threadMessageSignature(messages: MessengerMessage[]): string {
  const rows = messages.filter(
    (m) => !m.dateDivider && !m.id.startsWith("optimistic-"),
  );
  const last = rows[rows.length - 1];
  return last ? last.id : "";
}

function isThreadFocused(): boolean {
  if (typeof document === "undefined") return true;
  return document.hasFocus() && document.visibilityState === "visible";
}

type Props = {
  /** Shown when signed out. Defaults to client copy. */
  signedOutMessage?: string;
};

/**
 * Role-agnostic in-house messenger data host — wires hooks to MessengerCore.
 * Works for any user id (client, agent, landlord, etc.).
 */
export function MessengerHost({
  signedOutMessage = "Sign in to view your messages.",
}: Props) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("c")?.trim() || undefined;
  const deepLinkRefreshDone = useRef(false);
  const markReadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { conversations, loading, error, refresh, patchConversation } = useConversations(userId);
  const markRead = useMarkConversationRead(userId);

  const [activeId, setActiveId] = useState<string | undefined>(deepLinkId);

  useEffect(() => {
    if (!deepLinkId || !userId || deepLinkRefreshDone.current) return;
    deepLinkRefreshDone.current = true;
    void refresh();
  }, [deepLinkId, userId, refresh]);

  useEffect(() => {
    if (!conversations.length) {
      if (!deepLinkId) setActiveId(undefined);
      return;
    }

    if (deepLinkId && conversations.some((c) => c.id === deepLinkId)) {
      setActiveId(deepLinkId);
      return;
    }

    if (!activeId || !conversations.some((c) => c.id === activeId)) {
      setActiveId(deepLinkId ?? conversations[0]!.id);
    }
  }, [conversations, activeId, deepLinkId]);

  const activeMeta = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );

  const handleMessageInserted = useCallback(() => {
    void refresh();
  }, [refresh]);

  const { messages, loading: messagesLoading, sendMessage } = useMessages({
    conversationId: activeId,
    userId,
    peerLastReadAt: activeMeta?.peerLastReadAt,
    onMessageInserted: handleMessageInserted,
  });

  const applyMarkRead = useCallback(
    (conversationId: string) => {
      void markRead(conversationId).then((watermark) => {
        if (watermark) {
          patchConversation(conversationId, { unread: 0, myLastReadAt: watermark });
        }
      });
    },
    [markRead, patchConversation],
  );

  useEffect(() => {
    if (!activeId) return;
    applyMarkRead(activeId);
  }, [activeId, applyMarkRead]);

  const activeMessageSignature = useMemo(
    () => threadMessageSignature(messages),
    [messages],
  );

  useEffect(() => {
    if (!activeId || messagesLoading || !activeMessageSignature) return;
    if (!isThreadFocused()) return;

    if (markReadDebounceRef.current) {
      clearTimeout(markReadDebounceRef.current);
    }

    markReadDebounceRef.current = setTimeout(() => {
      applyMarkRead(activeId);
    }, MARK_READ_DEBOUNCE_MS);

    return () => {
      if (markReadDebounceRef.current) {
        clearTimeout(markReadDebounceRef.current);
      }
    };
  }, [activeId, activeMessageSignature, messagesLoading, applyMarkRead]);

  const conversationsForCore: MessengerConversation[] = useMemo(
    () =>
      conversations.map((c) => ({
        ...c,
        messages: c.id === activeId ? messages : [],
        messagesLoading: c.id === activeId ? messagesLoading : false,
      })),
    [conversations, activeId, messages, messagesLoading],
  );

  const handleActiveChange = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleSend = useCallback(
    (conversationId: string, text: string) => {
      if (conversationId !== activeId) return;
      void sendMessage(text);
    },
    [activeId, sendMessage],
  );

  if (authLoading || (loading && conversations.length === 0)) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#FAF8F4]">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading messages" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#FAF8F4] px-6 text-center">
        <p className="text-sm font-medium text-[#484848]">{signedOutMessage}</p>
      </div>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#FAF8F4] px-6 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <MessengerCore
      conversations={conversationsForCore}
      activeConversationId={activeId}
      onActiveConversationChange={handleActiveChange}
      onSend={handleSend}
    />
  );
}
