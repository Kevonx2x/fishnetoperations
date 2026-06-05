"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { toast } from "sonner";
import {
  AirVent,
  BadgeCheck,
  Droplets,
  MapPin,
  Shield,
  UtensilsCrossed,
  Wifi,
  WashingMachine,
  Zap,
} from "lucide-react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

import { DormspaceWalkTimesLine } from "@/components/dormspaces/dormspace-walk-times-line";
import { DormspaceBedAvailability } from "@/components/dormspaces/dormspace-bed-availability";
import { DormspaceContactModal } from "@/components/dormspaces/dormspace-contact-modal";
import { DormspaceDetailBackLink } from "@/components/dormspaces/dormspace-detail-hero-chrome";
import { DormspaceDetailGallery } from "@/components/dormspaces/dormspace-detail-gallery";
import { DormspaceEngagementButtons } from "@/components/dormspaces/dormspace-engagement-buttons";
import { DormspaceLandlordPublicCard } from "@/components/dormspaces/dormspace-landlord-public-card";
import { DormspaceVerificationBadge } from "@/components/dormspaces/dormspace-verification-badge";
import type { LandlordProfileTrust, LandlordPublicProfile } from "@/lib/dormspace-landlord-profile";
import {
  activeDormspaceAmenities,
  dormspaceBedAvailability,
  dormspaceGenderLabel,
  dormspaceLocationLine,
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  sortedDormspacePhotos,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import { clientMessagesHref } from "@/lib/messenger/client-messages-path";
import { startMessengerConversation } from "@/lib/messenger/start-conversation-client";

function AmenityIcon({ label }: { label: string }) {
  const cls = "size-5 text-[#6B9E6E]";
  const l = label.toLowerCase();
  if (l.includes("wifi")) return <Wifi className={cls} aria-hidden />;
  if (l.includes("aircon")) return <AirVent className={cls} aria-hidden />;
  if (l.includes("kitchen")) return <UtensilsCrossed className={cls} aria-hidden />;
  if (l.includes("laundry")) return <WashingMachine className={cls} aria-hidden />;
  if (l.includes("water")) return <Droplets className={cls} aria-hidden />;
  if (l.includes("electric")) return <Zap className={cls} aria-hidden />;
  if (l.includes("security")) return <Shield className={cls} aria-hidden />;
  return null;
}

export function DormspaceDetailView({
  listing,
  landlord,
  landlordTrust,
  showOwnerPendingBanner = false,
}: {
  listing: DormspaceWithPhotos;
  landlord?: LandlordPublicProfile | null;
  landlordTrust?: LandlordProfileTrust | null;
  showOwnerPendingBanner?: boolean;
}) {
  const photos = sortedDormspacePhotos(listing.dormspace_photos ?? null);
  const urls = photos.map((p) => p.url).filter(Boolean);
  const { user } = useAuth();
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);
  const [notifyWhenAvailable, setNotifyWhenAvailable] = useState(false);
  const [messageHostBusy, setMessageHostBusy] = useState(false);
  const bedInfo = dormspaceBedAvailability(listing);
  const isOwnListing =
    !!user?.id && !!listing.landlord_user_id && user.id === listing.landlord_user_id;

  const onMessageHost = useCallback(async () => {
    if (messageHostBusy || isOwnListing) return;
    const hostId = listing.landlord_user_id?.trim();
    if (!hostId) {
      toast.error("Host profile is not available yet.");
      return;
    }
    if (!user?.id) {
      setContactOpen(true);
      return;
    }
    if (user.id === hostId) return;

    setMessageHostBusy(true);
    try {
      const result = await startMessengerConversation({
        otherUserId: hostId,
        dormspaceId: listing.id,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(clientMessagesHref(result.conversationId));
    } finally {
      setMessageHostBusy(false);
    }
  }, [isOwnListing, listing.id, listing.landlord_user_id, messageHostBusy, router, user?.id]);

  const lat = listing.latitude != null ? Number(listing.latitude) : null;
  const lng = listing.longitude != null ? Number(listing.longitude) : null;
  const hasMap = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";
  const amenities = activeDormspaceAmenities(listing);
  const deposit =
    listing.deposit_months != null && String(listing.deposit_months).trim()
      ? `${listing.deposit_months} month${Number(listing.deposit_months) === 1 ? "" : "s"} deposit`
      : null;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden pb-20 md:pb-16">
      <DormspaceDetailBackLink />

      {showOwnerPendingBanner ? (
        <div
          className="mx-4 mb-4 max-w-[calc(100%-2rem)] break-words rounded-2xl border border-[#D4A843]/35 bg-[#D4A843]/10 px-4 py-3.5 text-sm font-medium text-[#2C2C2C] md:mx-0 md:max-w-none"
          role="status"
        >
          Your listing is under review. Tenants will see this listing with a &quot;Pending verification&quot;
          badge once it goes live.
        </div>
      ) : null}

      <DormspaceDetailGallery
        urls={urls}
        title={listing.title}
        dormspaceId={listing.id}
        landlordUserId={listing.landlord_user_id}
      />

      <div className="mt-4 min-w-0 max-w-full overflow-hidden border-[#DDDDDD] bg-white md:mt-6 md:rounded-2xl md:border md:shadow-md">
        <div className="grid min-w-0 gap-8 p-5 md:grid-cols-[1fr_280px] md:p-8">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#6B9E6E]/12 px-2.5 py-1 text-xs font-bold text-[#3d5a40]">
                {dormspaceRoomTypeLabel(listing.room_type)}
              </span>
              <span className="rounded-full bg-[#FAF8F4] px-2.5 py-1 text-xs font-bold text-[#484848] ring-1 ring-[#2C2C2C]/10">
                {dormspaceGenderLabel(listing.gender_preference)}
              </span>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap items-start gap-3 gap-y-2">
              <h1 className="min-w-0 flex-1 break-words font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">
                {listing.title}
              </h1>
              <DormspaceEngagementButtons
                dormspaceId={listing.id}
                landlordUserId={listing.landlord_user_id}
                signInNext={`/dormspaces/${listing.id}`}
                size="md"
                className="rounded-full md:hidden"
              />
              <DormspaceVerificationBadge status={listing.status} />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[#484848]">
              <MapPin className="size-4 shrink-0 text-[#6B9E6E]" aria-hidden />
              {dormspaceLocationLine(listing)}
            </p>
            <DormspaceWalkTimesLine listing={listing} className="mt-1.5" />
            {listing.near_school?.trim() ? (
              <p className="mt-2 text-sm font-medium text-[#525252]">Near: {listing.near_school.trim()}</p>
            ) : null}
            <p className="mt-4 text-2xl font-bold text-[#D4A843]">{formatDormspacePrice(listing.monthly_price)}</p>
            {deposit ? <p className="text-sm font-medium text-[#484848]">{deposit}</p> : null}
            <DormspaceBedAvailability listing={listing} variant="detail" />
            {listing.vacancy_notes?.trim() ? (
              <p className="mt-2 text-sm font-medium text-[#525252]">{listing.vacancy_notes.trim()}</p>
            ) : null}
            {bedInfo.status === "full" && !isOwnListing ? (
              <button
                type="button"
                onClick={() => {
                  setNotifyWhenAvailable(true);
                  setContactOpen(true);
                }}
                className="mt-4 rounded-full border border-[#6B9E6E]/40 bg-[#6B9E6E]/10 px-4 py-2 text-sm font-bold text-[#4a7a4d] hover:bg-[#6B9E6E]/15"
              >
                Notify me when available
              </button>
            ) : null}

            {listing.description?.trim() ? (
              <section className="mt-8">
                <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">About this space</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#484848]">
                  {listing.description.trim()}
                </p>
              </section>
            ) : null}

            {amenities.length > 0 ? (
              <section className="mt-8">
                <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Amenities</h2>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {amenities.map((a) => (
                    <li
                      key={a.key}
                      className="flex items-center gap-2 rounded-xl border border-[#2C2C2C]/8 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                    >
                      <AmenityIcon label={a.label} />
                      {a.label}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {listing.curfew?.trim() || listing.rules_notes?.trim() ? (
              <section className="mt-8">
                <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">House rules</h2>
                {listing.curfew?.trim() ? (
                  <p className="mt-2 text-sm font-medium text-[#484848]">
                    <span className="font-bold text-[#2C2C2C]">Curfew:</span> {listing.curfew.trim()}
                  </p>
                ) : null}
                {listing.rules_notes?.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#484848]">
                    {listing.rules_notes.trim()}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>

          {landlord ? (
            <DormspaceLandlordPublicCard
              landlord={landlord}
              listingId={listing.id}
              listingTitle={listing.title}
              isOwnListing={isOwnListing}
              trust={
                landlordTrust ?? {
                  verified_landlord: false,
                  verification_pending: false,
                  free_listings: true,
                  member_since: landlord.created_at,
                  active_listing_count: 1,
                }
              }
              onContact={() => setContactOpen(true)}
              onMessageHost={() => void onMessageHost()}
              messageHostBusy={messageHostBusy}
            />
          ) : (
            <aside className="h-fit rounded-2xl border border-[#DDDDDD] bg-[#FAF8F4] p-5">
              <div className="flex flex-wrap items-center gap-2">
                {listing.status === "approved" ? (
                  <div className="flex items-center gap-2 text-sm font-bold text-[#2C2C2C]">
                    <BadgeCheck className="size-5 text-[#D4A843]" aria-hidden />
                    Verified landlord
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-[#5c5c5c]">Landlord (verification in progress)</p>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-[#484848]">{listing.landlord_name}</p>
              {!isOwnListing && listing.landlord_user_id ? (
                <button
                  type="button"
                  onClick={() => void onMessageHost()}
                  disabled={messageHostBusy}
                  className="mt-5 w-full rounded-xl border border-[#6B9E6E]/35 bg-white py-3 text-sm font-bold text-[#4a7a4d] shadow-sm transition hover:bg-[#6B9E6E]/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {messageHostBusy ? "Opening…" : "Message host"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="mt-3 w-full rounded-xl bg-[#6B9E6E] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
              >
                Contact landlord
              </button>
            </aside>
          )}
        </div>
      </div>

      {hasMap && mapKey ? (
        <section className="mt-10 min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#DDDDDD]">
          <h2 className="border-b border-[#2C2C2C]/8 bg-white px-5 py-3 font-serif text-lg font-bold text-[#2C2C2C]">
            Location
          </h2>
          <div className="h-64 w-full max-w-full overflow-hidden sm:h-80">
            <APIProvider apiKey={mapKey}>
              <Map defaultCenter={{ lat: lat!, lng: lng! }} defaultZoom={15} gestureHandling="cooperative">
                <Marker position={{ lat: lat!, lng: lng! }} />
              </Map>
            </APIProvider>
          </div>
          <p className="bg-white px-5 py-3 text-sm font-medium text-[#484848]">{listing.address}</p>
        </section>
      ) : (
        <section className="mt-10 rounded-2xl border border-[#DDDDDD] bg-white p-5">
          <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Location</h2>
          <p className="mt-2 text-sm font-medium text-[#484848]">{listing.address}</p>
        </section>
      )}

      <DormspaceContactModal
        open={contactOpen}
        onOpenChange={(open) => {
          setContactOpen(open);
          if (!open) setNotifyWhenAvailable(false);
        }}
        dormspaceId={listing.id}
        dormspaceTitle={listing.title}
        defaultMessage={
          notifyWhenAvailable
            ? `Hi, this dormspace is currently full. Please notify me when a bed becomes available.`
            : undefined
        }
      />
    </div>
  );
}
