"use client";

import "../messenger.css";
import { useEffect, useMemo, useState } from "react";
import { useMessengerMobileThreadPane } from "@/contexts/mobile-chrome-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { ConversationTab, MessengerConversation, MessengerSendPayload } from "../types";
import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";

export type MessengerCoreProps = {
  conversations: MessengerConversation[];
  /** Uncontrolled initial selection (ignored when `activeConversationId` is set). */
  defaultConversationId?: string;
  /** Controlled active conversation id. */
  activeConversationId?: string;
  onActiveConversationChange?: (id: string) => void;
  /** Mobile: back from thread pane (e.g. clear URL thread param). */
  onMobileThreadBack?: () => void;
  /** Mobile: initial list vs thread pane (sync with URL `?c=`). */
  defaultMobilePane?: "list" | "thread";
  onSend?: (conversationId: string, payload: MessengerSendPayload) => void;
  className?: string;
};

export function MessengerCore({
  conversations,
  defaultConversationId,
  activeConversationId,
  onActiveConversationChange,
  onMobileThreadBack,
  defaultMobilePane = "list",
  onSend,
  className,
}: MessengerCoreProps) {
  const initialId =
    defaultConversationId && conversations.some((c) => c.id === defaultConversationId)
      ? defaultConversationId
      : (conversations[0]?.id ?? "");

  const [internalActiveId, setInternalActiveId] = useState(initialId);
  const activeId =
    activeConversationId !== undefined
      ? activeConversationId
      : internalActiveId;
  const [tab, setTab] = useState<ConversationTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">(defaultMobilePane);
  const isMobile = useIsMobile();
  const { setMessengerMobileThreadPaneOpen } = useMessengerMobileThreadPane();

  useEffect(() => {
    setMobilePane(defaultMobilePane);
  }, [defaultMobilePane]);

  useEffect(() => {
    if (!isMobile) {
      setMessengerMobileThreadPaneOpen(false);
      return;
    }
    setMessengerMobileThreadPaneOpen(mobilePane === "thread");
    return () => setMessengerMobileThreadPaneOpen(false);
  }, [isMobile, mobilePane, setMessengerMobileThreadPaneOpen]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const handleSelectConversation = (id: string) => {
    if (activeConversationId === undefined) {
      setInternalActiveId(id);
    }
    onActiveConversationChange?.(id);
    setMobilePane("thread");
  };

  const handleBack = () => {
    setMobilePane("list");
    onMobileThreadBack?.();
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-[#FAF8F4]",
        className,
      )}
    >
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        tab={tab}
        searchQuery={searchQuery}
        onTabChange={setTab}
        onSearchChange={setSearchQuery}
        onSelect={handleSelectConversation}
        className={cn(
          "w-full md:w-[min(100%,22rem)] lg:w-80",
          mobilePane === "thread" ? "max-md:hidden" : "max-md:flex",
        )}
      />

      <ChatThread
        conversation={activeConversation}
        showBack
        onBack={handleBack}
        onSend={
          activeConversation
            ? (payload) => onSend?.(activeConversation.id, payload)
            : undefined
        }
        className={cn(
          "min-h-0 flex-1",
          mobilePane === "list" ? "hidden md:flex" : "flex",
        )}
      />
    </div>
  );
}
