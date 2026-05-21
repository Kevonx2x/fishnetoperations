"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AirVent,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Droplets,
  MapPin,
  Shield,
  UtensilsCrossed,
  Wifi,
  WashingMachine,
  Zap,
} from "lucide-react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

import { DormspaceContactModal } from "@/components/dormspaces/dormspace-contact-modal";
import { DormspaceEngagementButtons } from "@/components/dormspaces/dormspace-engagement-buttons";
import { DormspaceLandlordPublicCard } from "@/components/dormspaces/dormspace-landlord-public-card";
import { DormspaceVerificationBadge } from "@/components/dormspaces/dormspace-verification-badge";
import type { LandlordProfileTrust, LandlordPublicProfile } from "@/lib/dormspace-landlord-profile";
import {
  activeDormspaceAmenities,
  dormspaceGenderLabel,
  dormspaceLocationLine,
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  sortedDormspacePhotos,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

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
}: {
  listing: DormspaceWithPhotos;
  landlord?: LandlordPublicProfile | null;
  landlordTrust?: LandlordProfileTrust | null;
}) {
  const photos = sortedDormspacePhotos(listing.dormspace_photos ?? null);
  const urls = photos.map((p) => p.url).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);

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
    <div className="pb-16">
      <Link href="/dormspaces" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#6B9E6E] hover:underline">
        ← All dormspaces
      </Link>

      <div className="overflow-hidden rounded-2xl border border-[#DDDDDD] bg-white shadow-md">
        <div className="relative aspect-[16/10] w-full bg-[#F3F0EA] sm:aspect-[21/9]">
          {urls.length > 0 ? (
            <Image src={urls[idx]!} alt="" fill className="object-cover" sizes="100vw" priority />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" />
          )}
          {urls.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
                className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setIdx((i) => (i + 1) % urls.length)}
                className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"
                aria-label="Next photo"
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={`h-1.5 rounded-full transition ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {urls.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-t border-[#2C2C2C]/8 bg-white px-3 py-3 scrollbar-hide">
            {urls.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setIdx(i)}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  i === idx ? "border-[#6B9E6E] ring-2 ring-[#6B9E6E]/25" : "border-transparent opacity-80 hover:opacity-100"
                }`}
                aria-label={`View photo ${i + 1}`}
                aria-current={i === idx ? "true" : undefined}
              >
                <Image src={url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-8 p-5 md:grid-cols-[1fr_280px] md:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#6B9E6E]/12 px-2.5 py-1 text-xs font-bold text-[#3d5a40]">
                {dormspaceRoomTypeLabel(listing.room_type)}
              </span>
              <span className="rounded-full bg-[#FAF8F4] px-2.5 py-1 text-xs font-bold text-[#484848] ring-1 ring-[#2C2C2C]/10">
                {dormspaceGenderLabel(listing.gender_preference)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-start gap-3 gap-y-2">
              <h1 className="min-w-0 flex-1 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
                {listing.title}
              </h1>
              <DormspaceEngagementButtons
                dormspaceId={listing.id}
                landlordUserId={listing.landlord_user_id}
                signInNext={`/dormspaces/${listing.id}`}
                size="md"
                className="rounded-full"
              />
              <DormspaceVerificationBadge status={listing.status} />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[#484848]">
              <MapPin className="size-4 shrink-0 text-[#6B9E6E]" aria-hidden />
              {dormspaceLocationLine(listing)}
            </p>
            {listing.near_school?.trim() ? (
              <p className="mt-2 text-sm font-medium text-[#525252]">Near: {listing.near_school.trim()}</p>
            ) : null}
            <p className="mt-4 text-2xl font-bold text-[#D4A843]">{formatDormspacePrice(listing.monthly_price)}</p>
            {deposit ? <p className="text-sm font-medium text-[#484848]">{deposit}</p> : null}

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
              trust={
                landlordTrust ?? {
                  verified_landlord: listing.status === "approved",
                  free_listings: true,
                  member_since: landlord.created_at,
                }
              }
              onContact={() => setContactOpen(true)}
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
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="mt-5 w-full rounded-xl bg-[#6B9E6E] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
              >
                Contact landlord
              </button>
            </aside>
          )}
        </div>
      </div>

      {hasMap && mapKey ? (
        <section className="mt-10 overflow-hidden rounded-2xl border border-[#DDDDDD]">
          <h2 className="border-b border-[#2C2C2C]/8 bg-white px-5 py-3 font-serif text-lg font-bold text-[#2C2C2C]">
            Location
          </h2>
          <div className="h-64 w-full sm:h-80">
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
        onOpenChange={setContactOpen}
        dormspaceId={listing.id}
        dormspaceTitle={listing.title}
      />
    </div>
  );
}
