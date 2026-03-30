import type { SupabaseClient } from "@supabase/supabase-js";

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
