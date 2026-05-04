"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Trash, X } from "lucide-react";
import { toast } from "sonner";
import { AgentMessageClientReplyCard } from "@/components/notifications/client-notifications-panel";
import { DeleteAllNotificationsDialog } from "@/components/notifications/delete-all-notifications-dialog";
import {
  NotificationCard,
  resolveNotificationLink,
  type NotificationListItem,
} from "@/components/notifications/notification-list";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { requestDeleteAllNotifications } from "@/lib/notifications-delete-all-client";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DROPDOWN_LIMIT = 12;

export function NavNotificationsBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const { user, profile, role } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [deleteAllDialogCount, setDeleteAllDialogCount] = useState(0);

  const isAgent = role === "agent";

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      return;
    }
    setLoading(true);
    if (isAgent) {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, created_at, type, title, body, read_at, metadata, dismissed_by_agent, parent_id, property_name, reply_message",
        )
        .eq("user_id", user.id)
        .eq("dismissed_by_agent", false)
        .order("created_at", { ascending: false })
        .limit(DROPDOWN_LIMIT);
      if (!error) setRows((data ?? []) as NotificationListItem[]);
      else setRows([]);
    } else {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, created_at, type, title, body, read_at, metadata, dismissed_by_client, parent_id, property_name")
        .eq("user_id", user.id)
        .eq("dismissed_by_client", false)
        .order("created_at", { ascending: false })
        .limit(DROPDOWN_LIMIT);
      if (!error) setRows((data ?? []) as NotificationListItem[]);
      else setRows([]);
    }
    setLoading(false);
  }, [user?.id, supabase, isAgent]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

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
        window.dispatchEvent(new CustomEvent("bahaygo:notifications-read"));
      }
    }
    const href = navigateTo ?? resolveNotificationLink(n.metadata ?? null);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  const markAllRead = async () => {
    if (!user?.id || markingAll) return;
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

  const confirmDeleteAll = async () => {
    if (!user?.id || deleteAllBusy) return;
    setDeleteAllBusy(true);
    try {
      const result = await requestDeleteAllNotifications();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows([]);
      setDeleteAllOpen(false);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("bahaygo:notifications-read"));
      router.refresh();
      toast.success("All notifications deleted");
    } finally {
      setDeleteAllBusy(false);
    }
  };

  const dismissOne = async (n: NotificationListItem) => {
    if (!user?.id) return;
    const patch = isAgent ? { dismissed_by_agent: true } : { dismissed_by_client: true };
    const { error } = await supabase.from("notifications").update(patch).eq("id", n.id).eq("user_id", user.id);
    if (!error) setRows((prev) => prev.filter((x) => x.id !== n.id));
  };

  const openDeleteAllDialog = useCallback(async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    const total = count ?? 0;
    setDeleteAllDialogCount(Math.max(total, rows.length));
    setDeleteAllOpen(true);
  }, [user?.id, supabase, rows.length]);

  if (!user?.id) return null;

  return (
    <>
      <DeleteAllNotificationsDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        notificationCount={deleteAllDialogCount || rows.length}
        busy={deleteAllBusy}
        onConfirmDelete={confirmDeleteAll}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative inline-flex rounded-full border border-black/10 bg-white p-2 text-[#2C2C2C]/75 shadow-sm transition hover:bg-[#FAF8F4]"
            aria-label="Notifications"
            aria-expanded={open}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-white"
                aria-hidden
              />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(100vw-1.5rem,22rem)] gap-0 overflow-hidden rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-0 text-[#2C2C2C] shadow-lg ring-1 ring-black/5"
        >
          <div className="max-h-[min(70vh,26rem)] overflow-y-auto p-2">
            {loading ? (
              <p className="px-2 py-6 text-center text-xs font-semibold text-[#2C2C2C]/45">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs font-semibold text-[#2C2C2C]/45">No notifications yet</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((n) => (
                  <li key={n.id}>
                    {!isAgent && n.type === "agent_message" ? (
                      <AgentMessageClientReplyCard
                        n={n}
                        clientName={profile?.full_name?.trim() || user?.email?.trim() || "Client"}
                        onDismiss={async () => {
                          await dismissOne(n);
                        }}
                        onSent={() => void load()}
                      />
                    ) : (
                      <div className="relative">
                        <NotificationCard
                          n={n}
                          onMarkRead={markRead}
                          dismissGutter={!isAgent}
                        />
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await dismissOne(n);
                          }}
                          className={cn(
                            "absolute z-10 rounded-full p-2 text-[#2C2C2C]/45 hover:bg-gray-100 hover:text-[#2C2C2C]/70",
                            isAgent ? "right-3 top-3 p-1.5" : "right-2 top-2",
                          )}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#2C2C2C]/10 px-3 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[#6B9E6E] hover:underline"
            >
              View all
            </Link>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={markingAll || rows.length === 0 || rows.every((r) => r.read_at)}
              className="text-xs font-semibold text-[#6B9E6E] hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
            >
              {markingAll ? "…" : "Mark all as read"}
            </button>
            {rows.length > 0 ? (
              <button
                type="button"
                onClick={() => void openDeleteAllDialog()}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
              >
                <Trash className="size-3.5 shrink-0" aria-hidden />
                Delete all
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
