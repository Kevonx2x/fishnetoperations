"use client";

import type { ReactNode } from "react";
import { GitBranch, Home, MessageSquare, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentMobileBottomNavTab = "home" | "pipeline" | "messages" | "more";

type AgentMobileBottomNavProps = {
  activeTab: AgentMobileBottomNavTab;
  messagesUnread: number;
  onHome: () => void;
  onPipeline: () => void;
  onAdd: () => void;
  onMessages: () => void;
  onMore: () => void;
};

function NavItem({
  label,
  active,
  onClick,
  showDot,
  badge,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  showDot?: boolean;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 text-[10px] font-bold",
        active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45",
      )}
    >
      {showDot ? (
        <span
          className="pointer-events-none absolute right-2 top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]/95"
          aria-hidden
        />
      ) : null}
      {badge != null && badge > 0 ? (
        <span className="pointer-events-none absolute right-1 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <span className={active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>{children}</span>
      <span className="max-w-[4.5rem] truncate">{label}</span>
    </button>
  );
}

export function AgentMobileBottomNav({
  activeTab,
  messagesUnread,
  onHome,
  onPipeline,
  onAdd,
  onMessages,
  onMore,
}: AgentMobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
      aria-label="Agent navigation"
    >
      <div className="flex items-end justify-between gap-0">
        <NavItem label="Home" active={activeTab === "home"} onClick={onHome}>
          <Home className="h-5 w-5" aria-hidden />
        </NavItem>
        <NavItem
          label="Pipeline"
          active={activeTab === "pipeline"}
          onClick={onPipeline}
          showDot={activeTab === "pipeline"}
        >
          <span
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full",
              activeTab === "pipeline" ? "bg-[#6B9E6E] text-white" : "",
            )}
          >
            <GitBranch className="h-5 w-5" aria-hidden />
          </span>
        </NavItem>
        {/* TODO: full add-deal flow — currently placeholder via onAdd */}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add deal"
          className="relative -mt-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] text-white shadow-[0_4px_16px_rgba(107,158,110,0.45)] ring-4 ring-[#FAF8F4]/95"
        >
          <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </button>
        <NavItem
          label="Messages"
          active={activeTab === "messages"}
          onClick={onMessages}
          badge={messagesUnread}
        >
          <MessageSquare className="h-5 w-5" aria-hidden />
        </NavItem>
        <NavItem label="More" active={activeTab === "more"} onClick={onMore}>
          <MoreHorizontal className="h-5 w-5" aria-hidden />
        </NavItem>
      </div>
    </nav>
  );
}
