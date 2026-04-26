"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  GitBranch,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Settings,
} from "lucide-react";
import { ClientAvatar } from "@/components/client/client-avatar";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV: {
  href: string;
  label: string;
  segment: string;
  Icon: LucideIcon;
}[] = [
  { href: "/dashboard/client/overview", label: "Overview", segment: "overview", Icon: LayoutDashboard },
  { href: "/dashboard/client/pipeline", label: "Pipeline", segment: "pipeline", Icon: GitBranch },
  { href: "/dashboard/client/messages", label: "Messages", segment: "messages", Icon: MessageSquare },
  { href: "/dashboard/client/notifications", label: "Notifications", segment: "notifications", Icon: Bell },
  { href: "/dashboard/client/profile", label: "Profile", segment: "profile", Icon: Settings },
];

function isActivePath(pathname: string, segment: string) {
  if (segment === "overview") return pathname === "/dashboard/client" || pathname.startsWith("/dashboard/client/overview");
  return pathname.startsWith(`/dashboard/client/${segment}`);
}

export function ClientDashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [notifUnread, setNotifUnread] = useState(0);

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
      router.replace(`/auth/login?next=${encodeURIComponent("/dashboard/client/overview")}`);
      return;
    }
    if (role && role !== "client") {
      router.replace("/");
    }
  }, [authLoading, user?.id, role, router]);

  if (authLoading || !user?.id || role !== "client") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm font-semibold text-[#2C2C2C]/60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#6B9E6E]" />
        Loading…
      </div>
    );
  }

  const displayName = profile?.full_name?.trim() || user.email?.trim() || "Client";
  const avatarUrl = profile?.avatar_url?.trim() || null;

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-[calc(4rem+env(safe-area-inset-bottom))] font-sans text-[#2C2C2C] md:flex md:h-[100dvh] md:max-h-[100dvh] md:flex-col md:overflow-hidden md:pb-0">
      <div className="flex w-full min-h-0 flex-1 flex-col md:flex-row md:overflow-hidden">
        <aside className="hidden w-[180px] shrink-0 border-r border-[#2C2C2C]/10 bg-[#FAF8F4] md:sticky md:top-0 md:flex md:h-full md:max-h-full md:flex-col md:overflow-y-auto md:px-2 md:py-5">
          <div className="mb-5 flex items-center gap-2 px-1">
            <ClientAvatar name={displayName} avatarUrl={avatarUrl} sizePx={40} textClassName="text-sm" ringClassName="ring-2 ring-[#D4A843]/35" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight text-[#2C2C2C]">{displayName}</p>
              <p className="truncate text-[11px] font-medium text-[#888888]">Client</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((t) => {
              const active = isActivePath(pathname, t.segment);
              const Icon = t.Icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold transition",
                    active
                      ? "bg-[#6B9E6E]/15 text-[#2C2C2C] ring-1 ring-[#D4A843]/25"
                      : "text-[#2C2C2C]/65 hover:bg-white/80",
                  )}
                >
                  <span className="text-[#6B9E6E]">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  {t.label}
                  {t.segment === "notifications" && notifUnread > 0 ? (
                    <span className="ml-auto rounded-full bg-[#D4A843]/25 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                      {notifUnread > 99 ? "99+" : notifUnread}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <Link href="/" className="mt-auto px-2 py-2 text-sm font-semibold text-[#2C2C2C]/55 hover:text-[#2C2C2C]">
            ← Back to site
          </Link>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:h-full md:min-h-0 md:overflow-y-auto md:px-8 md:py-10 md:pb-10">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-0 border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-0.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {NAV.map((t) => {
          const active = isActivePath(pathname, t.segment);
          const Icon = t.Icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 text-[9px] font-bold sm:text-[10px]",
                active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45",
              )}
            >
              {t.segment === "notifications" && notifUnread > 0 ? (
                <span className="absolute right-1 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#D4A843] px-0.5 text-[8px] font-bold text-[#2C2C2C]">
                  {notifUnread > 9 ? "9+" : notifUnread}
                </span>
              ) : null}
              <span className={active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="max-w-[4.5rem] truncate">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
