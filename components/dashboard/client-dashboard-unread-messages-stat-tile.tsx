"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useStreamChat } from "@/features/messaging/components/stream-chat-provider";

const UNREAD_REFRESH_EVENTS = [
  "notification.mark_read",
  "notification.message_new",
  "notification.added_to_channel",
  "message.new",
  "message.read",
  "user.updated",
] as const;

function totalUnreadFromUser(client: NonNullable<ReturnType<typeof useStreamChat>>): number {
  const u = client.user;
  if (!u) return 0;
  const t = (u as { total_unread_count?: unknown }).total_unread_count;
  return typeof t === "number" ? t : 0;
}

export function ClientDashboardUnreadMessagesStatTile() {
  const client = useStreamChat();
  const [total, setTotal] = useState<number | null>(null);
  const [convoWithUnread, setConvoWithUnread] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!client?.userID) {
      setTotal(null);
      setConvoWithUnread(null);
      setFailed(false);
      return;
    }
    try {
      const t = totalUnreadFromUser(client);
      const channels = await client.queryChannels(
        { type: "messaging", members: { $in: [client.userID] } },
        [{ last_message_at: -1 }],
        { limit: 40 },
      );
      let n = 0;
      for (const ch of channels) {
        if (ch.countUnread() > 0) n++;
      }
      setTotal(t);
      setConvoWithUnread(n);
      setFailed(false);
    } catch {
      setFailed(true);
      setTotal(null);
      setConvoWithUnread(null);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!client) return;
    const onEvent = () => {
      void refresh();
    };
    for (const evt of UNREAD_REFRESH_EVENTS) {
      client.on(evt, onEvent);
    }
    return () => {
      for (const evt of UNREAD_REFRESH_EVENTS) {
        client.off(evt, onEvent);
      }
    };
  }, [client, refresh]);

  const numLabel = failed ? "—" : total == null ? "—" : String(total);
  const subline = failed
    ? "Unable to load"
    : total == null
      ? ""
      : total === 0
        ? "All caught up"
        : `From ${convoWithUnread ?? 0} conversation${(convoWithUnread ?? 0) === 1 ? "" : "s"}`;

  return (
    <Link
      href="/dashboard/client/messages"
      className="flex rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045] transition-colors hover:bg-[#2C2C2C]/[0.02]"
    >
      <div className="flex w-full min-w-0 items-start gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
          <MessageSquare className="size-5 text-[#6B9E6E]" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-2xl font-semibold leading-tight tracking-tight text-[#2C2C2C]">{numLabel}</p>
          <p className="mt-0.5 text-sm font-medium text-[#2C2C2C]">Unread messages</p>
          <p className="mt-1 text-xs text-gray-500">{subline}</p>
        </div>
      </div>
    </Link>
  );
}
