"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GitBranch, LayoutDashboard } from "lucide-react";
import { ClientPipelineInner } from "@/components/client/client-pipeline-page";
import { CLIENT_PIPELINE_TAB_NOTIFICATION_TYPES } from "@/components/notifications/notification-list";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type DashboardPanel = "overview" | "pipeline";

function readPanel(raw: string | null): DashboardPanel {
  if (raw === "pipeline") return "pipeline";
  return "overview";
}

function ClientDashboardTabsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [panel, setPanel] = useState<DashboardPanel>(() => readPanel(searchParams.get("tab")));
  const [pipelineNotifUnread, setPipelineNotifUnread] = useState(0);

  useEffect(() => {
    setPanel(readPanel(searchParams.get("tab")));
  }, [searchParams]);

  const syncUrl = useCallback(
    (next: DashboardPanel) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next === "overview") qs.delete("tab");
      else qs.set("tab", "pipeline");
      const q = qs.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onSelectPanel = (next: DashboardPanel) => {
    setPanel(next);
    syncUrl(next);
  };

  useEffect(() => {
    if (!user?.id) {
      setPipelineNotifUnread(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null)
        .in("type", [...CLIENT_PIPELINE_TAB_NOTIFICATION_TYPES]);
      if (!cancelled && !error) setPipelineNotifUnread(count ?? 0);
    })();
    const onRead = () => {
      void (async () => {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null)
          .in("type", [...CLIENT_PIPELINE_TAB_NOTIFICATION_TYPES]);
        if (!cancelled && !error) setPipelineNotifUnread(count ?? 0);
      })();
    };
    window.addEventListener("bahaygo:notifications-read", onRead);
    return () => {
      cancelled = true;
      window.removeEventListener("bahaygo:notifications-read", onRead);
    };
  }, [user?.id, supabase]);

  return (
    <>
      <div className="mb-6 flex gap-1 border-b border-[#2C2C2C]/10 pb-px">
        <button
          type="button"
          onClick={() => onSelectPanel("overview")}
          className={cn(
            "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold transition",
            panel === "overview"
              ? "border-[#6B9E6E] text-[#2C2C2C]"
              : "border-transparent text-[#2C2C2C]/50 hover:text-[#2C2C2C]/80",
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
          Overview
        </button>
        <button
          type="button"
          onClick={() => onSelectPanel("pipeline")}
          className={cn(
            "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold transition",
            panel === "pipeline"
              ? "border-[#6B9E6E] text-[#2C2C2C]"
              : "border-transparent text-[#2C2C2C]/50 hover:text-[#2C2C2C]/80",
          )}
        >
          <GitBranch className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
          My Properties
          {pipelineNotifUnread > 0 ? (
            <span className="ml-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-[#D4A843]/25 px-1.5 text-[10px] font-bold text-[#8a6d32]">
              {pipelineNotifUnread > 99 ? "99+" : pipelineNotifUnread}
            </span>
          ) : null}
        </button>
      </div>

      {panel === "overview" ? (
        <>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2C2C2C] md:text-4xl">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-[#888888] md:text-base">
            Welcome back. Here you&apos;ll soon see recent activity, upcoming viewings, and suggested listings. For
            now, open your pipeline to track deals or browse the marketplace from{" "}
            <span className="font-semibold text-[#2C2C2C]/70">Back to site</span>.
          </p>
          <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSelectPanel("pipeline")}
              className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 text-left shadow-sm transition hover:border-[#6B9E6E]/40"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#6B9E6E]">My Properties</p>
              <p className="mt-2 font-serif text-lg font-semibold text-[#2C2C2C]">Track your inquiries</p>
              <p className="mt-1 text-sm text-[#888888]">Viewings, documents, and status per property.</p>
            </button>
            <Link
              href="/"
              className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm transition hover:border-[#D4A843]/50"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#D4A843]">Marketplace</p>
              <p className="mt-2 font-serif text-lg font-semibold text-[#2C2C2C]">Browse listings</p>
              <p className="mt-1 text-sm text-[#888888]">Return to the main BahayGo site.</p>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">Pipeline</h1>
            <p className="mt-2 max-w-2xl font-sans text-sm font-normal leading-relaxed text-[#2C2C2C]/50 md:text-[15px]">
              Track the progress of your properties and what&apos;s next in your journey.
            </p>
          </div>
          <div className="mt-6">
            <Suspense
              fallback={
                <div className="flex min-h-[200px] items-center justify-center text-sm text-[#2C2C2C]/50">
                  Loading pipeline…
                </div>
              }
            >
              <ClientPipelineInner />
            </Suspense>
          </div>
        </>
      )}
    </>
  );
}

export function ClientDashboardTabs() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[200px] items-center justify-center text-sm text-[#2C2C2C]/50">Loading…</div>
      }
    >
      <ClientDashboardTabsInner />
    </Suspense>
  );
}
