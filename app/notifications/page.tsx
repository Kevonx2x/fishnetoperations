"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { ClientMobileBottomNav } from "@/components/client/client-mobile-bottom-nav";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  NotificationCard,
  resolveNotificationLink,
  type NotificationListItem,
} from "@/components/notifications/notification-list";

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

export default function NotificationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, role, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [bottomNavUnread, setBottomNavUnread] = useState(0);

  const refreshBottomNavUnread = useCallback(async () => {
    if (!user?.id) {
      setBottomNavUnread(0);
      return;
    }
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    setBottomNavUnread(count ?? 0);
  }, [user?.id, supabase]);

  useEffect(() => {
    void refreshBottomNavUnread();
  }, [refreshBottomNavUnread]);

  useEffect(() => {
    const onRead = () => {
      void refreshBottomNavUnread();
    };
    window.addEventListener("bahaygo:notifications-read", onRead);
    return () => window.removeEventListener("bahaygo:notifications-read", onRead);
  }, [refreshBottomNavUnread]);

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
      setRows((data ?? []) as NotificationListItem[]);
    }
    setLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (cancelled) return;
      if (!error) {
        window.dispatchEvent(new CustomEvent("bahaygo:notifications-read"));
      }
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, supabase, load]);

  const grouped = useMemo(() => {
    const buckets: Record<string, NotificationListItem[]> = {
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

  const markRead = async (n: NotificationListItem, navigateTo?: string | null) => {
    if (!user?.id) return;
    if (!n.read_at) {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id)
        .eq("user_id", user.id);
      if (!error) {
        setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      }
    }
    const href = navigateTo ?? resolveNotificationLink(n.metadata ?? null);
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
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (!error) {
      setRows((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    }
    setMarkingAll(false);
  };

  const section = (label: string, list: NotificationListItem[]) => {
    if (!list.length) return null;
    return (
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">{label}</h2>
        <ul className="mt-3 space-y-3">
          {list.map((n) => (
            <li key={n.id}>
              <NotificationCard n={n} onMarkRead={markRead} />
            </li>
          ))}
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

  const showClientMobileNav = role === "client" && user?.id;

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <main
        className={`mx-auto max-w-2xl px-4 py-8 sm:py-10${showClientMobileNav ? " pb-28" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">Notifications</h1>
            <p className="mt-1 text-sm text-[#2C2C2C]/55">Updates and activity for your account.</p>
          </div>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={markingAll || rows.every((r) => r.read_at)}
            className="rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? "…" : "Mark all as read"}
          </button>
        </div>

        {loading ? (
          <div className="mt-10 h-48 animate-pulse rounded-2xl bg-[#2C2C2C]/5" />
        ) : rows.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white py-16 text-center shadow-sm">
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
      {showClientMobileNav ? (
        <ClientMobileBottomNav
          pathname={pathname}
          userId={user.id}
          avatarUrl={profile?.avatar_url?.trim() || null}
          fullName={profile?.full_name?.trim() ?? ""}
          unreadCount={bottomNavUnread}
        />
      ) : null}
    </div>
  );
}
