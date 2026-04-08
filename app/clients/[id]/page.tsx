"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Home, Lock, Pencil } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  readAllLocalSavedPropertyIds,
  removeSavedPropertyIdLocal,
} from "@/lib/saved-properties";
import type { ProfileRole } from "@/lib/auth-roles";

type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string;
  status: string;
  listing_status: string | null;
};

type WishFilter = "all" | "sale" | "rent" | "sold";

const FILTERS: { id: WishFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sale", label: "For Sale" },
  { id: "rent", label: "For Rent" },
  { id: "sold", label: "Sold/Rented" },
];

const UUID_RE =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function isSoldOrOffMarket(p: PropertyRow): boolean {
  const ls = (p.listing_status ?? "").toLowerCase();
  return ls === "sold" || ls === "off_market";
}

function passesWishFilter(p: PropertyRow, f: WishFilter): boolean {
  if (f === "all") return true;
  if (f === "sale") return p.status === "for_sale" && !isSoldOrOffMarket(p);
  if (f === "rent") return p.status === "for_rent" && !isSoldOrOffMarket(p);
  if (f === "sold") return isSoldOrOffMarket(p);
  return true;
}

function overlayLabel(p: PropertyRow): "SOLD" | "OFF MARKET" | null {
  const ls = (p.listing_status ?? "").toLowerCase();
  if (ls === "sold") return "SOLD";
  if (ls === "off_market") return "OFF MARKET";
  return null;
}

export default function ClientPublicProfilePage() {
  const params = useParams();
  const rawId = typeof params.id === "string" ? params.id : "";
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [profileLoading, setProfileLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [clientProfile, setClientProfile] = useState<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    role: ProfileRole;
  } | null>(null);
  const [viewerAgent, setViewerAgent] = useState<{
    listing_tier: string;
    verified: boolean;
    status: string;
  } | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [savedTotal, setSavedTotal] = useState(0);
  const [filter, setFilter] = useState<WishFilter>("all");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const clientId = rawId;
  const isOwn = Boolean(user?.id && user.id === clientId);
  const isAdmin = profile?.role === "admin";

  const canSeeWishlist = useMemo(() => {
    if (isOwn || isAdmin) return true;
    if (!viewerAgent?.verified || viewerAgent.status !== "approved") return false;
    const t = viewerAgent.listing_tier;
    return t === "pro" || t === "featured" || t === "broker";
  }, [isOwn, isAdmin, viewerAgent]);

  useEffect(() => {
    if (!UUID_RE.test(clientId)) {
      setClientProfile(null);
      setProfileLoading(false);
      setWishlistLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setProfileLoading(true);
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, created_at, role")
        .eq("id", clientId)
        .maybeSingle();

      if (cancelled) return;

      if (pe || !p || (p as { role: string }).role !== "client") {
        setClientProfile(null);
        setProfileLoading(false);
        setWishlistLoading(false);
        return;
      }

      const row = p as {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        created_at: string;
        role: string;
      };

      setClientProfile({
        id: row.id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        created_at: row.created_at,
        role: row.role as ProfileRole,
      });
      setProfileLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, supabase]);

  useEffect(() => {
    if (!UUID_RE.test(clientId) || !clientProfile || authLoading) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setWishlistLoading(true);
      try {
        const uid = user?.id;
        let ag: {
          listing_tier: string;
          verified: boolean;
          status: string;
        } | null = null;

        if (uid && uid !== clientId) {
          const { data: agRow } = await supabase
            .from("agents")
            .select("listing_tier, verified, status")
            .eq("user_id", uid)
            .maybeSingle();
          if (agRow) {
            ag = {
              listing_tier: String((agRow as { listing_tier: string }).listing_tier),
              verified: Boolean((agRow as { verified?: boolean }).verified),
              status: String((agRow as { status?: string }).status ?? ""),
            };
          }
        }
        if (cancelled) return;
        setViewerAgent(ag);

        const own = uid === clientId;
        const admin = profile?.role === "admin";
        const tierOk =
          ag &&
          ag.verified &&
          ag.status === "approved" &&
          ["pro", "featured", "broker"].includes(ag.listing_tier);

        const allowWishlist = own || admin || tierOk;

        if (!allowWishlist) {
          setProperties([]);
          setSaveCounts({});
          setSavedTotal(0);
          return;
        }

        let ids: string[] = [];
        if (own || admin) {
          const { data: saves } = await supabase
            .from("saved_properties")
            .select("property_id")
            .eq("user_id", clientId);
          const dbIds = (saves ?? []).map((r) => (r as { property_id: string }).property_id);
          const localIds = readAllLocalSavedPropertyIds();
          ids = [...new Set([...dbIds, ...localIds])];
        } else {
          const { data: saves } = await supabase
            .from("saved_properties")
            .select("property_id")
            .eq("user_id", clientId);
          ids = (saves ?? []).map((r) => (r as { property_id: string }).property_id);
        }

        if (cancelled) return;
        setSavedTotal(ids.length);

        if (ids.length === 0) {
          setProperties([]);
          setSaveCounts({});
          return;
        }

        const { data: props, error: propsErr } = await supabase
          .from("properties")
          .select(
            "id, name, location, price, beds, baths, sqft, image_url, status, listing_status",
          )
          .in("id", ids);

        if (cancelled) return;

        if (propsErr) {
          console.error(propsErr);
          setProperties([]);
          setSaveCounts({});
          return;
        }

        const list = (props ?? []) as PropertyRow[];
        setProperties(list);

        const { data: counts } = await supabase.rpc("property_save_counts_for", {
          property_ids: ids,
        });
        if (cancelled) return;

        const map: Record<string, number> = {};
        for (const c of counts ?? []) {
          const r = c as { property_id: string; save_count: number };
          map[r.property_id] = Number(r.save_count);
        }
        setSaveCounts(map);
      } finally {
        if (!cancelled) setWishlistLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, clientProfile, supabase, user?.id, profile?.role, authLoading]);

  const filtered = useMemo(
    () => properties.filter((p) => passesWishFilter(p, filter)),
    [properties, filter],
  );

  const removeFromWishlist = useCallback(
    async (propertyId: string) => {
      if (!user?.id || user.id !== clientId) return;
      setRemovingId(propertyId);
      try {
        await supabase
          .from("saved_properties")
          .delete()
          .eq("user_id", user.id)
          .eq("property_id", propertyId);
        removeSavedPropertyIdLocal(propertyId);
        setProperties((prev) => prev.filter((p) => p.id !== propertyId));
        setSavedTotal((c) => Math.max(0, c - 1));
      } finally {
        setRemovingId(null);
      }
    },
    [clientId, supabase, user?.id],
  );

  const pageLoading = profileLoading || authLoading || wishlistLoading;

  if (!profileLoading && !clientProfile) {
    notFound();
  }

  const displayName = clientProfile?.full_name?.trim() || "Member";
  const memberSince = clientProfile?.created_at
    ? new Date(clientProfile.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="min-h-screen bg-white">
      <MaddenTopNav />
      {pageLoading || !clientProfile ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
          Loading…
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
            <aside className="lg:sticky lg:top-24 lg:w-[30%] lg:shrink-0 lg:self-start">
              <div className="flex flex-col items-center rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center shadow-sm">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-[#2C2C2C]/10 bg-[#FAF8F4]">
                  {clientProfile.avatar_url?.trim() ? (
                    <Image
                      src={clientProfile.avatar_url}
                      alt=""
                      width={112}
                      height={112}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-2xl font-bold text-white">
                      {agentAvatarInitials(displayName)}
                    </span>
                  )}
                </div>
                <h1 className="mt-4 font-serif text-2xl font-semibold text-[#2C2C2C]">
                  {displayName}
                </h1>
                <p className="mt-1 text-sm text-[#2C2C2C]/55">Member since {memberSince}</p>
                <p className="mt-4 text-sm font-semibold text-[#2C2C2C]">
                  <span className="text-[#6B9E6E]">{savedTotal}</span> properties saved
                </p>
                <p className="mt-1 text-xs text-[#2C2C2C]/45">0 properties viewed · coming soon</p>
                {isOwn ? (
                  <Link
                    href="/settings?tab=profile"
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#6B9E6E] bg-[#6B9E6E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60]"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit profile
                  </Link>
                ) : null}
              </div>
            </aside>

            <main className="min-w-0 flex-1 lg:w-[70%]">
              <h2 className="font-serif text-3xl font-semibold text-[#2C2C2C]">
                My Home Wishlist
              </h2>

              {!isOwn && !canSeeWishlist ? (
                <div className="mt-8 rounded-2xl border border-[#D4A843]/40 bg-gradient-to-br from-[#FAF8F4] to-white p-8 text-center shadow-sm">
                  <Lock className="mx-auto h-10 w-10 text-[#D4A843]" aria-hidden />
                  <p className="mt-4 text-base font-semibold text-[#2C2C2C]">
                    Upgrade to Pro to see client property interests
                  </p>
                  <p className="mt-2 text-sm text-[#2C2C2C]/60">
                    Verified Pro or Featured agents can view wishlists to understand what buyers
                    love.
                  </p>
                  <Link
                    href="/dashboard/agent"
                    className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5d8a60]"
                  >
                    Open agent dashboard
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-6 flex flex-wrap gap-2 border-b border-[#2C2C2C]/10 pb-px">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                          filter === f.id
                            ? "border-b-2 border-[#6B9E6E] text-[#6B9E6E]"
                            : "text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {filtered.length === 0 ? (
                    <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-[#FAF8F4]/50 py-16 text-center">
                      <Home className="h-14 w-14 text-[#6B9E6E]/50" strokeWidth={1.25} />
                      <p className="mt-4 font-medium text-[#2C2C2C]/70">
                        No saved properties yet. Start browsing!
                      </p>
                      <Link
                        href="/"
                        className="mt-4 text-sm font-semibold text-[#6B9E6E] underline underline-offset-2"
                      >
                        Browse listings
                      </Link>
                    </div>
                  ) : (
                    <ul className="mt-8 space-y-8">
                      {filtered.map((p) => {
                        const overlay = overlayLabel(p);
                        const hearts = saveCounts[p.id] ?? 0;
                        return (
                          <li
                            key={p.id}
                            className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md"
                          >
                            <div className="relative aspect-[16/10] w-full bg-[#2C2C2C]/5">
                              <Image
                                src={p.image_url}
                                alt=""
                                fill
                                className={`object-cover ${overlay ? "brightness-[0.65]" : ""}`}
                                sizes="(max-width: 1024px) 100vw, 70vw"
                              />
                              {overlay ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                                  <span className="rounded-lg border-2 border-white/90 bg-black/40 px-6 py-2 font-serif text-xl font-bold tracking-widest text-white">
                                    {overlay}
                                  </span>
                                </div>
                              ) : null}
                              <span
                                className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${
                                  p.status === "for_rent"
                                    ? "bg-[#D4A843] text-[#2C2C2C]"
                                    : "bg-[#6B9E6E] text-white"
                                }`}
                              >
                                {p.status === "for_rent" ? "For Rent" : "For Sale"}
                              </span>
                            </div>
                            <div className="p-4 sm:p-5">
                              <h3 className="font-serif text-xl font-semibold text-[#2C2C2C]">
                                {p.name?.trim() || "Listing"}
                              </h3>
                              <p className="mt-1 text-sm text-[#2C2C2C]/60">{p.location}</p>
                              <p className="mt-2 font-serif text-lg font-semibold text-[#D4A843]">
                                {p.price}
                              </p>
                              <p className="mt-2 text-sm text-[#2C2C2C]/70">
                                {p.beds} bed · {p.baths} bath · {p.sqft} sqft
                              </p>
                              <div className="mt-4 flex flex-wrap items-center gap-4">
                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#2C2C2C]/70">
                                  <Heart className="h-4 w-4 text-[#6B9E6E]" aria-hidden />
                                  {hearts}
                                </span>
                                <Link
                                  href={`/properties/${p.id}`}
                                  className="inline-flex rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5d8a60]"
                                >
                                  View property
                                </Link>
                                {isOwn ? (
                                  <button
                                    type="button"
                                    disabled={removingId === p.id}
                                    onClick={() => void removeFromWishlist(p.id)}
                                    className="text-sm font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 disabled:opacity-50"
                                  >
                                    {removingId === p.id ? "Removing…" : "Remove from wishlist"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
