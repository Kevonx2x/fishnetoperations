import type { SupabaseClient } from "@supabase/supabase-js";

const LISTING_ACTIVITY_MERGE_WINDOW_MS = 5 * 60 * 1000;

export async function logActivity(
  supabase: SupabaseClient,
  row: {
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("activity_log").insert({
    actor_id: row.actor_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id ?? null,
    metadata: row.metadata ?? {},
  });
}

/** Use service-role client. Merges listing_edited rows for the same property within 5 minutes. */
export async function upsertListingEditedActivity(
  admin: SupabaseClient,
  params: {
    actor_id: string;
    entity_id: string;
    metadata: Record<string, unknown>;
  },
) {
  const since = new Date(Date.now() - LISTING_ACTIVITY_MERGE_WINDOW_MS).toISOString();
  const { data: existing } = await admin
    .from("activity_log")
    .select("id")
    .eq("entity_type", "property")
    .eq("action", "listing_edited")
    .eq("entity_id", params.entity_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rowId = (existing as { id?: string } | null)?.id;
  const nowIso = new Date().toISOString();
  if (rowId) {
    const { error } = await admin
      .from("activity_log")
      .update({
        metadata: params.metadata,
        created_at: nowIso,
        actor_id: params.actor_id,
      })
      .eq("id", rowId);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("activity_log").insert({
    actor_id: params.actor_id,
    action: "listing_edited",
    entity_type: "property",
    entity_id: params.entity_id,
    metadata: params.metadata,
  });
  if (error) throw error;
}
