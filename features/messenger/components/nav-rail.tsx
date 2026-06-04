"use client";

import {
  Bell,
  Bookmark,
  MessageCircle,
  Phone,
  Settings,
  Users,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessengerNavId, MockCurrentUser } from "../types";
import { MessengerAvatar } from "./avatar";

const NAV_ITEMS: { id: MessengerNavId; label: string; icon: typeof MessageCircle }[] = [
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "groups", label: "Groups", icon: Users },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "contacts", label: "Contacts", icon: UserRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "settings", label: "Settings", icon: Settings },
];

type Props = {
  activeNav: MessengerNavId;
  onNavChange: (id: MessengerNavId) => void;
  currentUser: MockCurrentUser;
};

export function NavRail({ activeNav, onNavChange, currentUser }: Props) {
  return (
    <aside
      className="hidden w-[72px] shrink-0 flex-col border-r border-[#2C2C2C]/8 bg-[#F5F3EF] md:flex"
      aria-label="Messenger navigation"
    >
      <div className="flex flex-col items-center gap-1 px-2 pb-3 pt-5">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6B9E6E]/12"
          title="BahayGo Messenger"
        >
          <span className="font-serif text-[11px] font-bold leading-none text-[#2C2C2C]">
            BG
          </span>
        </div>
        <p className="mt-1 text-center font-serif text-[9px] font-semibold leading-tight text-[#2C2C2C]/70">
          Messenger
        </p>
      </div>

      <nav className="mt-2 flex flex-1 flex-col items-center gap-0.5 px-2">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavChange(id)}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                active
                  ? "bg-[#6B9E6E] text-white shadow-sm"
                  : "text-[#888888] hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C]",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 2} />
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#2C2C2C]/8 px-2 py-4">
        <button
          type="button"
          className="flex w-full flex-col items-center gap-1.5 rounded-xl p-1 transition hover:bg-[#2C2C2C]/5"
          aria-label={`Profile: ${currentUser.name}`}
        >
          <MessengerAvatar initials={currentUser.initials} size="sm" online={currentUser.online} />
          <span className="max-w-full truncate text-[9px] font-medium text-[#888888]">
            You
          </span>
        </button>
      </div>
    </aside>
  );
}
