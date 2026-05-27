import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function fetchDormspaceListings(): Promise<DormspaceWithPhotos[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("dormspaces")
    .select("*, dormspace_photos(id, url, display_order, created_at)")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DormspaceWithPhotos[];
}
