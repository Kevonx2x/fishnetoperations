import type { SupabaseClient } from "@supabase/supabase-js";

/** Drop likes/saves on dormspaces the user owns (landlord_user_id). */
export async function excludeOwnDormspaceEngagementIds(
  supabase: SupabaseClient,
  userId: string,
  dormspaceIds: string[],
): Promise<string[]> {
  if (!dormspaceIds.length) return [];
  const { data, error } = await supabase
    .from("dormspaces")
    .select("id")
    .in("id", dormspaceIds)
    .eq("landlord_user_id", userId);
  if (error) return dormspaceIds;
  const own = new Set((data ?? []).map((r: { id: string }) => r.id));
  return dormspaceIds.filter((id) => !own.has(id));
}
