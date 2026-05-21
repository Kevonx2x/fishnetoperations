import { notFound } from "next/navigation";

import { DormspaceDetailView } from "@/components/dormspaces/dormspace-detail-view";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import type { LandlordProfileTrust, LandlordPublicProfile } from "@/lib/dormspace-landlord-profile";
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
    .eq("status", "approved")
    .maybeSingle();

  if (error || !data) notFound();

  const listing = data as DormspaceWithPhotos;
  let landlord: LandlordPublicProfile | null = null;
  let landlordTrust: LandlordProfileTrust | null = null;

  if (listing.landlord_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, phone, landlord_bio, landlord_languages, landlord_preferred_contact, landlord_years_renting, created_at",
      )
      .eq("id", listing.landlord_user_id)
      .maybeSingle();

    if (profile) {
      landlord = profile as LandlordPublicProfile;
      const { data: landlordListings } = await supabase
        .from("dormspaces")
        .select("status, landlord_id_url")
        .eq("landlord_user_id", listing.landlord_user_id);

      const rows = landlordListings ?? [];
      landlordTrust = {
        verified_landlord:
          rows.some((r) => r.status === "approved") ||
          rows.some((r) => Boolean((r.landlord_id_url as string | null)?.trim())),
        free_listings: true,
        member_since: profile.created_at as string | null,
      };
    }
  }

  return (
    <DormspacePortalShell variant="browse">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 md:py-8">
        <DormspaceDetailView listing={listing} landlord={landlord} landlordTrust={landlordTrust} />
      </main>
    </DormspacePortalShell>
  );
}
