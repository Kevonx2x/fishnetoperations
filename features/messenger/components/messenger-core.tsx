"use client";

import "../messenger.css";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ConversationTab, MockConversation } from "../types";
import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";

export type MessengerCoreProps = {
  conversations: MockConversation[];
  defaultConversationId?: string;
  className?: string;
};

export function MessengerCore({
  conversations,
  defaultConversationId,
  className,
}: MessengerCoreProps) {
  const initialId =
    defaultConversationId && conversations.some((c) => c.id === defaultConversationId)
      ? defaultConversationId
      : (conversations[0]?.id ?? "");

  const [activeId, setActiveId] = useState(initialId);
  const [tab, setTab] = useState<ConversationTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setMobilePane("thread");
  };

  const handleBack = () => setMobilePane("list");

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
        className={cn(
          "min-h-0 flex-1",
          mobilePane === "list" ? "hidden md:flex" : "flex",
        )}
      />
    </div>
  );
}
