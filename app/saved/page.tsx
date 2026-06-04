"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Heart, Pin } from "lucide-react";
import { ListingCardPhoto } from "@/components/marketplace/listing-card-photo";
import {
  DesktopLoggedOutTabEmpty,
  MobileLoggedOutSavedTeaser,
} from "@/components/marketplace/mobile-logged-out-tab-teaser";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { usePinnedPropertyIds, usePropertyLikes } from "@/hooks/use-property-engagement";
import { useSavedListings } from "@/hooks/use-saved-listings";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import {
  availabilityCardOverlayLabel,
  propertyEngagementLooksUnavailable,
} from "@/lib/property-availability";
import type { EngagementSource, SavedListingEntry } from "@/lib/saved-listings-fetcher";
import { cn } from "@/lib/utils";

function sourceChipLabel(source: EngagementSource): string {
  if (source === "both") return "Liked + Saved";
  if (source === "liked") return "Liked";
  return "Saved";
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const likes = usePropertyLikes();
  const pins = usePinnedPropertyIds();

  const engagementKey = useMemo(
    () => `${likes.dbIds.join(",")}|${pins.ids.join(",")}`,
    [likes.dbIds, pins.ids],
  );

  const {
    data: entries = [],
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSavedListings(user?.id);

  const showInitialLoading = Boolean(user?.id) && isLoading && entries.length === 0;
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

  const content = useMemo(() => {
    if (!user?.id) {
      return null;
    }

    if (!entries.length) {
      return (
        <div className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-10 text-center">
          <Heart className="mx-auto h-12 w-12 text-[#6B9E6E]" strokeWidth={1.75} aria-hidden />
          <p className="mt-4 font-serif text-xl font-bold text-[#2C2C2C]">Nothing saved yet</p>
          <p className="mt-1 text-sm text-[#2C2C2C]/55">
            Tap the heart on listings you like, or the bookmark to save for later
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
          >
            Browse listings
          </Link>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ property: p, source }: SavedListingEntry) => {
          const removed = propertyEngagementLooksUnavailable(p);
          const overlayLabel = availabilityCardOverlayLabel(p.availability_state, p.deleted_at);
          const isLiked = likes.has(p.id);
          const isPinned = pins.has(p.id);

          return (
            <div
              key={p.id}
              className={cn(
                "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md",
                removed && "pointer-events-none opacity-50",
              )}
            >
              <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-[#F3F0EA] sm:aspect-[4/3]">
                {p.image_url ? (
                  <ListingCardPhoto
                    src={p.image_url}
                    alt={p.location}
                    sizes="420px"
                    eager
                    grayscale={removed}
                  />
                ) : null}
                {!removed ? (
                  <Link
                    href={`/properties/${encodeURIComponent(p.id)}`}
                    className="absolute inset-0 z-[7]"
                    aria-label={`View ${p.location}`}
                  />
                ) : null}
                {removed ? (
                  <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/25 px-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide",
                        p.availability_state === "reserved"
                          ? "bg-[#D4A843]/95 text-[#2C2C2C]"
                          : "bg-gray-900/85 text-gray-100",
                      )}
                    >
                      {overlayLabel}
                    </span>
                  </div>
                ) : null}
                <span className="pointer-events-none absolute left-2 top-2 z-20 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#6B9E6E] shadow-sm ring-1 ring-black/5">
                  {sourceChipLabel(source)}
                </span>
                <div className="pointer-events-auto absolute right-2 top-2 z-20 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={removed}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!removed) void likes.toggle(p.id);
                    }}
                    className="rounded-full border border-gray-200 bg-white/90 p-1.5 shadow-sm disabled:pointer-events-none disabled:opacity-40"
                    aria-label={isLiked ? "Unlike" : "Like"}
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4",
                        isLiked ? "fill-red-500 text-red-500" : "text-[#222]",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    disabled={removed}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!removed) void pins.toggle(p.id);
                    }}
                    className="rounded-full border border-gray-200 bg-white/90 p-1.5 shadow-sm disabled:pointer-events-none disabled:opacity-40"
                    aria-label={isPinned ? "Remove bookmark" : "Bookmark"}
                  >
                    <Pin
                      className={cn(
                        "h-4 w-4",
                        isPinned ? "fill-[#D4A843] text-[#D4A843]" : "text-[#222]",
                      )}
                    />
                  </button>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3">
                  <p className="font-serif text-xl font-bold text-white">
                    {formatPropertyPriceDisplay(
                      p.price,
                      p.status as "for_sale" | "for_rent" | "sold" | "rented",
                    )}
                  </p>
                </div>
              </div>
              <div className="p-4">
                <p className={cn("font-semibold", removed ? "text-gray-400" : "text-[#2C2C2C]")}>
                  {p.location}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm font-semibold",
                    removed ? "text-gray-400" : "text-[#2C2C2C]/60",
                  )}
                >
                  {p.beds} bd · {p.baths} ba · {p.sqft} sqft
                </p>
                {removed ? (
                  <p className="mt-3 text-sm font-semibold text-gray-400">{overlayLabel}</p>
                ) : (
                  <Link
                    href={`/properties/${encodeURIComponent(p.id)}`}
                    className="mt-3 inline-flex text-sm font-semibold text-[#2C2C2C]/70 underline decoration-[#D4A843]/60 underline-offset-4 hover:text-[#2C2C2C]"
                  >
                    View details →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [entries, likes, pins, user?.id]);

  useEffect(() => {
    if (user?.id) void mutate();
  }, [engagementKey, mutate, user?.id]);

  if (!authLoading && !user) {
    return (
      <>
        <div className="max-md:min-h-0 max-md:overflow-hidden md:hidden">
          <MobileLoggedOutSavedTeaser />
        </div>
        <div className="hidden md:block">
          <DesktopLoggedOutTabEmpty
            title="Saved"
            copy="Sign in to save and organize your favorite properties."
            nextPath="/saved"
          />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Saved</h1>
          <div className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70">
            {user?.id ? `${entries.length} saved` : "—"}
            {user?.id && isValidating && entries.length > 0 ? " · refreshing" : null}
          </div>
        </div>

        {authLoading && <div className="h-40 animate-pulse rounded-2xl bg-black/5" />}
        {!authLoading && showInitialLoading && (
          <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
        )}
        {!authLoading && !showInitialLoading && errorMessage && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load saved homes</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{errorMessage}</p>
          </div>
        )}
        {!authLoading && !showInitialLoading && !errorMessage && content}
      </main>
    </div>
  );
}
