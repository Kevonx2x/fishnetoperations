"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Home } from "lucide-react";
import type { ReactNode } from "react";
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
  const initial = fullName.trim().slice(0, 1).toUpperCase() || "?";
  const profileHref = `/clients/${encodeURIComponent(userId)}`;
  const profileActive = pathname.startsWith("/clients/");

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
        "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-all duration-200",
        active ? "text-[#6B9E6E]" : "text-[#6B6B6B]",
      )}
    >
      {children ?? (Icon ? <Icon className="h-6 w-6" /> : null)}
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#E5E5E5] bg-white px-1 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Item href="/" label="Home" icon={Home} active={pathname === "/"} />
      <Item href="/notifications" label="Notifications" active={pathname.startsWith("/notifications")}>
        <span className="relative">
          <Bell className="h-6 w-6" />
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
          "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-all duration-200",
          profileActive ? "text-[#6B9E6E]" : "text-[#6B6B6B]",
        )}
      >
        <span className="relative h-7 w-7 overflow-hidden rounded-full bg-[#6B9E6E] ring-2 ring-[#E5E5E5]">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" sizes="28px" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white">
              {initial}
            </span>
          )}
        </span>
        <span className="truncate">Profile</span>
      </Link>
    </nav>
  );
}
