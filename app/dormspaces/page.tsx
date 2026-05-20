import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { DormspaceBrowse } from "@/components/dormspaces/dormspace-browse";
import { DormspaceHero } from "@/components/dormspaces/dormspace-hero";
import { DormspaceTrustStrip } from "@/components/dormspaces/dormspace-trust-strip";
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
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        <DormspaceHero />
        <DormspaceTrustStrip />
        <DormspaceBrowse listings={listings} />
      </main>
    </div>
  );
}
