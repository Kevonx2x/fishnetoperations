"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Bell,
  Calendar,
  CheckCheck,
  Clock,
  ExternalLink,
  FileText,
  Handshake,
  Headphones,
  Heart,
  Home,
  ListChecks,
  MessageSquare,
  Sparkles,
  TrendingDown,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NotificationListItem } from "@/components/notifications/notification-list";
import { viewingRequestNotificationDisplay } from "@/components/notifications/notification-list";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDashboardRelativeTimeManila } from "@/lib/dashboard-relative-time-manila";
import {
  clientNotificationActorName,
  clientNotificationBodyPlain,
  clientNotificationHeadline,
  clientNotificationIconKey,
  clientNotificationManilaDayBucket,
  clientNotificationRowHref,
  type ClientNotificationDayBucket,
} from "@/lib/client-notifications-page";

function BodyWithOptionalBold({ text, actor }: { text: string; actor?: string | null }) {
  const a = actor?.trim();
  if (!a || !text) return <span className="text-sm leading-snug text-gray-700">{text}</span>;
  const idx = text.indexOf(a);
  if (idx === -1) return <span className="text-sm leading-snug text-gray-700">{text}</span>;
  return (
    <span className="text-sm leading-snug text-gray-700">
      {text.slice(0, idx)}
      <strong className="font-semibold text-[#2C2C2C]">{a}</strong>
      {text.slice(idx + a.length)}
    </span>
  );
}

function notificationBodyLine(n: NotificationListItem): string {
  if (n.type === "viewing_request") {
    const { body } = viewingRequestNotificationDisplay(n);
    return (body?.trim() || n.body || n.title || "").trim();
  }
  return clientNotificationBodyPlain(n);
}

function rowIconForKey(key: string): LucideIcon {
  switch (key) {
    case "calendar":
      return Calendar;
    case "home":
      return Home;
    case "filetext":
      return FileText;
    case "messagesquare":
      return MessageSquare;
    case "heart":
      return Heart;
    case "award":
      return Award;
    case "trendingdown":
      return TrendingDown;
    case "badgecheck":
      return BadgeCheck;
    case "clock":
      return Clock;
    case "users":
      return Users;
    case "handshake":
      return Handshake;
    default:
      return Bell;
  }
}

const BUCKET_ORDER: ClientNotificationDayBucket[] = ["today", "yesterday", "this_week", "earlier"];

const BUCKET_LABEL: Record<ClientNotificationDayBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  earlier: "Earlier",
};

export function ClientNotificationsPageContent() {
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [hasMoreHint, setHasMoreHint] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setHasMoreHint(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, created_at, type, title, body, read_at, metadata, dismissed_by_client, parent_id, property_name")
      .eq("user_id", user.id)
      .eq("dismissed_by_client", false)
      .order("created_at", { ascending: false })
      .limit(51);
    if (error) {
      setRows([]);
      setHasMoreHint(false);
    } else {
      const list = (data ?? []) as NotificationListItem[];
      setHasMoreHint(list.length > 50);
      setRows(list.slice(0, 50));
    }
    setLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const buckets: Record<ClientNotificationDayBucket, NotificationListItem[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const n of rows) {
      buckets[clientNotificationManilaDayBucket(n.created_at)].push(n);
    }
    return buckets;
  }, [rows]);

  const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  const markOneRead = useCallback(
    async (n: NotificationListItem) => {
      if (!user?.id || n.read_at) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", n.id)
        .eq("user_id", user.id);
      if (!error) {
        setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)));
        window.dispatchEvent(new CustomEvent("bahaygo:notifications-read"));
      }
    },
    [user?.id, supabase],
  );

  const markAllRead = async () => {
    if (!user?.id || markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (!error) {
      setRows((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: now })));
      window.dispatchEvent(new CustomEvent("bahaygo:notifications-read"));
    }
    setMarkingAll(false);
  };

  const welcomeRail = (
    <div className="flex flex-col gap-4 lg:sticky lg:top-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#F6F9F6] to-white p-6 ring-1 ring-[#2C2C2C]/[0.045]">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#6B9E6E]/10">
          <Sparkles className="size-5 text-[#6B9E6E]" aria-hidden />
        </div>
        <h2 className="mt-4 font-serif text-xl font-semibold text-[#2C2C2C]">Welcome to BahayGo! 🏡</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#2C2C2C]/70">
          We&apos;re glad you&apos;re here. Browse listings, track your deals, and message agents — all in one place.
        </p>
        <Link
          href="/dashboard/client"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5d8a60]"
        >
          Explore Dashboard
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
        <div className="my-5 border-t border-[#2C2C2C]/10" />
        <p className="text-sm font-semibold text-[#2C2C2C]">Get the most out of BahayGo</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { Icon: ListChecks, label: "Track your deals", desc: "See every property in your pipeline" },
            { Icon: MessageSquare, label: "Message agents", desc: "Stay in touch with your team" },
            { Icon: Calendar, label: "Schedule viewings", desc: "Book and manage in-person visits" },
            { Icon: Award, label: "Earn badges", desc: "Unlock perks as you explore" },
          ].map(({ Icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center text-center">
              <div className="flex size-9 items-center justify-center rounded-full bg-[#6B9E6E]/10">
                <Icon className="size-4 text-[#6B9E6E]" aria-hidden />
              </div>
              <p className="mt-2 text-xs font-semibold text-[#2C2C2C]">{label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#2C2C2C]/55">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045]">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
            <Headphones className="size-5 text-[#6B9E6E]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#2C2C2C]">Need help right now?</p>
            <p className="mt-1 text-xs leading-relaxed text-[#2C2C2C]/60">
              Our support team typically responds within a few hours.
            </p>
            <Link
              href="/faq"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B9E6E] hover:underline"
            >
              Visit our Help Center
              <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  const feedHeader = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">Notifications</h1>
        <p className="mt-1 text-sm text-gray-600">Updates and activity for your account.</p>
      </div>
      {unreadCount > 0 ? (
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={markingAll}
          className="inline-flex items-center gap-2 rounded-full border border-[#6B9E6E] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/5 disabled:opacity-50"
        >
          <CheckCheck className="size-3.5 shrink-0" aria-hidden />
          {markingAll ? "…" : "Mark all as read"}
        </button>
      ) : null}
    </div>
  );

  if (!user?.id) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-sm font-medium text-gray-600">Sign in to see notifications.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="min-w-0">
          {feedHeader}

          {loading ? (
            <div className="mt-8 h-48 animate-pulse rounded-2xl bg-[#2C2C2C]/5" />
          ) : rows.length === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center rounded-2xl bg-white py-16 ring-1 ring-[#2C2C2C]/[0.045]">
              <Bell className="size-10 text-[#2C2C2C]/25" strokeWidth={1.25} aria-hidden />
              <p className="mt-4 font-serif text-lg font-semibold text-[#2C2C2C]">No notifications yet</p>
              <p className="mt-1 max-w-sm text-center text-sm text-gray-600">
                Activity from your home search will show up here
              </p>
              <Link
                href="/"
                className="mt-6 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5d8a60]"
              >
                Browse listings
              </Link>
            </div>
          ) : (
            <div className="mt-6">
              {BUCKET_ORDER.map((bucket) => {
                const list = grouped[bucket];
                if (!list.length) return null;
                return (
                  <section key={bucket} className="mb-6 last:mb-0">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {BUCKET_LABEL[bucket]}
                    </h2>
                    <ul className="mt-3">
                      {list.map((n) => {
                        const href = clientNotificationRowHref(n, user.id);
                        const Icon = rowIconForKey(clientNotificationIconKey(n.type));
                        const headline = clientNotificationHeadline(n);
                        const bodyLine = notificationBodyLine(n);
                        const actor = clientNotificationActorName(n.metadata);
                        const unread = !n.read_at;
                        return (
                          <li key={n.id} className="mb-3 last:mb-0">
                            <Link
                              href={href}
                              onClick={() => void markOneRead(n)}
                              className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045] transition hover:bg-[#FAF8F4]/80"
                            >
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
                                <Icon className="size-6 text-[#6B9E6E]" aria-hidden />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[#2C2C2C]">{headline}</p>
                                {bodyLine ? (
                                  <div className="mt-0.5">
                                    <BodyWithOptionalBold text={bodyLine} actor={actor} />
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                                <span className="text-xs text-gray-500">
                                  {formatDashboardRelativeTimeManila(n.created_at)}
                                </span>
                                {unread ? (
                                  <span
                                    className="size-2 shrink-0 rounded-full bg-[#6B9E6E]"
                                    aria-label="Unread"
                                  />
                                ) : null}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              {hasMoreHint ? (
                <p className="mt-4 text-center text-xs font-medium text-gray-500">Scroll to see more</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="min-w-0 lg:order-none">{welcomeRail}</div>
      </div>
    </div>
  );
}
