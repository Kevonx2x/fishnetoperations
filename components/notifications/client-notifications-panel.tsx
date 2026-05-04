"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  NotificationCard,
  resolveNotificationLink,
  type NotificationListItem,
} from "@/components/notifications/notification-list";
import { formatRelativeTime } from "@/lib/relative-time";

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

export function AgentMessageClientReplyCard({
  n,
  clientName,
  onDismiss,
  onSent,
}: {
  n: NotificationListItem;
  clientName: string;
  onDismiss: () => void | Promise<void>;
  onSent: () => void;
}) {
  const meta = (n.metadata ?? {}) as Record<string, unknown>;
  const parsed =
    typeof n.title === "string"
      ? /^Message from (.+) about (.+)$/i.exec(n.title.trim())
      : null;
  const agentName =
    (typeof meta.agent_name === "string" ? meta.agent_name.trim() : "") ||
    (typeof meta.from_agent_name === "string" ? meta.from_agent_name.trim() : "") ||
    (parsed?.[1]?.trim() ?? "") ||
    "Agent";
  const propertyName =
    (typeof n.metadata?.property_name === "string" ? n.metadata.property_name.trim() : "") ||
    ((meta.property_name as string | undefined) ?? "").trim() ||
    ((n as unknown as { property_name?: string | null }).property_name ?? "").trim() ||
    (parsed?.[2]?.trim() ?? "") ||
    "Property";

  const agentUserId =
    typeof meta.from_agent_user_id === "string"
      ? meta.from_agent_user_id
      : typeof meta.agent_user_id === "string"
        ? meta.agent_user_id
        : "";

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const quick = [
    "Interested let us talk",
    "Can we schedule a viewing",
    "Send me more details",
  ] as const;

  const send = async () => {
    if (!agentUserId) return;
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    try {
      const res = await fetch("/api/client/notification-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notification_id: n.id, reply_message: msg }),
      });
      await res.json().catch(() => ({}));
      if (!res.ok) {
        return;
      }
      setText("");
      onSent();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative rounded-2xl border border-[#2C2C2C]/10 bg-white py-4 pl-4 pr-14 shadow-sm">
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          void onDismiss();
        }}
        className="absolute right-2 top-2 z-10 rounded-full p-2 text-[#2C2C2C]/45 hover:bg-gray-100 hover:text-[#2C2C2C]/70"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex justify-end">
        <span className="text-xs font-semibold tabular-nums text-[#2C2C2C]/45">
          {formatRelativeTime(n.created_at)}
        </span>
      </div>
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#6B9E6E]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#2d5a30]">
            {agentName}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-900">
            {propertyName}
          </span>
        </div>
        <p className="mt-2 font-bold text-[#2C2C2C]">{n.title}</p>
        {n.body ? <p className="mt-1 text-sm font-medium text-[#2C2C2C]/70">{n.body}</p> : null}
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-[#FAF8F4] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/55">Reply</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setText(q)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-900 shadow-sm hover:bg-gray-50"
            >
              {q}
            </button>
          ))}
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your reply…"
          className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm outline-none focus:border-[#6B9E6E]/60"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void send()}
          className="mt-3 w-full rounded-full bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Send Reply"}
        </button>
        <p className="mt-2 text-[11px] font-medium text-[#2C2C2C]/50">Sending as {clientName}</p>
      </div>
    </div>
  );
}

export function ClientNotificationsPanel() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<NotificationListItem[]>([]);
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
      .select("id, created_at, type, title, body, read_at, metadata, dismissed_by_client, parent_id, property_name")
      .eq("user_id", user.id)
      .eq("dismissed_by_client", false)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) {
      setRows((data ?? []) as NotificationListItem[]);
    }
    setLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

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
              {n.type === "agent_message" ? (
                <AgentMessageClientReplyCard
                  n={n}
                  clientName={profile?.full_name?.trim() || user?.email?.trim() || "Client"}
                  onDismiss={async () => {
                    if (!user?.id) return;
                    const { error } = await supabase
                      .from("notifications")
                      .update({ dismissed_by_client: true })
                      .eq("id", n.id)
                      .eq("user_id", user.id);
                    if (!error) setRows((prev) => prev.filter((x) => x.id !== n.id));
                  }}
                  onSent={() => void load()}
                />
              ) : (
                <div className="relative">
                  <NotificationCard n={n} onMarkRead={markRead} dismissGutter />
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!user?.id) return;
                      const { error } = await supabase
                        .from("notifications")
                        .update({ dismissed_by_client: true })
                        .eq("id", n.id)
                        .eq("user_id", user.id);
                      if (!error) setRows((prev) => prev.filter((x) => x.id !== n.id));
                    }}
                    className="absolute right-2 top-2 z-10 rounded-full p-2 text-[#2C2C2C]/45 hover:bg-gray-100 hover:text-[#2C2C2C]/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  };

  const inner = (
    <>
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
    </>
  );

  return <div className="w-full">{inner}</div>;
}
