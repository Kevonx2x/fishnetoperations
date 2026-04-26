"use client";

import Link from "next/link";
import { Bell, Home, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS: {
  href: string;
  label: string;
  segment: string;
  Icon: LucideIcon;
}[] = [
  { href: "/dashboard/client/overview", label: "Home", segment: "overview", Icon: Home },
  { href: "/dashboard/client/notifications", label: "Notifications", segment: "notifications", Icon: Bell },
  { href: "/dashboard/client/profile", label: "Profile", segment: "profile", Icon: Settings },
];

function dashActive(pathname: string, segment: string) {
  if (segment === "overview") {
    return pathname === "/dashboard/client" || pathname.startsWith("/dashboard/client/overview");
  }
  if (segment === "notifications") {
    return (
      pathname.startsWith("/dashboard/client/notifications") || pathname.startsWith("/notifications")
    );
  }
  return pathname.startsWith(`/dashboard/client/${segment}`);
}

export function ClientMobileBottomNav({
  pathname,
  userId: _userId,
  avatarUrl: _avatarUrl,
  fullName: _fullName,
  unreadCount,
}: {
  pathname: string;
  userId: string;
  avatarUrl: string | null;
  fullName: string;
  unreadCount: number;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-0 border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-0.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      {ITEMS.map(({ href, label, segment, Icon }) => {
        const active = dashActive(pathname, segment);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-0.5 text-[9px] font-bold sm:text-[10px]",
              active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45",
            )}
          >
            {segment === "notifications" && unreadCount > 0 ? (
              <span className="absolute right-0.5 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#D4A843] px-0.5 text-[8px] font-bold text-[#2C2C2C]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
            <span className={active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>
              <Icon className="mx-auto h-5 w-5" aria-hidden />
            </span>
            <span className="max-w-[3.75rem] truncate text-center leading-tight">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
