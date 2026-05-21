"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin } from "lucide-react";

import { DormspaceLikeButton } from "@/components/dormspaces/dormspace-like-button";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { useAuth } from "@/contexts/auth-context";
import { useDormspaceLikes } from "@/hooks/use-dormspace-likes";
import { canLikeDormspaces } from "@/lib/dormspace-engagement";
import {
  dormspaceLocationLine,
  dormspacePrimaryPhotoUrl,
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function DormspaceLikedPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { profile, loading: authLoading } = useAuth();
  const { dbIds, mayLike } = useDormspaceLikes();
  const [rows, setRows] = useState<DormspaceWithPhotos[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = useMemo(() => [...dbIds].sort().join(","), [dbIds]);

  useEffect(() => {
    if (!mayLike || !dbIds.length) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("dormspaces")
        .select("*, dormspace_photos(id, url, display_order, created_at)")
        .in("id", dbIds)
        .eq("status", "approved");
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setRows([]);
      } else {
        const list = (data ?? []) as DormspaceWithPhotos[];
        const byId = new Map(list.map((l) => [l.id, l]));
        setRows(dbIds.map((id) => byId.get(id)).filter(Boolean) as DormspaceWithPhotos[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, mayLike, supabase, dbIds]);

  if (!authLoading && !canLikeDormspaces(profile?.role)) {
    return (
      <DormspacePortalShell variant="browse">
        <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Liked dormspaces</h1>
          <p className="mt-3 max-w-lg text-sm font-medium text-[#484848]">
            Landlord accounts manage listings from the dashboard — saving favorites is for students and tenants
            browsing for a dorm.
          </p>
          <Link
            href="/dormspaces/dashboard"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white"
          >
            Go to My Listings
          </Link>
        </main>
      </DormspacePortalShell>
    );
  }

  return (
    <DormspacePortalShell variant="browse">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Liked dormspaces</h1>
        <p className="mt-2 text-sm font-medium text-[#484848]">
          {dbIds.length > 0 ? `${dbIds.length} saved` : "Tap the heart on any listing to save it here."}
        </p>

        {error ? (
          <p className="mt-8 text-sm font-semibold text-red-600">{error}</p>
        ) : loading ? (
          <p className="mt-8 text-sm font-medium text-[#484848]">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/25">
              <Heart className="h-8 w-8 text-[#6B9E6E]" aria-hidden />
            </div>
            <p className="mt-4 font-serif text-xl font-semibold text-[#2C2C2C]">No likes yet</p>
            <p className="mt-2 text-sm font-medium text-[#484848]">
              Browse dormspaces and tap the heart to build your shortlist.
            </p>
            <Link
              href="/dormspaces"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white"
            >
              Browse dormspaces
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((listing) => {
              const img = dormspacePrimaryPhotoUrl(listing.dormspace_photos ?? null);
              const href = `/dormspaces/${listing.id}`;
              return (
                <div
                  key={listing.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md"
                >
                  <Link href={href} className="relative block h-40 bg-[#F3F0EA]">
                    {img ? (
                      <Image src={img} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" aria-hidden />
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-sm">
                      {dormspaceRoomTypeLabel(listing.room_type)}
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-lg font-bold text-[#D4A843]">{formatDormspacePrice(listing.monthly_price)}</p>
                    <h2 className="mt-1 line-clamp-2 font-serif text-base font-semibold text-[#2C2C2C]">
                      {listing.title}
                    </h2>
                    <p className="mt-1 flex items-start gap-1 text-xs text-[#6B6B6B]">
                      <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
                      <span className="line-clamp-1">{dormspaceLocationLine(listing)}</span>
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-4">
                      <Link
                        href={href}
                        className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-[#2C2C2C]/12 text-xs font-bold text-[#2C2C2C] hover:bg-[#FAF8F4]"
                      >
                        View details
                      </Link>
                      <DormspaceLikeButton dormspaceId={listing.id} signInNext="/dormspaces/liked" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </DormspacePortalShell>
  );
}
