"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Pin } from "lucide-react";
import { ListingCardPhoto } from "@/components/marketplace/listing-card-photo";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { usePinnedPropertyIds, usePropertyLikes } from "@/hooks/use-property-engagement";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import {
  availabilityCardOverlayLabel,
  propertyEngagementLooksUnavailable,
} from "@/lib/property-availability";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type PropertyCard = {
  id: string;
  location: string;
  price: string;
  status: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string;
  deleted_at?: string | null;
  availability_state?: string | null;
  is_demo?: boolean | null;
};

type EngagementSource = "liked" | "saved" | "both";

type SavedListingEntry = {
  property: PropertyCard;
  source: EngagementSource;
  sortAt: string;
};

function maxTimestamp(a?: string, b?: string): string {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  if (ta >= tb) return a ?? b ?? "";
  return b ?? a ?? "";
}

function sourceChipLabel(source: EngagementSource): string {
  if (source === "both") return "Liked + Saved";
  if (source === "liked") return "Liked";
  return "Saved";
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const likes = usePropertyLikes();
  const pins = usePinnedPropertyIds();

  const [entries, setEntries] = useState<SavedListingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshEngagementList = useCallback(async () => {
    if (!user?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [likesRes, savesRes] = await Promise.all([
      supabase
        .from("property_likes")
        .select("property_id, created_at")
        .eq("user_id", user.id),
      supabase
        .from("saved_properties")
        .select("property_id, created_at")
        .eq("user_id", user.id),
    ]);

    if (likesRes.error || savesRes.error) {
      setError(likesRes.error?.message ?? savesRes.error?.message ?? "Could not load saved listings");
      setEntries([]);
      setLoading(false);
      return;
    }

    const byProperty = new Map<string, { likedAt?: string; savedAt?: string }>();
    for (const row of likesRes.data ?? []) {
      const id = String(row.property_id);
      byProperty.set(id, { ...byProperty.get(id), likedAt: String(row.created_at) });
    }
    for (const row of savesRes.data ?? []) {
      const id = String(row.property_id);
      const prev = byProperty.get(id) ?? {};
      byProperty.set(id, { ...prev, savedAt: String(row.created_at) });
    }

    if (byProperty.size === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const merged = [...byProperty.entries()]
      .map(([propertyId, times]) => {
        const liked = Boolean(times.likedAt);
        const saved = Boolean(times.savedAt);
        const source: EngagementSource = liked && saved ? "both" : liked ? "liked" : "saved";
        return {
          propertyId,
          source,
          sortAt: maxTimestamp(times.likedAt, times.savedAt),
        };
      })
      .sort((a, b) => b.sortAt.localeCompare(a.sortAt));

    const propertyIds = merged.map((m) => m.propertyId);
    const { data, error: fetchErr } = await supabase
      .from("properties")
      .select("id, location, price, status, beds, baths, sqft, image_url, deleted_at, availability_state, is_demo")
      .in("id", propertyIds);

    if (fetchErr) {
      setError(fetchErr.message);
      setEntries([]);
      setLoading(false);
      return;
    }

    const list = ((data ?? []) as unknown as PropertyCard[]).filter((p) => !p.is_demo);
    const byId = new Map(list.map((p) => [p.id, p]));
    setEntries(
      merged
        .map((m) => {
          const property = byId.get(m.propertyId);
          if (!property) return null;
          return { property, source: m.source, sortAt: m.sortAt };
        })
        .filter(Boolean) as SavedListingEntry[],
    );
    setLoading(false);
  }, [user?.id]);

  const engagementKey = useMemo(
    () => `${likes.dbIds.join(",")}|${pins.ids.join(",")}`,
    [likes.dbIds, pins.ids],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshEngagementList();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, engagementKey, refreshEngagementList]);

  const content = useMemo(() => {
    if (!user?.id) {
      return (
        <div className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-10 text-center">
          <p className="font-serif text-xl font-bold text-[#2C2C2C]">Sign in to see saved homes</p>
          <p className="mt-1 text-sm text-[#2C2C2C]/55">Likes and bookmarks sync when you are signed in.</p>
          <Link
            href="/auth/login?next=/saved"
            className="mt-5 inline-flex rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
          >
            Sign in
          </Link>
        </div>
      );
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
        {entries.map(({ property: p, source }) => {
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

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Saved</h1>
          <div className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70">
            {user?.id ? `${entries.length} saved` : "—"}
          </div>
        </div>

        {authLoading && <div className="h-40 animate-pulse rounded-2xl bg-black/5" />}
        {!authLoading && loading && <div className="h-40 animate-pulse rounded-2xl bg-black/5" />}
        {!authLoading && !loading && error && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load saved homes</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        )}
        {!authLoading && !loading && !error && content}
      </main>
    </div>
  );
}
