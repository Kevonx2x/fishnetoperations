"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  GraduationCap,
  Hospital,
  Palmtree,
  Store,
  Train,
} from "lucide-react";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { NewlyListedCard } from "@/components/marketplace/fishnet-home-marketplace";
import { PropertyZoomModal } from "@/components/marketplace/property-zoom-modal";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { useAuth } from "@/contexts/auth-context";
import { usePropertyEngagementForProperties } from "@/hooks/use-property-engagement";
import { useAgentLiveAvailabilityFromPropertyRows } from "@/hooks/use-agent-live-availability";

const HERO_IMG =
  "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=2400&h=1200&fit=crop";

const NO_EXTRA_AGENT_IDS: readonly string[] = [];

type LandmarkType = "schools" | "hospitals" | "malls" | "parks" | "business" | "transport";

const CATEGORIES: {
  type: LandmarkType;
  name: string;
  icon: React.ReactNode;
  blurb: string;
}[] = [
  { type: "schools", name: "Schools", icon: <GraduationCap className="h-6 w-6" />, blurb: "Family-friendly areas near top schools" },
  { type: "hospitals", name: "Hospitals", icon: <Hospital className="h-6 w-6" />, blurb: "Quick access to care when it matters" },
  { type: "malls", name: "Malls", icon: <Store className="h-6 w-6" />, blurb: "Retail and dining within reach" },
  { type: "parks", name: "Parks", icon: <Palmtree className="h-6 w-6" />, blurb: "Greenery and recreation nearby" },
  { type: "business", name: "Business Districts", icon: <Building2 className="h-6 w-6" />, blurb: "BGC, Makati, Ortigas, and more" },
  { type: "transport", name: "Transport", icon: <Train className="h-6 w-6" />, blurb: "MRT, major roads, and hubs" },
];

function matchesLandmark(p: DbProperty, t: LandmarkType): boolean {
  const l = p.location.toLowerCase();
  switch (t) {
    case "schools":
      return l.includes("forbes") || l.includes("quezon") || l.includes("san juan") || l.includes("makati");
    case "hospitals":
      return l.includes("bgc") || l.includes("makati") || l.includes("ortigas") || l.includes("pasig");
    case "malls":
      return l.includes("bgc") || l.includes("ortigas") || l.includes("makati") || l.includes("alabang");
    case "parks":
      return l.includes("tagaytay") || l.includes("forbes") || l.includes("quezon");
    case "business":
      return l.includes("bgc") || l.includes("makati") || l.includes("ortigas");
    case "transport":
      return l.includes("pasig") || l.includes("quezon") || l.includes("mandaluyong") || l.includes("san juan");
    default:
      return false;
  }
}

function LandmarksContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as LandmarkType | null;
  const activeType =
    typeParam && CATEGORIES.some((c) => c.type === typeParam) ? typeParam : null;

  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardRoomIdx, setCardRoomIdx] = useState<Record<string, number>>({});
  const [zoomProperty, setZoomProperty] = useState<DbProperty | null>(null);

  const { engagement } = usePropertyEngagementForProperties(properties);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from("properties")
      .select(
        `
          id, created_at, name, location, price, sqft, beds, baths, image_url, status, listed_by, description, property_type,
          is_presale, developer_name, turnover_date, unit_types, deleted_at, availability_state,
          property_photos (url, sort_order),
          property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at, brokers (id, company_name, logo_url), profiles(email, phone)))
        `,
      )
      .or(publicListingExpiryOrFilter())
      .is("deleted_at", null)
      .eq("availability_state", "available")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setError(fetchErr.message);
      setProperties([]);
    } else {
      setProperties((data ?? []) as unknown as DbProperty[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadProperties();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadProperties]);

  const mergeLiveAvailability = useAgentLiveAvailabilityFromPropertyRows(properties, NO_EXTRA_AGENT_IDS);

  const connectedAgentsByPropertyId = useMemo(() => {
    const m = new Map<string, MarketplaceAgent[]>();
    for (const p of properties) {
      const nested = (p.property_agents ?? [])
        .map((x) => (x as { agent?: unknown }).agent)
        .filter(Boolean)
        .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]))
        .map(mergeLiveAvailability);
      const dedup = new Map(nested.map((a) => [a.id, a]));
      m.set(p.id, [...dedup.values()]);
    }
    return m;
  }, [properties, mergeLiveAvailability]);

  const filtered = useMemo(() => {
    if (!activeType) return [];
    return properties.filter((p) => matchesLandmark(p, activeType));
  }, [properties, activeType]);

  const activeLabel = CATEGORIES.find((c) => c.type === activeType)?.name ?? "";

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-16">
      <MaddenTopNav />

      <section className="relative h-[320px] w-full overflow-hidden sm:h-[380px]">
        <Image src={HERO_IMG} alt="Philippines landscape" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F4] via-black/35 to-black/20" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="font-serif text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-4xl md:text-5xl"
          >
            Explore by Landmark
          </motion.h1>
          <p className="mt-3 max-w-xl text-sm font-semibold text-white/95 sm:text-base">
            Discover verified listings near schools, hospitals, malls, and more across Metro Manila and beyond.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pt-10">
        <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Categories</h2>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Choose a landmark type to see nearby properties</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c, i) => (
            <motion.div
              key={c.type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link
                href={`/landmarks?type=${c.type}`}
                className={`flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-[#FAF8F4]/80 ${
                  activeType === c.type ? "border-[#D4A843]/50 ring-2 ring-[#D4A843]/25" : "border-[#2C2C2C]/10"
                }`}
              >
                <div className="flex items-center gap-3 text-[#6B9E6E]">
                  {c.icon}
                  <span className="font-serif text-lg font-bold text-[#2C2C2C]">{c.name}</span>
                </div>
                <p className="mt-2 flex-1 text-sm font-semibold text-[#2C2C2C]/55">{c.blurb}</p>
                <span className="mt-4 text-sm font-bold text-[#D4A843]">View Properties Nearby →</span>
              </Link>
            </motion.div>
          ))}
        </div>

        {activeType ? (
          <section className="mt-14">
            <div className="flex flex-col gap-2 border-b border-[#2C2C2C]/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#2C2C2C]">Near {activeLabel}</h3>
                <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                  {filtered.length} {filtered.length === 1 ? "listing" : "listings"} in this category
                </p>
              </div>
              <Link
                href="/landmarks"
                className="text-sm font-semibold text-[#6B9E6E] hover:text-[#5f7a62]"
              >
                ← All categories
              </Link>
            </div>

            {loading ? <div className="mt-8 h-40 rounded-2xl animate-pulse bg-black/5" /> : null}
            {!loading && error ? (
              <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
                <p className="font-semibold text-[#2C2C2C]">Couldn’t load listings</p>
                <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
              </div>
            ) : null}

            {!loading && !error && filtered.length === 0 ? (
              <p className="mt-8 text-center text-sm font-semibold text-[#2C2C2C]/55">
                No properties match this landmark filter yet. Try another category.
              </p>
            ) : null}

            {!loading && !error && filtered.length > 0 ? (
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <NewlyListedCard
                    key={p.id}
                    property={p}
                    roomUrls={roomUrlsFor(p)}
                    roomIdx={cardRoomIdx[p.id] ?? 0}
                    onRoomPrev={() =>
                      setCardRoomIdx((s) => ({
                        ...s,
                        [p.id]:
                          (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                          Math.max(1, roomUrlsFor(p).length),
                      }))
                    }
                    onRoomNext={() =>
                      setCardRoomIdx((s) => ({
                        ...s,
                        [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                      }))
                    }
                    engagement={engagement}
                    connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                    onOpenPropertyZoom={() => setZoomProperty(p)}
                    grid
                    viewerUserId={user?.id ?? null}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <AnimatePresence>
        {zoomProperty ? (
          <PropertyZoomModal
            property={zoomProperty}
            agents={connectedAgentsByPropertyId.get(zoomProperty.id) ?? []}
            onClose={() => setZoomProperty(null)}
            engagement={engagement}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function LandmarksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F4]">
          <MaddenTopNav />
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="h-48 animate-pulse rounded-2xl bg-black/5" />
          </div>
        </div>
      }
    >
      <LandmarksContent />
    </Suspense>
  );
}
