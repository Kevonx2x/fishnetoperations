import { DormspacePublicHomeClient } from "@/components/dormspaces/dormspace-public-home-client";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
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
    <DormspacePortalShell variant="browse">
      <main>
        <DormspacePublicHomeClient initialListings={listings} />
      </main>
    </DormspacePortalShell>
  );
}
