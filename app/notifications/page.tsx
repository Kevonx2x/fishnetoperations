"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Home, Sparkles } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
};

function formatTimeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function dayLabel(iso: string): "today" | "yesterday" | "week" | "older" {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startD.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "week";
  return "older";
}

function notificationIcon(type: string) {
  if (type === "property_match") return <Home className="h-5 w-5 text-[#6B9E6E]" aria-hidden />;
  if (type === "lead_created" || type === "new_lead") return <Sparkles className="h-5 w-5 text-[#D4A843]" aria-hidden />;
  return <Bell className="h-5 w-5 text-[#2C2C2C]/45" aria-hidden />;
}

function resolveLink(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const link = metadata.link;
  if (typeof link === "string" && link.startsWith("/")) return link;
  const pid = metadata.property_id;
  if (typeof pid === "string") return `/properties/${pid}`;
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, created_at, type, title, body, read_at, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) {
      setRows((data ?? []) as NotificationRow[]);
    }
    setLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const buckets: Record<string, NotificationRow[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };
    for (const n of rows) {
      buckets[dayLabel(n.created_at)].push(n);
    }
    return buckets;
  }, [rows]);

  const markRead = async (n: NotificationRow, navigateTo?: string | null) => {
    if (!n.read_at) {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
      if (!error) {
        setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      }
    }
    const href = navigateTo ?? resolveLink(n.metadata);
    if (href) router.push(href);
  };

  const markAllRead = async () => {
    if (!user?.id || markingAll) return;
    setMarkingAll(true);
    const unread = rows.filter((r) => !r.read_at);
    if (unread.length === 0) {
      setMarkingAll(false);
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
    if (!error) {
      setRows((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    }
    setMarkingAll(false);
  };

  const section = (label: string, list: NotificationRow[]) => {
    if (!list.length) return null;
    return (
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">{label}</h2>
        <ul className="mt-3 divide-y divide-[#2C2C2C]/8 rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
          {list.map((n) => {
            const href = resolveLink(n.metadata);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void markRead(n, href)}
                  className={`flex w-full gap-4 px-4 py-4 text-left transition hover:bg-[#FAF8F4] ${
                    n.read_at ? "" : "bg-[#6B9E6E]/[0.06]"
                  }`}
                >
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      n.read_at ? "bg-transparent" : "bg-[#6B9E6E]"
                    }`}
                    aria-hidden
                  />
                  <span className="shrink-0">{notificationIcon(n.type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#2C2C2C]">{n.title}</span>
                    {n.body ? (
                      <span className="mt-1 line-clamp-2 block text-sm font-medium text-[#2C2C2C]/60">{n.body}</span>
                    ) : null}
                    <span className="mt-1 block text-xs font-semibold text-[#2C2C2C]/40">{formatTimeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white">
        <MaddenTopNav />
        <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <MaddenTopNav />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm font-semibold text-[#2C2C2C]/50">Sign in to see notifications.</p>
          <Link
            href="/auth/login?next=/notifications"
            className="mt-4 inline-flex rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5d8a60]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <MaddenTopNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">Notifications</h1>
            <p className="mt-1 text-sm text-[#2C2C2C]/55">Updates and activity for your account.</p>
          </div>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={markingAll || rows.every((r) => r.read_at)}
            className="rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm transition hover:bg-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? "…" : "Mark all as read"}
          </button>
        </div>

        {loading ? (
          <div className="mt-10 h-48 animate-pulse rounded-2xl bg-[#2C2C2C]/5" />
        ) : rows.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-[#FAF8F4]/50 py-16 text-center">
            <Bell className="mx-auto h-12 w-12 text-[#2C2C2C]/25" strokeWidth={1.25} />
            <p className="mt-4 font-semibold text-[#2C2C2C]/55">No notifications yet</p>
          </div>
        ) : (
          <>
            {section("Today", grouped.today)}
            {section("Yesterday", grouped.yesterday)}
            {section("This week", grouped.week)}
            {section("Older", grouped.older)}
          </>
        )}
      </main>
    </div>
  );
}
