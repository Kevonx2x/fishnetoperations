import { notFound } from "next/navigation";

import { DormspaceDetailView } from "@/components/dormspaces/dormspace-detail-view";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import type { LandlordProfileTrust, LandlordPublicProfile } from "@/lib/dormspace-landlord-profile";
import {
  isVerifiedLandlordProfile,
  normalizeLandlordVerificationStatus,
} from "@/lib/landlord-verification";
import type { DormspaceStatus } from "@/lib/dormspaces";
import { fetchDormspaceListingByIdServer } from "@/lib/dormspace-listings-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function canViewDormspace(
  status: DormspaceStatus,
  landlordUserId: string | null,
  viewerUserId: string | undefined,
): boolean {
  if (status === "approved" || status === "pending") return true;
  return Boolean(viewerUserId && landlordUserId && viewerUserId === landlordUserId);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("dormspaces")
    .select("title, status, landlord_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!data || !canViewDormspace(data.status as DormspaceStatus, data.landlord_user_id, user?.id)) {
    return { title: "Dormspace | BahayGo" };
  }

  return {
    title: data.title ? `${data.title} | Dormspaces` : "Dormspace | BahayGo",
  };
}

export default async function DormspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const listing = await fetchDormspaceListingByIdServer(id);
  if (!listing) notFound();
  if (!canViewDormspace(listing.status, listing.landlord_user_id, user?.id)) {
    notFound();
  }

  const isOwnerViewing = Boolean(user?.id && listing.landlord_user_id === user.id);
  const showOwnerPendingBanner = isOwnerViewing && listing.status === "pending";

  let landlord: LandlordPublicProfile | null = null;
  let landlordTrust: LandlordProfileTrust | null = null;

  if (listing.landlord_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, phone, email, landlord_bio, landlord_languages, landlord_preferred_contact, landlord_years_renting, created_at, landlord_verification_status, landlord_cover_url, landlord_specialties, landlord_operating_areas, landlord_facebook_url, landlord_instagram_url, landlord_about_properties, landlord_viber, landlord_show_phone, landlord_show_whatsapp, landlord_show_email, landlord_show_viber, landlord_show_facebook, landlord_show_instagram",
      )
      .eq("id", listing.landlord_user_id)
      .maybeSingle();

    if (profile) {
      landlord = {
        ...(profile as LandlordPublicProfile),
        phone: profile.phone?.trim() || listing.landlord_phone?.trim() || null,
        email: (profile as { email?: string | null }).email?.trim() || listing.landlord_email?.trim() || null,
      };
      const verStatus = normalizeLandlordVerificationStatus(
        profile.landlord_verification_status as string | null | undefined,
      );

      const { count } = await supabase
        .from("dormspaces")
        .select("id", { count: "exact", head: true })
        .eq("landlord_user_id", listing.landlord_user_id)
        .eq("status", "approved");

      landlordTrust = {
        verified_landlord: isVerifiedLandlordProfile(verStatus),
        verification_pending: verStatus === "pending",
        free_listings: true,
        member_since: profile.created_at as string | null,
        active_listing_count: count ?? 0,
      };
    }
  }

  return (
    <DormspacePortalShell variant="browse">
      <main className="mx-auto max-w-6xl px-0 pb-28 md:px-6 md:py-8 md:pb-8">
        <DormspaceDetailView
          listing={listing}
          landlord={landlord}
          landlordTrust={landlordTrust}
          showOwnerPendingBanner={showOwnerPendingBanner}
        />
      </main>
    </DormspacePortalShell>
  );
}
