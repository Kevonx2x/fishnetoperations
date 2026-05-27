import type { UniversityRow } from "@/lib/universities";
import { withUniversityImageDefaults } from "@/lib/university-default-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function fetchActiveUniversitiesServer(): Promise<UniversityRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("universities")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.warn("[universities] fetch failed (migration may be pending)", error.message);
    return [];
  }

  return withUniversityImageDefaults((data ?? []) as UniversityRow[]);
}
