"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { usePropertyLikes } from "@/hooks/use-property-engagement";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import {
  availabilityCardOverlayLabel,
  propertyEngagementLooksUnavailable,
} from "@/lib/property-availability";
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
};

export default function LikesPage() {
  const likes = usePropertyLikes();
  const orderedIds = useMemo(() => likes.dbIds, [likes.dbIds]);
  const idsKey = useMemo(() => orderedIds.join(","), [orderedIds]);

  const [rows, setRows] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!orderedIds.length) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("properties")
        .select("id, location, price, status, beds, baths, sqft, image_url, deleted_at, availability_state")
        .in("id", orderedIds);
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setRows([]);
      } else {
        const list = (data ?? []) as unknown as PropertyCard[];
        const byId = new Map(list.map((p) => [p.id, p]));
        setRows(orderedIds.map((id) => byId.get(id)).filter(Boolean) as PropertyCard[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const content = useMemo(() => {
    if (!orderedIds.length) {
      return (
        <div className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/25">
            <Heart className="h-8 w-8 text-[#6B9E6E]" aria-hidden />
          </div>
          <p className="mt-4 font-serif text-xl font-bold text-[#2C2C2C]">No likes yet</p>
          <p className="mt-1 text-sm text-[#2C2C2C]/55">
            Tap the heart on a listing to add it here. Sign in to sync likes across devices.
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
        {rows.map((p) => {
          const removed = propertyEngagementLooksUnavailable(p);
          const overlayLabel = availabilityCardOverlayLabel(p.availability_state, p.deleted_at);
          return (
          <div
            key={p.id}
            className={cn(
              "overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm",
              removed && "opacity-50",
            )}
          >
            <div className="relative aspect-[4/3] w-full bg-black/5">
              <Image
                src={p.image_url}
                alt={p.location}
                fill
                sizes="420px"
                className={cn("object-cover", removed && "grayscale")}
              />
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
              <button
                type="button"
                disabled={removed}
                onClick={() => {
                  if (!removed) void likes.toggle(p.id);
                }}
                className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-sm disabled:pointer-events-none disabled:opacity-40"
                aria-label="Unlike"
              >
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3">
                <p className="font-serif text-xl font-bold text-white">
                  {formatPropertyPriceDisplay(
                    p.price,
                    p.status as "for_sale" | "for_rent" | "sold" | "rented",
                  )}
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className={cn("font-semibold", removed ? "text-gray-400" : "text-[#2C2C2C]")}>{p.location}</p>
              <p className={cn("mt-1 text-sm font-semibold", removed ? "text-gray-400" : "text-[#2C2C2C]/60")}>
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
  }, [rows, orderedIds.length, likes.toggle]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pt-4 pb-12">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">
              Likes
            </p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
              My likes
            </h1>
          </div>
          <div className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70">
            {orderedIds.length} liked
          </div>
        </div>

        {loading && <div className="h-40 rounded-2xl animate-pulse bg-black/5" />}
        {!loading && error && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load liked homes</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        )}
        {!loading && !error && content}
      </main>
    </div>
  );
}
