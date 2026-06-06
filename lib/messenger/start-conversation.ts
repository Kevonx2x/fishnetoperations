import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type StartConversationInput = {
  currentUserId: string;
  otherUserId: string;
  propertyId?: string | null;
  dormspaceId?: string | null;
};

export type StartConversationResult =
  | { ok: true; conversationId: string; created: boolean }
  | { ok: false; code: string; message: string; status: number };

async function sharedConversationIds(
  supabase: SupabaseClient,
  userA: string,
  userB: string,
): Promise<string[]> {
  const { data: rowsA, error: errA } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userA);

  if (errA) throw errA;
  const idsA = new Set((rowsA ?? []).map((r) => r.conversation_id as string));
  if (idsA.size === 0) return [];

  const { data: rowsB, error: errB } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userB)
    .in("conversation_id", [...idsA]);

  if (errB) throw errB;
  return (rowsB ?? []).map((r) => r.conversation_id as string);
}

/** Find the oldest 1-to-1 thread between two users (property/dormspace ignored). */
async function findExistingConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  otherUserId: string,
): Promise<string | null> {
  const sharedIds = await sharedConversationIds(supabase, currentUserId, otherUserId);
  if (sharedIds.length === 0) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .in("id", sharedIds)
    .eq("is_group", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/** Backfill property/dormspace context on an existing thread when still unset. */
async function maybeSetConversationContext(
  supabase: SupabaseClient,
  conversationId: string,
  propertyId?: string | null,
  dormspaceId?: string | null,
): Promise<void> {
  if (!propertyId && !dormspaceId) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("property_id, dormspace_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return;

  const updates: { property_id?: string; dormspace_id?: string } = {};
  if (propertyId && !data.property_id) updates.property_id = propertyId;
  if (dormspaceId && !data.dormspace_id) updates.dormspace_id = dormspaceId;
  if (Object.keys(updates).length === 0) return;

  const { error: updateErr } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", conversationId);

  if (!updateErr) return;

  const admin = createSupabaseAdmin();
  const { error: adminErr } = await admin
    .from("conversations")
    .update(updates)
    .eq("id", conversationId);
  if (adminErr) throw adminErr;
}

async function insertParticipants(
  supabase: SupabaseClient,
  conversationId: string,
  currentUserId: string,
  otherUserId: string,
): Promise<void> {
  const rows = [
    { conversation_id: conversationId, user_id: currentUserId },
    { conversation_id: conversationId, user_id: otherUserId },
  ];

  const { error } = await supabase.from("conversation_participants").insert(rows);
  if (!error) return;

  const admin = createSupabaseAdmin();
  const { error: adminErr } = await admin.from("conversation_participants").insert(rows);
  if (adminErr) throw adminErr;
}

export async function startConversation(
  supabase: SupabaseClient,
  input: StartConversationInput,
): Promise<StartConversationResult> {
  const { currentUserId, otherUserId, propertyId, dormspaceId } = input;

  if (currentUserId === otherUserId) {
    return {
      ok: false,
      code: "SELF_CONVERSATION",
      message: "You cannot start a conversation with yourself.",
      status: 400,
    };
  }

  const { data: otherProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", otherUserId)
    .maybeSingle();

  if (profileErr) {
    console.error("[startConversation] profile lookup failed", profileErr);
    return { ok: false, code: "SERVER_ERROR", message: "Could not verify recipient.", status: 500 };
  }

  if (!otherProfile?.id) {
    return { ok: false, code: "NOT_FOUND", message: "Recipient not found.", status: 404 };
  }

  try {
    const existingId = await findExistingConversation(supabase, currentUserId, otherUserId);
    if (existingId) {
      await maybeSetConversationContext(supabase, existingId, propertyId, dormspaceId);
      return { ok: true, conversationId: existingId, created: false };
    }

    const insertPayload = {
      is_group: false,
      created_by: currentUserId,
      property_id: propertyId ?? null,
      dormspace_id: dormspaceId ?? null,
    };

    let { data: created, error: createErr } = await supabase
      .from("conversations")
      .insert(insertPayload)
      .select("id")
      .single();

    if (createErr || !created?.id) {
      const admin = createSupabaseAdmin();
      const retry = await admin.from("conversations").insert(insertPayload).select("id").single();
      created = retry.data;
      createErr = retry.error;
    }

    if (createErr || !created?.id) {
      console.error("[startConversation] create failed", createErr);
      return {
        ok: false,
        code: "SERVER_ERROR",
        message: "Could not create conversation.",
        status: 500,
      };
    }

    const conversationId = created.id as string;
    await insertParticipants(supabase, conversationId, currentUserId, otherUserId);

    return { ok: true, conversationId, created: true };
  } catch (e) {
    console.error("[startConversation] failed", e);
    return {
      ok: false,
      code: "SERVER_ERROR",
      message: "Could not start conversation.",
      status: 500,
    };
  }
}
