"use client";

import { PenSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationTab, MockConversation } from "../types";
import { ConversationRow } from "./conversation-row";

const TABS: { id: ConversationTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "favorites", label: "Favorites" },
];

type Props = {
  conversations: MockConversation[];
  activeId: string;
  tab: ConversationTab;
  searchQuery: string;
  onTabChange: (tab: ConversationTab) => void;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  className?: string;
};

function filterConversations(
  list: MockConversation[],
  tab: ConversationTab,
  searchQuery: string,
): MockConversation[] {
  const q = searchQuery.trim().toLowerCase();
  return list.filter((c) => {
    if (tab === "unread" && c.unread === 0) return false;
    if (tab === "favorites" && !c.favorite) return false;
    if (q && !c.participant.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function ConversationList({
  conversations,
  activeId,
  tab,
  searchQuery,
  onTabChange,
  onSearchChange,
  onSelect,
  className,
}: Props) {
  const filtered = filterConversations(conversations, tab, searchQuery);

  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col border-r border-[#2C2C2C]/8 bg-[#FAF8F4]",
        className,
      )}
      aria-label="Conversations"
    >
      <header className="shrink-0 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] md:pt-5">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Messages</h1>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#888888] transition hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C]"
            aria-label="New message"
          >
            <PenSquare className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888888]"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations"
            className="h-10 w-full rounded-full border border-[#2C2C2C]/10 bg-white pl-10 pr-4 text-sm text-[#2C2C2C] outline-none placeholder:text-[#AAAAAA] focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/30"
          />
        </div>

        <div className="mt-3 flex gap-1 rounded-full bg-[#2C2C2C]/[0.04] p-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-xs font-semibold transition",
                tab === id
                  ? "bg-white text-[#2C2C2C] shadow-sm"
                  : "text-[#888888] hover:text-[#2C2C2C]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#888888]">No conversations found.</p>
        ) : (
          filtered.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={c.id === activeId}
              onSelect={() => onSelect(c.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
