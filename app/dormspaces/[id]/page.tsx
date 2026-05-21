import { notFound } from "next/navigation";

import { DormspaceDetailView } from "@/components/dormspaces/dormspace-detail-view";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("dormspaces")
    .select("title")
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  return {
    title: data?.title ? `${data.title} | Dormspaces` : "Dormspace | BahayGo",
  };
}

export default async function DormspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("dormspaces")
    .select("*, dormspace_photos(id, url, display_order, created_at)")
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (error || !data) notFound();

  const listing = data as DormspaceWithPhotos;

  return (
    <DormspacePortalShell variant="browse">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 md:py-8">
        <DormspaceDetailView listing={listing} />
      </main>
    </DormspacePortalShell>
  );
}
