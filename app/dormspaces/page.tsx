import { DormspacePublicHome } from "@/components/dormspaces/dormspace-public-home";
import { DormspacesPublicTopNav } from "@/components/dormspaces/dormspaces-public-top-nav";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dormspaces & Coliving | BahayGo",
  description:
    "Verified bedspaces and coliving rooms for students, BPO workers, and young professionals across Metro Manila.",
};

export default async function DormspacesPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dormspaces")
    .select("*, dormspace_photos(id, url, display_order, created_at)")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });

  const listings = (error ? [] : (data ?? [])) as DormspaceWithPhotos[];

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <DormspacesPublicTopNav />
      <main>
        <DormspacePublicHome listings={listings} />
      </main>
    </div>
  );
}
