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

async function findExistingConversation(
  supabase: SupabaseClient,
  input: StartConversationInput,
): Promise<string | null> {
  const sharedIds = await sharedConversationIds(supabase, input.currentUserId, input.otherUserId);
  if (sharedIds.length === 0) return null;

  let query = supabase
    .from("conversations")
    .select("id")
    .in("id", sharedIds)
    .eq("is_group", false);

  if (input.propertyId) {
    query = query.eq("property_id", input.propertyId);
  } else {
    query = query.is("property_id", null);
  }

  if (input.dormspaceId) {
    query = query.eq("dormspace_id", input.dormspaceId);
  } else {
    query = query.is("dormspace_id", null);
  }

  const { data, error } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
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
    const existingId = await findExistingConversation(supabase, input);
    if (existingId) {
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
