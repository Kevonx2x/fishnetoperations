"use client";

import "../messenger.css";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CONVERSATION_ID,
  MOCK_CONVERSATIONS,
  MOCK_CURRENT_USER,
} from "../mock-data";
import type { ConversationTab, MessengerNavId } from "../types";
import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";
import { NavRail } from "./nav-rail";

export function MessengerShell() {
  const [activeNav, setActiveNav] = useState<MessengerNavId>("messages");
  const [activeId, setActiveId] = useState(DEFAULT_CONVERSATION_ID);
  const [tab, setTab] = useState<ConversationTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");

  const activeConversation = useMemo(
    () => MOCK_CONVERSATIONS.find((c) => c.id === activeId) ?? null,
    [activeId],
  );

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setMobilePane("thread");
  };

  const handleBack = () => setMobilePane("list");

  return (
    <div className="flex h-[100dvh] min-h-0 w-full min-w-0 overflow-hidden bg-[#FAF8F4]">
      <NavRail
        activeNav={activeNav}
        onNavChange={setActiveNav}
        currentUser={MOCK_CURRENT_USER}
      />

      <ConversationList
        conversations={MOCK_CONVERSATIONS}
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
