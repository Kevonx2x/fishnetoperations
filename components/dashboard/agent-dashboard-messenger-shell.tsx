"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  GitBranch,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  MessagesSquare,
} from "lucide-react";

import { BahayGoWordmarkHomeLink } from "@/components/marketplace/bahaygo-wordmark";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { useAuth } from "@/contexts/auth-context";
import { UNIFIED_MESSAGES_PATH } from "@/lib/agent-messages-path";
import { AGENT_INHOUSE_MESSENGER_PATH } from "@/lib/messenger/agent-messages-path";
import { AGENT_MOBILE_PIPELINE_PATH } from "@/lib/agent-dashboard-routes";
import { cn } from "@/lib/utils";

const SIDEBAR_NAV: {
  href: string;
  label: string;
  segment: string;
  Icon: LucideIcon;
  external?: boolean;
}[] = [
  { href: "/dashboard/agent", label: "Overview", segment: "overview", Icon: LayoutDashboard },
  { href: AGENT_MOBILE_PIPELINE_PATH, label: "Pipeline", segment: "pipeline", Icon: GitBranch },
  {
    href: UNIFIED_MESSAGES_PATH,
    label: "Messages (Stream)",
    segment: "stream-messages",
    Icon: MessageSquare,
    external: true,
  },
  {
    href: AGENT_INHOUSE_MESSENGER_PATH,
    label: "BahayGo Messenger",
    segment: "messenger",
    Icon: MessagesSquare,
  },
];

function isActive(pathname: string, segment: string): boolean {
  if (segment === "messenger") return pathname.startsWith(AGENT_INHOUSE_MESSENGER_PATH);
  if (segment === "pipeline") return pathname.startsWith(AGENT_MOBILE_PIPELINE_PATH);
  if (segment === "overview") return pathname === "/dashboard/agent";
  return false;
}

export function AgentDashboardMessengerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, loading: authLoading } = useAuth();

  const allowed = role === "agent" || role === "team_member";

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      router.replace(`/auth/login?next=${encodeURIComponent(AGENT_INHOUSE_MESSENGER_PATH)}`);
      return;
    }
    if (!allowed) {
      router.replace("/");
    }
  }, [allowed, authLoading, router, user?.id]);

  const displayName = useMemo(
    () => profile?.full_name?.trim() || user?.email?.trim() || "Agent",
    [profile?.full_name, user?.email],
  );

  const avatarUrl = profile?.avatar_url?.trim() || null;
  const gateLoading = authLoading || !user?.id || !allowed;

  return (
    <>
      {gateLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm font-medium text-[#484848]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#6B9E6E]" />
          Loading…
        </div>
      ) : (
        <div className="flex min-h-screen max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:min-h-0 max-md:flex-col max-md:overflow-hidden bg-[#FAF8F4] font-sans text-[#2C2C2C] md:h-[100dvh] md:max-h-[100dvh] md:flex md:flex-col md:overflow-hidden">
          <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row md:overflow-hidden">
            <aside className="hidden w-[220px] shrink-0 border-r border-[rgba(0,0,0,0.06)] bg-[#FAF8F4] md:sticky md:top-0 md:flex md:h-full md:max-h-full md:flex-col md:overflow-hidden md:px-2 md:py-5">
              <div className="mb-4 px-1 pt-0.5">
                <BahayGoWordmarkHomeLink size="sidebar" className="max-w-full" />
              </div>
              <div className="mb-5 flex items-center gap-2 px-1">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-[#D4A843]/35">
                  {avatarUrl ? (
                    <SupabasePublicImage src={avatarUrl} alt="" fill className="object-cover" sizes="40px" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-xs font-bold text-white">
                      {displayName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#2C2C2C]">{displayName}</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#525252]">
                    Agent workspace
                  </p>
                </div>
              </div>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#525252]">
                Workspace
              </p>
              <nav className="flex flex-1 flex-col gap-0.5">
                {SIDEBAR_NAV.map((t) => {
                  const active = isActive(pathname, t.segment);
                  const Icon = t.Icon;
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition",
                        active
                          ? "bg-white text-[#2C2C2C] shadow-[0_1px_2px_rgba(44,44,44,0.05)]"
                          : "text-[#484848] hover:bg-white/60 hover:text-[#2C2C2C]",
                      )}
                    >
                      {active ? (
                        <span
                          className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[#6B9E6E]"
                          aria-hidden
                        />
                      ) : null}
                      <span className={cn("relative inline-flex", active ? "text-[#6B9E6E]" : "text-[#525252]")}>
                        <Icon className="h-[17px] w-[17px]" aria-hidden />
                      </span>
                      {t.label}
                      {t.segment === "messenger" ? (
                        <span className="ml-auto rounded-full bg-[#D4A843]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8a6d32]">
                          New
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
              <Link
                href="/"
                className="mt-auto border-t border-[#2C2C2C]/[0.06] px-2 pt-4 text-[12px] font-medium text-[#525252] transition hover:text-[#2C2C2C]"
              >
                Back to marketplace
              </Link>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0 py-0">
              <div className="flex shrink-0 items-center gap-3 border-b border-[#2C2C2C]/8 bg-[#FAF8F4] px-4 py-3 md:hidden">
                <Link
                  href="/dashboard/agent"
                  className="text-sm font-semibold text-[#6B9E6E] hover:underline"
                >
                  ← Agent hub
                </Link>
                <span className="text-sm font-semibold text-[#2C2C2C]">BahayGo Messenger</span>
              </div>
              {children}
            </main>
          </div>
        </div>
      )}
    </>
  );
}
