"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, GitBranch, Home, LayoutDashboard, Loader2, MessageSquare, Settings } from "lucide-react";
import { ClientAvatar } from "@/components/client/client-avatar";
import { BahayGoWordmarkHomeLink } from "@/components/marketplace/bahaygo-wordmark";
import { useUnreadMessageCount } from "@/features/messaging/hooks/use-unread-message-count";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Desktop / tablet sidebar (md+) — unchanged labels and routes. */
const SIDEBAR_NAV: {
  href: string;
  label: string;
  segment: string;
  Icon: LucideIcon;
}[] = [
  { href: "/dashboard/client", label: "Dashboard", segment: "dashboard", Icon: LayoutDashboard },
  { href: "/dashboard/client/pipeline", label: "My Properties", segment: "pipeline", Icon: GitBranch },
  { href: "/dashboard/client/messages", label: "Messages", segment: "messages", Icon: MessageSquare },
  { href: "/dashboard/client/notifications", label: "Notifications", segment: "notifications", Icon: Bell },
  { href: "/dashboard/client/profile", label: "Profile", segment: "profile", Icon: Settings },
];

/** Mobile bottom bar only (< md): first tab opens marketplace home. */
const MOBILE_BOTTOM_NAV: {
  href: string;
  label: string;
  segment: string;
  Icon: LucideIcon;
}[] = [
  { href: "/", label: "Home", segment: "home", Icon: Home },
  { href: "/dashboard/client/pipeline", label: "My Properties", segment: "pipeline", Icon: GitBranch },
  { href: "/dashboard/client/messages", label: "Messages", segment: "messages", Icon: MessageSquare },
  { href: "/dashboard/client/notifications", label: "Notifications", segment: "notifications", Icon: Bell },
  { href: "/dashboard/client/profile", label: "Profile", segment: "profile", Icon: Settings },
];

function isSidebarActivePath(pathname: string, segment: string) {
  if (segment === "dashboard") {
    return pathname === "/dashboard/client" || pathname.startsWith("/dashboard/client/overview");
  }
  return pathname.startsWith(`/dashboard/client/${segment}`);
}

function isMobileBottomActivePath(pathname: string, segment: string) {
  if (segment === "home") {
    return (
      pathname === "/" ||
      pathname.startsWith("/properties") ||
      pathname.startsWith("/agents")
    );
  }
  if (segment === "pipeline") {
    return pathname.startsWith("/dashboard/client/pipeline");
  }
  return pathname.startsWith(`/dashboard/client/${segment}`);
}

export function ClientDashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [notifUnread, setNotifUnread] = useState(0);
  const streamMessagesUnreadTotal = useUnreadMessageCount();
  const isMessagesRoute = pathname.startsWith("/dashboard/client/messages");

  const refreshUnread = useCallback(async () => {
    if (!user?.id) {
      setNotifUnread(0);
      return;
    }
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    setNotifUnread(count ?? 0);
  }, [user?.id, supabase]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    const onRead = () => void refreshUnread();
    window.addEventListener("bahaygo:notifications-read", onRead);
    return () => window.removeEventListener("bahaygo:notifications-read", onRead);
  }, [refreshUnread]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      router.replace(`/auth/login?next=${encodeURIComponent("/dashboard/client")}`);
      return;
    }
    if (role && role !== "client") {
      router.replace("/");
    }
  }, [authLoading, user?.id, role, router]);

  const gateLoading = authLoading || !user?.id || role !== "client";

  const displayName = profile?.full_name?.trim() || user?.email?.trim() || "Client";
  const avatarUrl = profile?.avatar_url?.trim() || null;

  return (
    <>
      {gateLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm font-semibold text-[#2C2C2C]/60">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#6B9E6E]" />
          Loading…
        </div>
      ) : (
        <div
          className={cn(
            "min-h-screen bg-[#FAF8F4] pb-[calc(4rem+env(safe-area-inset-bottom))] font-sans text-[#2C2C2C] md:flex md:h-[100dvh] md:max-h-[100dvh] md:flex-col md:overflow-hidden md:pb-0",
            /* Mobile messages: bounded viewport height so flex + min-h-0 chains resolve; avoids composer pushed below fold on long threads. */
            isMessagesRoute &&
              "max-md:flex max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:min-h-0 max-md:flex-col max-md:overflow-hidden",
          )}
        >
          <div
            className={cn(
              "flex w-full min-h-0 flex-1 flex-col md:flex-row md:overflow-hidden",
              isMessagesRoute && "max-md:min-h-0 max-md:flex-1",
            )}
          >
            <aside
              className={cn(
                "hidden shrink-0 border-r border-[#2C2C2C]/[0.07] bg-[#F5F2EC] md:sticky md:top-0 md:flex md:h-full md:max-h-full md:flex-col md:overflow-hidden md:px-3 md:py-6",
                isMessagesRoute ? "w-[220px]" : "w-[196px]",
              )}
            >
              <div className="mb-5 px-2">
                <BahayGoWordmarkHomeLink size="sidebar" className="max-w-full" />
              </div>
              <div className="mb-6 flex items-center gap-2.5 border-b border-[#2C2C2C]/[0.06] px-2 pb-5">
                <ClientAvatar name={displayName} avatarUrl={avatarUrl} sizePx={36} textClassName="text-xs" ringClassName="ring-1 ring-[#2C2C2C]/10" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium leading-tight text-[#2C2C2C]">{displayName}</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2C2C2C]/42">Client account</p>
                </div>
              </div>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/38">Workspace</p>
              <nav className="flex flex-1 flex-col gap-0.5">
                {SIDEBAR_NAV.map((t) => {
                  const active = isSidebarActivePath(pathname, t.segment);
                  const Icon = t.Icon;
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition",
                        active
                          ? "bg-white text-[#2C2C2C] shadow-[0_1px_2px_rgba(44,44,44,0.05)]"
                          : "text-[#2C2C2C]/58 hover:bg-white/60 hover:text-[#2C2C2C]",
                      )}
                    >
                      {active ? (
                        <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[#6B9E6E]" aria-hidden />
                      ) : null}
                      <span className={cn("relative inline-flex", active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45")}>
                        <Icon className="h-[17px] w-[17px]" aria-hidden />
                        {t.segment === "dashboard" && streamMessagesUnreadTotal > 0 ? (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                      {t.label}
                      {t.segment === "messages" && streamMessagesUnreadTotal > 0 ? (
                        <span className="ml-auto rounded-full bg-[#D4A843]/25 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                          {streamMessagesUnreadTotal > 99 ? "99+" : streamMessagesUnreadTotal}
                        </span>
                      ) : null}
                      {t.segment === "notifications" && notifUnread > 0 ? (
                        <span className="ml-auto rounded-full bg-[#D4A843]/25 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                          {notifUnread > 99 ? "99+" : notifUnread}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
              <Link
                href="/"
                className="mt-auto border-t border-[#2C2C2C]/[0.06] px-2 pt-4 text-[12px] font-medium text-[#2C2C2C]/48 transition hover:text-[#2C2C2C]"
              >
                Back to marketplace
              </Link>
            </aside>

            <main
              className={cn(
                "min-w-0 flex-1 md:flex md:h-full md:min-h-0 md:flex-col",
                isMessagesRoute
                  ? "max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col max-lg:overflow-hidden px-0 py-0 md:overflow-hidden md:px-0 md:py-0"
                  : "px-4 py-5 md:overflow-y-auto md:px-6 md:py-5 md:pb-6",
              )}
            >
              {children}
            </main>
          </div>

          <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-0 border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-0.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
            {MOBILE_BOTTOM_NAV.map((t) => {
              const active = isMobileBottomActivePath(pathname, t.segment);
              const Icon = t.Icon;
              return (
                <Link
                  key={`${t.segment}-${t.href}`}
                  href={t.href}
                  className={cn(
                    "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 text-[9px] font-bold sm:text-[10px]",
                    active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45",
                  )}
                >
                  {t.segment === "messages" && streamMessagesUnreadTotal > 0 ? (
                    <span className="absolute right-1 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#D4A843] px-0.5 text-[8px] font-bold text-[#2C2C2C]">
                      {streamMessagesUnreadTotal > 9 ? "9+" : streamMessagesUnreadTotal}
                    </span>
                  ) : null}
                  {t.segment === "notifications" && notifUnread > 0 ? (
                    <span className="absolute right-1 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#D4A843] px-0.5 text-[8px] font-bold text-[#2C2C2C]">
                      {notifUnread > 9 ? "9+" : notifUnread}
                    </span>
                  ) : null}
                  <span className="relative inline-flex">
                    <span className={active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    {t.segment === "home" && streamMessagesUnreadTotal > 0 ? (
                      <span
                        className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]/95"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span className="max-w-[4.5rem] truncate">{t.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
