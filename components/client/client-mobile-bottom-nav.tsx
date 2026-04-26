"use client";

import Link from "next/link";
import { Bell, ClipboardList, Home } from "lucide-react";
import type { ReactNode } from "react";
import { ClientAvatar } from "@/components/client/client-avatar";
import { cn } from "@/lib/utils";

export function ClientMobileBottomNav({
  pathname,
  userId,
  avatarUrl,
  fullName,
  unreadCount,
}: {
  pathname: string;
  userId: string;
  avatarUrl: string | null;
  fullName: string;
  unreadCount: number;
}) {
  const profileHref = `/clients/${encodeURIComponent(userId)}`;
  const profileActive = pathname.startsWith("/clients/");
  const pipelineActive = pathname.startsWith("/dashboard/client/pipeline");

  const Item = ({
    href,
    label,
    icon: Icon,
    active,
    children,
  }: {
    href: string;
    label: string;
    icon?: typeof Home;
    active: boolean;
    children?: ReactNode;
  }) => (
    <Link
      href={href}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-0.5 text-[10px] font-semibold transition-all duration-200",
        active ? "text-[#6B9E6E]" : "text-[#6B6B6B]",
      )}
    >
      {children ?? (Icon ? <Icon className="h-5 w-5" /> : null)}
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#E5E5E5] bg-white px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <Item href="/" label="Home" icon={Home} active={pathname === "/"} />
      <Item
        href="/dashboard/client/pipeline"
        label="Pipeline"
        icon={ClipboardList}
        active={pipelineActive}
      />
      <Item href="/notifications" label="Notifications" active={pathname.startsWith("/notifications")}>
        <span className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
      </Item>
      <Link
        href={profileHref}
        className={cn(
          "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-0.5 text-[10px] font-semibold transition-all duration-200",
          profileActive ? "text-[#6B9E6E]" : "text-[#6B6B6B]",
        )}
      >
        <ClientAvatar name={fullName} avatarUrl={avatarUrl} sizePx={28} />
        <span className="truncate">Profile</span>
      </Link>
    </nav>
  );
}
