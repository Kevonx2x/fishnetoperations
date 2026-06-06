import type { SupabaseClient } from "@supabase/supabase-js";

import type { MessengerConversation } from "../types";
import type { DbConversation, DbMessage, DbParticipantWithProfile } from "./db-types";
import { formatConversationListTime, initialsFromName } from "./format";

function profileFromJoin(
  profiles: DbParticipantWithProfile["profiles"],
): { id: string; full_name: string | null; avatar_url: string | null } | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

function lastMessagePreview(msg: DbMessage | undefined): string {
  if (!msg) return "No messages yet";
  const body = msg.body?.trim();
  if (body) return body;
  if (msg.attachment_url?.trim()) return "📷 Photo";
  return "No messages yet";
}

function latestMessageByConversation(messages: DbMessage[]): Map<string, DbMessage> {
  const map = new Map<string, DbMessage>();
  for (const m of messages) {
    const prev = map.get(m.conversation_id);
    if (!prev || new Date(m.created_at) > new Date(prev.created_at)) {
      map.set(m.conversation_id, m);
    }
  }
  return map;
}

export async function fetchConversationsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<MessengerConversation[]> {
  type MyParticipantRow = {
    conversation_id: string;
    last_read_at: string | null;
    is_favorite?: boolean | null;
  };

  const partRes = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at, is_favorite")
    .eq("user_id", userId);

  let myRows: MyParticipantRow[];

  if (partRes.error?.message?.includes("is_favorite")) {
    const fallback = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId);
    if (fallback.error) throw fallback.error;
    myRows = (fallback.data ?? []) as MyParticipantRow[];
  } else {
    if (partRes.error) throw partRes.error;
    myRows = (partRes.data ?? []) as MyParticipantRow[];
  }
  if (!myRows?.length) return [];

  const myByConv = new Map(
    myRows.map((r) => [
      r.conversation_id as string,
      {
        last_read_at: (r.last_read_at as string | null) ?? null,
        is_favorite: Boolean(r.is_favorite),
      },
    ]),
  );

  const convIds = [...myByConv.keys()];

  const { data: convRows, error: convErr } = await supabase
    .from("conversations")
    .select("id, last_message_at, created_at")
    .in("id", convIds)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (convErr) throw convErr;

  const { data: peerRows, error: peerErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id, last_read_at, profiles(id, full_name, avatar_url)")
    .in("conversation_id", convIds)
    .neq("user_id", userId);

  if (peerErr) throw peerErr;

  const peerByConv = new Map<string, DbParticipantWithProfile>();
  for (const row of (peerRows ?? []) as DbParticipantWithProfile[]) {
    if (!peerByConv.has(row.conversation_id)) {
      peerByConv.set(row.conversation_id, row);
    }
  }

  const { data: messageRows, error: msgErr } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, attachment_url, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });

  if (msgErr) throw msgErr;

  const lastMsgMap = latestMessageByConversation((messageRows ?? []) as DbMessage[]);

  const unreadCounts = await Promise.all(
    convIds.map(async (convId) => {
      const lastRead = myByConv.get(convId)?.last_read_at;
      let q = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .neq("sender_id", userId);

      if (lastRead) {
        q = q.gt("created_at", lastRead);
      }

      const { count, error } = await q;
      if (error) throw error;
      return [convId, count ?? 0] as const;
    }),
  );

  const unreadByConv = new Map(unreadCounts);

  const conversations: MessengerConversation[] = [];

  for (const conv of (convRows ?? []) as DbConversation[]) {
    const mine = myByConv.get(conv.id);
    const peer = peerByConv.get(conv.id);
    const profile = peer ? profileFromJoin(peer.profiles) : null;
    const name = profile?.full_name?.trim() || "Unknown";
    const lastMsg = lastMsgMap.get(conv.id);

    conversations.push({
      id: conv.id,
      participant: {
        id: profile?.id ?? peer?.user_id ?? "",
        name,
        initials: initialsFromName(name),
        online: false,
      },
      lastMessage: lastMessagePreview(lastMsg),
      timestamp: formatConversationListTime(conv.last_message_at ?? lastMsg?.created_at),
      unread: unreadByConv.get(conv.id) ?? 0,
      favorite: mine?.is_favorite ?? false,
      messages: [],
      peerLastReadAt: peer?.last_read_at ?? null,
      myLastReadAt: mine?.last_read_at ?? null,
    });
  }

  return conversations;
}
