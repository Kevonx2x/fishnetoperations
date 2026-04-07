"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentLiveAvailabilityFromPropertyRows } from "@/hooks/use-agent-live-availability";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  MapPin,
  Shield,
  BadgeCheck,
  Lock,
  Users,
  Search,
  Star,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { ConnectedAgentsBox } from "@/components/marketplace/connected-agents-box";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty, SortMode } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { useSavedPropertyIds } from "@/lib/saved-properties";
import { useAuth } from "@/contexts/auth-context";
import { PropertyZoomModal } from "@/components/marketplace/property-zoom-modal";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { listingListedLabel } from "@/lib/listing-listed-time";
import { AgentSlotPlaceholder } from "@/components/marketplace/agent-slot-placeholder";
import { AgentDirectoryCard } from "@/components/marketplace/agent-directory-card";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import { cn } from "@/lib/utils";

export type { DbProperty, SortMode } from "@/lib/marketplace-property";
export { roomUrlsFor } from "@/lib/marketplace-property";

const HERO_SLIDES = [
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=2400&h=1300&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=2400&h=1300&fit=crop",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=2400&h=1300&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2400&h=1300&fit=crop",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=2400&h=1300&fit=crop",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=2400&h=1300&fit=crop",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=2400&h=1300&fit=crop",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=2400&h=1300&fit=crop",
];

function hoursAgo(createdAtIso: string): number {
  const t = new Date(createdAtIso).getTime();
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60)));
}

function neighborhoodKey(location: string): string {
  const l = location.toLowerCase();
  const known = [
    "makati cbd",
    "makati",
    "bgc",
    "alabang",
    "forbes park",
    "tagaytay",
    "ortigas",
    "pasig",
    "quezon city",
    "mandaluyong",
    "san juan",
  ];
  const hit = known.find((k) => l.includes(k));
  if (!hit) return location.split(",")[0]?.trim() || location;
  return hit
    .split(" ")
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

function parsePesoToNumber(price: string): number {
  const raw = price.trim();
  const cleaned = raw.replace(/[₱,\s]/g, "");
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([MK])?$/i);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return 0;
    const suffix = (m[2] ?? "").toUpperCase();
    if (suffix === "M") return n * 1_000_000;
    if (suffix === "K") return n * 1_000;
    return n;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatPeso(n: number): string {
  if (!Number.isFinite(n)) return "₱0";
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  return `₱${Math.round(n).toLocaleString()}`;
}

type FiltersState = {
  minPrice: number;
  maxPrice: number;
  beds: "any" | 1 | 2 | 3 | 4;
  baths: "any" | 1 | 2 | 3;
  propertyType: "any" | "House" | "Condo" | "Villa" | "Land" | "Studio";
};

function inferredType(p: DbProperty): FiltersState["propertyType"] {
  const loc = `${p.name ?? ""} ${p.location}`.toLowerCase();
  if (p.beds === 0) return "Studio";
  if (loc.includes("penthouse") || loc.includes("condo") || loc.includes("loft") || loc.includes("studio")) return "Condo";
  if (loc.includes("villa") || loc.includes("estate")) return "Villa";
  if (loc.includes("land")) return "Land";
  return "House";
}

export function BahayGoHomeMarketplace({ listingMode }: { listingMode: "buy" | "rent" }) {
  const { user } = useAuth();
  const saved = useSavedPropertyIds();
  const [viewerVerifiedListingAgent, setViewerVerifiedListingAgent] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setViewerVerifiedListingAgent(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from("agents")
      .select("verified, status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { verified?: boolean | null; status?: string | null } | null;
        setViewerVerifiedListingAgent(Boolean(row?.verified && row?.status === "approved"));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const mode = listingMode;
  const [search, setSearch] = useState("");
  const [heroIdx, setHeroIdx] = useState(0);
  const [listingViewMode, setListingViewMode] = useState<"browse" | "results">("browse");

  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string | null>(null);
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filters, setFilters] = useState<FiltersState>({
    minPrice: 0,
    maxPrice: 350_000_000,
    beds: "any",
    baths: "any",
    propertyType: "any",
  });
  const [cardRoomIdx, setCardRoomIdx] = useState<Record<string, number>>({});
  const [zoomProperty, setZoomProperty] = useState<DbProperty | null>(null);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const topAgentsRef = useRef<HTMLDivElement | null>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from("properties")
      .select(
        `
          id, created_at, name, location, price, sqft, beds, baths, image_url, status, listed_by, description,
          property_photos (url, sort_order),
          property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at, brokers (id, company_name, logo_url), profiles(email, phone)))
        `,
      )
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
      setProperties([]);
    } else {
      setProperties((data ?? []) as unknown as DbProperty[]);
    }
    setLoading(false);
  }, []);

  const loadAgentsDirectory = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("agents")
      .select("*, brokers(*), profiles(email, phone)")
      .eq("status", "approved")
      .eq("verified", true);
    if (!fetchErr) {
      setAgents((data ?? []).map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0])));
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    void loadAgentsDirectory();
  }, [loadAgentsDirectory]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadProperties();
        void loadAgentsDirectory();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadProperties, loadAgentsDirectory]);

  const directoryAgentIds = useMemo(() => agents.map((a) => a.id), [agents]);
  const mergeLiveAvailability = useAgentLiveAvailabilityFromPropertyRows(properties, directoryAgentIds);

  const allConnectedAgentsByPropertyId = useMemo(() => {
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

  const baseModeProperties = useMemo(() => {
    const base = properties.filter((p) => (mode === "buy" ? p.status === "for_sale" : p.status === "for_rent"));
    const q = search.trim().toLowerCase();
    const searched = q
      ? base.filter((p) => `${p.location} ${p.name ?? ""}`.toLowerCase().includes(q))
      : base;
    return neighborhoodFilter ? searched.filter((p) => neighborhoodKey(p.location) === neighborhoodFilter) : searched;
  }, [properties, mode, search, neighborhoodFilter]);

  const filteredAllRows = useMemo(() => {
    return baseModeProperties.filter((p) => {
      const price = parsePesoToNumber(p.price);
      if (price < filters.minPrice || price > filters.maxPrice) return false;
      if (filters.beds !== "any") {
        if (filters.beds === 4) {
          if (p.beds < 4) return false;
        } else if (p.beds !== filters.beds) return false;
      }
      if (filters.baths !== "any") {
        if (filters.baths === 3) {
          if (p.baths < 3) return false;
        } else if (p.baths !== filters.baths) return false;
      }
      if (filters.propertyType !== "any") {
        if (inferredType(p) !== filters.propertyType) return false;
      }
      return true;
    });
  }, [baseModeProperties, filters]);

  const sortedAllRows = useMemo(() => {
    const list = [...filteredAllRows];
    list.sort((a, b) => {
      if (sortMode === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortMode === "most_beds") return (b.beds ?? 0) - (a.beds ?? 0);
      const pa = parsePesoToNumber(a.price);
      const pb = parsePesoToNumber(b.price);
      if (sortMode === "price_low") return pa - pb;
      if (sortMode === "price_high") return pb - pa;
      return 0;
    });
    return list;
  }, [filteredAllRows, sortMode]);

  const propertyTrustScoreById = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of properties) {
      const agents = allConnectedAgentsByPropertyId.get(p.id) ?? [];
      const avg = agents.length ? agents.reduce((s, a) => s + (a.score ?? 0), 0) / agents.length : 0;
      m.set(p.id, avg);
    }
    return m;
  }, [properties, allConnectedAgentsByPropertyId]);

  const featuredPicks = useMemo(() => {
    const list = [...sortedAllRows];
    list.sort((a, b) => (propertyTrustScoreById.get(b.id) ?? 0) - (propertyTrustScoreById.get(a.id) ?? 0));
    return list.slice(0, 12);
  }, [sortedAllRows, propertyTrustScoreById]);

  const newlyListed = useMemo(() => {
    const list = [...sortedAllRows];
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [sortedAllRows]);

  const luxury50m = useMemo(() => sortedAllRows.filter((p) => parsePesoToNumber(p.price) > 50_000_000), [sortedAllRows]);

  const nearSchoolsParks = useMemo(() => {
    const list = sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("forbes") || l.includes("quezon") || l.includes("san juan") || l.includes("makati");
    });
    return list;
  }, [sortedAllRows]);

  const pickMockSubset = (seed: string) => {
    return sortedAllRows.filter((p) => {
      let h = 0;
      const s = `${seed}-${p.id}`;
      for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 101;
      return h % 3 === 0;
    });
  };

  const petFriendly = useMemo(() => pickMockSubset("pet"), [sortedAllRows]);
  const gated = useMemo(() => pickMockSubset("gated"), [sortedAllRows]);
  const openHouse = useMemo(() => pickMockSubset("openhouse"), [sortedAllRows]);
  const deals = useMemo(() => pickMockSubset("deals"), [sortedAllRows]);

  const rentPetFriendly = useMemo(() => pickMockSubset("rent-pet"), [sortedAllRows]);
  const furnished = useMemo(() => pickMockSubset("furnished"), [sortedAllRows]);
  const nearBD = useMemo(() => {
    return sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("bgc") || l.includes("makati") || l.includes("ortigas");
    });
  }, [sortedAllRows]);
  const studiosCondos = useMemo(() => sortedAllRows.filter((p) => p.beds <= 1), [sortedAllRows]);
  const shortTerm = useMemo(() => pickMockSubset("shortterm"), [sortedAllRows]);
  const familyRent = useMemo(() => sortedAllRows.filter((p) => p.beds >= 3), [sortedAllRows]);

  const neighborhoodCounts = useMemo(() => {
    const base = properties.filter((p) => hoursAgo(p.created_at) <= 48);
    const counts = new Map<string, number>();
    for (const p of base) {
      const k = neighborhoodKey(p.location);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [properties]);

  const topAgents = useMemo(
    () =>
      [...agents]
        .map(mergeLiveAvailability)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    [agents, mergeLiveAvailability],
  );
  const featured = useMemo(() => properties[0] ?? null, [properties]);
  const featuredPhotos = useMemo(() => {
    const list = (featured?.property_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    return list.length ? list.map((x) => x.url) : featured?.image_url ? [featured.image_url] : [];
  }, [featured]);

  const scrollRow = (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => {
    const el = ref.current;
    if (!el) return;
    const step = Math.max(300, Math.round(el.clientWidth * 0.75));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const hasActiveSearchOrFilters = useMemo(() => {
    if (search.trim().length > 0 || neighborhoodFilter !== null) return true;
    if (filters.minPrice !== 0 || filters.maxPrice !== 350_000_000) return true;
    if (filters.beds !== "any" || filters.baths !== "any" || filters.propertyType !== "any") return true;
    if (sortMode !== "newest") return true;
    return false;
  }, [search, neighborhoodFilter, filters, sortMode]);

  const clearFiltersAndBrowse = () => {
    setListingViewMode("browse");
    setSearch("");
    setNeighborhoodFilter(null);
    setFilters({
      minPrice: 0,
      maxPrice: 350_000_000,
      beds: "any",
      baths: "any",
      propertyType: "any",
    });
    setSortMode("newest");
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <MaddenTopNav />

      {/* 2. HERO SLIDER WITH SEARCH */}
      <section className="relative">
        <div className="relative h-[500px] w-full overflow-hidden bg-black/5">
          <AnimatePresence mode="wait">
            <motion.div
              key={HERO_SLIDES[heroIdx]}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              <Image
                src={HERO_SLIDES[heroIdx] ?? HERO_SLIDES[0]}
                alt="Luxury property"
                fill
                priority
                quality={95}
                className="object-cover"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/10" />
            </motion.div>
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setHeroIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
            className="absolute left-5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow-md hover:bg-white"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          <button
            type="button"
            onClick={() => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length)}
            className="absolute right-5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow-md hover:bg-white"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
          </button>

          {/* Search overlay */}
          <div className="absolute inset-0 z-10 grid place-items-center px-4">
            <div className="w-full max-w-3xl">
              <div className="mb-5 text-center">
                <h1 className="font-serif text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-4xl md:text-5xl">
                  Find Your Home in the Philippines
                </h1>
                <p className="mt-2 text-sm font-semibold text-white/95 drop-shadow sm:text-base md:text-lg">
                  Browse verified listings across Metro Manila, Cebu, and beyond
                </p>
              </div>
              <div className="w-full rounded-3xl border border-white/25 bg-white/85 p-4 shadow-2xl backdrop-blur-md">
                <div className="relative z-20 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                  <PhLocationInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by location or neighborhood"
                    aria-label="Search listings by location"
                    className="w-full min-w-0 flex-1"
                    inputClassName="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (hasActiveSearchOrFilters) {
                        setListingViewMode("results");
                        return;
                      }
                      const el = rowRefs.current[mode === "buy" ? "buy-featured" : "rent-featured"];
                      if (!el) return;
                      const step = Math.max(300, Math.round(el.clientWidth * 0.85));
                      el.scrollBy({ left: -step, behavior: "smooth" });
                    }}
                    className="w-full shrink-0 rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#6C8C70] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 sm:w-auto"
                  >
                    Search
                  </button>
                </div>
                <div className="mt-3 flex justify-center">
                  <div className="inline-flex gap-2 rounded-full bg-[#EBE6DC]/90 p-1 ring-1 ring-[#D4A843]/35 backdrop-blur-sm">
                    {mode === "rent" ? (
                      <>
                        <Link
                          href="/buy"
                          className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-neutral-50"
                        >
                          Buy
                        </Link>
                        <span className="rounded-full bg-gradient-to-b from-[#8faf91] to-[#6B9E6E] px-5 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[#D4A843]/50">
                          Rent
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="rounded-full bg-gradient-to-b from-[#8faf91] to-[#6B9E6E] px-5 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[#D4A843]/50">
                          Buy
                        </span>
                        <Link
                          href="/"
                          className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-neutral-50"
                        >
                          Rent
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Slide dots */}
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setHeroIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === heroIdx ? "w-7 bg-white" : "w-2 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <hr className="mx-auto w-3/4 border-t border-[#2C2C2C]/10" />

      {/* 3. QUICK STATS BAR */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
            <Stat icon={<Home className="h-4 w-4 text-[#6B9E6E]" />} value="1,200+" label="Active Listings" />
            <Stat icon={<Users className="h-4 w-4 text-[#6B9E6E]" />} value="847" label="Verified Agents" />
            <Stat icon={<Shield className="h-4 w-4 text-[#6B9E6E]" />} value="0" label="Reported Scams" />
          </div>
        </div>
      </section>

      <hr className="mx-auto w-3/4 border-t border-[#2C2C2C]/10" />

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-5 md:pb-16">
        {/* Loading / error */}
        {loading ? <div className="h-40 rounded-2xl animate-pulse bg-black/5" /> : null}
        {!loading && error ? (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load listings</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {/* PROPERTY LISTING SECTION (controlled by Buy/Rent toggle) */}
            <section id="listings">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {activeFilterChips(filters, sortMode, {
                    clearPrice: () => setFilters((s) => ({ ...s, minPrice: 0, maxPrice: 350_000_000 })),
                    clearBeds: () => setFilters((s) => ({ ...s, beds: "any" })),
                    clearBaths: () => setFilters((s) => ({ ...s, baths: "any" })),
                    clearType: () => setFilters((s) => ({ ...s, propertyType: "any" })),
                    clearSort: () => setSortMode("newest"),
                  }).map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50"
                    >
                      {chip.label}
                      <span className="text-[#2C2C2C]/35">×</span>
                    </button>
                  ))}
                  {countActiveFilters(filters, sortMode) > 0 ? (
                    <button
                      type="button"
                      onClick={() => clearFiltersAndBrowse()}
                      className="text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C]"
                    >
                      Clear All
                    </button>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className="relative inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                    {countActiveFilters(filters, sortMode) > 0 ? (
                      <span className="ml-1 rounded-full bg-[#D4A843]/18 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                        {countActiveFilters(filters, sortMode)}
                      </span>
                    ) : null}
                  </button>

                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50 focus-visible:outline-none"
                    aria-label="Sort"
                  >
                    <option value="newest">Newest</option>
                    <option value="price_low">Price Low-High</option>
                    <option value="price_high">Price High-Low</option>
                    <option value="most_beds">Most Beds</option>
                  </select>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {filtersOpen ? (
                  <motion.div
                    key="filters"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Price range</p>
                        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#2C2C2C]/60">
                          <span>{formatPeso(filters.minPrice)}</span>
                          <span>{formatPeso(filters.maxPrice)}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          <input
                            type="range"
                            min={0}
                            max={350_000_000}
                            step={1_000_000}
                            value={filters.minPrice}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setFilters((s) => ({ ...s, minPrice: Math.min(v, s.maxPrice) }));
                            }}
                          />
                          <input
                            type="range"
                            min={0}
                            max={350_000_000}
                            step={1_000_000}
                            value={filters.maxPrice}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setFilters((s) => ({ ...s, maxPrice: Math.max(v, s.minPrice) }));
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Beds</p>
                          <select
                            value={String(filters.beds)}
                            onChange={(e) => setFilters((s) => ({ ...s, beds: (e.target.value === "any" ? "any" : Number(e.target.value)) as FiltersState["beds"] }))}
                            className="mt-2 w-full rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
                          >
                            <option value="any">Any</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4+</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Baths</p>
                          <select
                            value={String(filters.baths)}
                            onChange={(e) => setFilters((s) => ({ ...s, baths: (e.target.value === "any" ? "any" : Number(e.target.value)) as FiltersState["baths"] }))}
                            className="mt-2 w-full rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
                          >
                            <option value="any">Any</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3+</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Type</p>
                          <select
                            value={filters.propertyType}
                            onChange={(e) => setFilters((s) => ({ ...s, propertyType: e.target.value as FiltersState["propertyType"] }))}
                            className="mt-2 w-full rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
                          >
                            <option value="any">Any</option>
                            <option value="House">House</option>
                            <option value="Condo">Condo</option>
                            <option value="Villa">Villa</option>
                            <option value="Land">Land</option>
                            <option value="Studio">Studio</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#2C2C2C]/10 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasActiveSearchOrFilters) {
                            setListingViewMode("results");
                            setFiltersOpen(false);
                          }
                        }}
                        disabled={!hasActiveSearchOrFilters}
                        className="rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6C8C70] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                {listingViewMode === "results" ? (
                  <motion.div
                    key="listing-results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-serif text-lg font-bold text-[#2C2C2C]">
                        {sortedAllRows.length} {sortedAllRows.length === 1 ? "property" : "properties"} match your search
                      </p>
                      <button
                        type="button"
                        onClick={() => clearFiltersAndBrowse()}
                        className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50"
                      >
                        Clear Filters
                      </button>
                    </div>
                    {sortedAllRows.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="mt-12 flex flex-col items-center justify-center px-4 text-center"
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/30">
                          <Search className="h-10 w-10 text-[#6B9E6E]" aria-hidden />
                        </div>
                        <p className="mt-6 font-serif text-xl font-bold text-[#2C2C2C]">No properties found in this area yet.</p>
                        <p className="mt-2 max-w-md text-sm font-semibold text-[#2C2C2C]/55">
                          Try adjusting your filters or exploring a different neighborhood.
                        </p>
                        <button
                          type="button"
                          onClick={() => clearFiltersAndBrowse()}
                          className="mt-6 rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#6C8C70]"
                        >
                          Clear Filters
                        </button>
                      </motion.div>
                    ) : (
                      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sortedAllRows.map((p) => (
                          <NewlyListedCard
                            key={`result-${p.id}`}
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
                            isSaved={saved.has(p.id)}
                            onToggleSaved={() => saved.toggle(p.id)}
                            connectedAgents={allConnectedAgentsByPropertyId.get(p.id) ?? []}
                            onOpenPropertyZoom={() => setZoomProperty(p)}
                            grid
                            viewerUserId={user?.id ?? null}
                            verifiedListingAgent={viewerVerifiedListingAgent}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`browse-${mode}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    {mode === "buy" ? (
                      <PropertyRows
                        rows={[
                          { key: "buy-featured", title: "Featured Picks", subtitle: "Recommended for you", items: featuredPicks, featured: true },
                          { key: "buy-new", title: "Newly Listed", subtitle: "Ordered by newest", items: newlyListed },
                          { key: "buy-lux", title: "Luxury Homes ₱50M+", subtitle: "Premium listings above ₱50M", items: luxury50m },
                          { key: "buy-schools", title: "Near Schools & Parks", subtitle: "Nearby family-friendly areas", items: nearSchoolsParks },
                          { key: "buy-pet", title: "Pet Friendly", subtitle: "Mock badge selection", items: petFriendly },
                          { key: "buy-gated", title: "Gated Communities", subtitle: "Mock badge selection", items: gated },
                          { key: "buy-open", title: "Open House This Weekend", subtitle: "Mock badge selection", items: openHouse },
                          { key: "buy-deals", title: "Foreclosures & Deals", subtitle: "Mock badge selection", items: deals },
                        ]}
                        showMore={showMoreCategories}
                        onToggleShowMore={() => setShowMoreCategories((v) => !v)}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        saved={saved}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                      />
                    ) : (
                      <PropertyRows
                        rows={[
                          { key: "rent-featured", title: "Featured Picks", subtitle: "Recommended for you", items: featuredPicks, featured: true },
                          { key: "rent-new", title: "Newly Listed Rentals", subtitle: "Newest rentals first", items: newlyListed },
                          { key: "rent-pet", title: "Pet Friendly Rentals", subtitle: "Mock badge selection", items: rentPetFriendly },
                          { key: "rent-furnished", title: "Furnished & Move-in Ready", subtitle: "Mock badge selection", items: furnished },
                          { key: "rent-bd", title: "Near Business Districts", subtitle: "BGC · Makati · Ortigas", items: nearBD },
                          { key: "rent-studio", title: "Studio & Condos", subtitle: "Beds ≤ 1", items: studiosCondos },
                          { key: "rent-short", title: "Short Term Available", subtitle: "Mock badge selection", items: shortTerm },
                          { key: "rent-family", title: "Family Homes for Rent", subtitle: "Beds ≥ 3", items: familyRent },
                        ]}
                        showMore={showMoreCategories}
                        onToggleShowMore={() => setShowMoreCategories((v) => !v)}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        saved={saved}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 5. BROWSE BY NEIGHBORHOOD */}
            <section id="neighborhoods" className="mt-12">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">
                    Browse by Neighborhood
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Filter newly listed homes instantly</p>
                </div>
                {neighborhoodFilter ? (
                  <button
                    type="button"
                    onClick={() => setNeighborhoodFilter(null)}
                    className="shrink-0 self-start text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C] sm:self-auto"
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Makati CBD",
                  "BGC",
                  "Alabang",
                  "Forbes Park",
                  "Tagaytay",
                  "Ortigas",
                  "Pasig",
                  "Quezon City",
                  "Mandaluyong",
                  "San Juan",
                ].map((n) => (
                  <Chip
                    key={n}
                    active={neighborhoodFilter === n}
                    label={n}
                    count={neighborhoodCounts.get(n) ?? 0}
                    onClick={() => setNeighborhoodFilter((v) => (v === n ? null : n))}
                  />
                ))}
              </div>
            </section>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 6. TOP VERIFIED AGENTS THIS WEEK */}
            <section className="mt-12">
              <div>
                <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Top Verified Agents This Week</h2>
                <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">High scores, fast responses, proven closings</p>
              </div>
              <div className="mt-4 flex items-stretch gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => scrollRow(topAgentsRef, "prev")}
                  className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 sm:flex"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div
                  ref={topAgentsRef}
                  className="min-w-0 flex-1 overflow-x-auto pb-2 scrollbar-hide max-md:overflow-visible"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:min-w-min md:gap-4">
                    {topAgents.map((a) => (
                      <AgentDirectoryCard key={a.id} agent={a} className="w-full shrink-0 md:w-[300px]" />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollRow(topAgentsRef, "next")}
                  className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 sm:flex"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 7. WHY FISHNET TRUST SECTION */}
            <section className="mt-12">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <Trust
                    icon={<Shield className="h-5 w-5 text-[#6B9E6E]" />}
                    title="All Agents Verified"
                    body="Every agent on BahayGo has a verified PRC license"
                  />
                  <Trust
                    icon={<BadgeCheck className="h-5 w-5 text-[#6B9E6E]" />}
                    title="Licensed Brokers Only"
                    body="All brokerages are registered and monitored"
                  />
                  <Trust
                    icon={<Lock className="h-5 w-5 text-[#6B9E6E]" />}
                    title="Anti-Scam Protection"
                    body="Zero tolerance policy. Report and remove instantly"
                  />
                </div>
              </div>
            </section>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 8. FEATURED PROPERTY */}
            {featured ? (
              <section className="mt-12">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                    <div className="relative h-[400px] w-full bg-black/5">
                      <Image
                        src={featuredPhotos[0] ?? featured.image_url}
                        alt={featured.name ?? featured.location}
                        fill
                        quality={95}
                        className="object-cover"
                        sizes="(min-width: 1024px) 600px, 100vw"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/35 px-3 py-3 backdrop-blur-sm">
                        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:scrollbar-hide">
                          {featuredPhotos.slice(0, 4).map((u) => (
                            <div key={u} className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/30">
                              <Image src={u} alt="" fill sizes="80px" className="object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#D4A843]/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a6d32]">
                        Featured
                      </span>
                      {featured.status === "for_rent" ? (
                        <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/70">
                          For Rent
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/70">
                          For Sale
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
                      {featured.name ?? featured.location}
                    </h2>
                    <p className="mt-2 font-serif text-2xl font-bold text-[#2C2C2C]">{featured.price}</p>
                    <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/60">
                      {featured.beds ? `${featured.beds} beds` : "Studio"} · {featured.baths} baths · {featured.sqft} sqft
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-[#2C2C2C]/60">
                      A vivid, high-contrast listing with verified agents underneath—built to feel like Zillow, but safer.
                    </p>
                    <Link
                      href={`/properties/${encodeURIComponent(featured.id)}`}
                      className="mt-4 inline-flex rounded-full bg-[#2C2C2C] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#6B9E6E]"
                    >
                      Learn More →
                    </Link>
                    <div className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
                      <ConnectedAgentsBox
                        title="Connected Agents"
                        agents={allConnectedAgentsByPropertyId.get(featured.id) ?? []}
                        defaultVisible={3}
                      />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />
          </>
        ) : null}
      </main>

      <AnimatePresence>
        {zoomProperty ? (
          <PropertyZoomModal
            property={zoomProperty}
            agents={allConnectedAgentsByPropertyId.get(zoomProperty.id) ?? []}
            onClose={() => setZoomProperty(null)}
            isSaved={saved.has(zoomProperty.id)}
            onToggleSaved={() => saved.toggle(zoomProperty.id)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CategorySection({
  title,
  subtitle,
  sectionRef,
  expanded,
  onToggleExpanded,
  items,
  cardRoomIdx,
  setCardRoomIdx,
  saved,
  connectedAgentsByPropertyId,
  scrollRow,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
}: {
  title: string;
  subtitle: string;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  expanded: boolean;
  onToggleExpanded: () => void;
  items: DbProperty[];
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  saved: ReturnType<typeof useSavedPropertyIds>;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  scrollRow: (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => void;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
}) {
  const visible = expanded ? items : items.slice(0, 12);

  return (
    <>
      <div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      <div className="mt-4 flex items-stretch gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={sectionRef}
          className="min-w-0 flex-1 overflow-x-auto pb-2 scrollbar-hide"
        >
          <div className="flex w-max flex-nowrap gap-3">
            {visible.map((p) => (
              <NewlyListedCard
                key={`${title}-${p.id}`}
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
                    [p.id]:
                      ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                  }))
                }
                isSaved={saved.has(p.id)}
                onToggleSaved={() => saved.toggle(p.id)}
                connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
                grid
                compact
                verifiedListingAgent={viewerVerifiedListingAgent}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {items.length > 12 ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50"
          >
            {expanded ? "Show less" : "Show more"}
            <ArrowDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      ) : null}
    </>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-[#6B9E6E]/12">{icon}</div>
      <div className="text-left">
        <div className="text-lg font-bold text-[#2C2C2C]">{value}</div>
        <div className="text-xs font-semibold text-[#2C2C2C]/55">{label}</div>
      </div>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-black/10 ${
        active ? "bg-[#2C2C2C] text-white" : "bg-white text-[#2C2C2C]/70 hover:bg-neutral-50"
      }`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-white/20" : "bg-[#6B9E6E]/12 text-[#2C2C2C]/70"}`}>
        {count}
      </span>
    </button>
  );
}

function Trust({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-semibold text-[#2C2C2C]">{title}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">{body}</p>
    </div>
  );
}

export function NewlyListedCard({
  property,
  roomUrls,
  roomIdx,
  onRoomPrev,
  onRoomNext,
  isSaved,
  onToggleSaved,
  connectedAgents,
  onOpenPropertyZoom,
  grid,
  gridCardClassName,
  cardWidthClass,
  viewerUserId,
  compact,
  verifiedListingAgent,
}: {
  property: DbProperty;
  roomUrls: string[];
  roomIdx: number;
  onRoomPrev: () => void;
  onRoomNext: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
  connectedAgents: MarketplaceAgent[];
  onOpenPropertyZoom: () => void;
  grid?: boolean;
  /** When `grid` is true: widths for horizontal category rows (mobile peek + desktop columns). */
  gridCardClassName?: string;
  cardWidthClass?: string;
  viewerUserId?: string | null;
  /** Smaller image + type for 5-across carousels */
  compact?: boolean;
  /** Logged-in viewer is approved + verified agent (homepage co-list CTA). */
  verifiedListingAgent?: boolean;
}) {
  const listedLabel = listingListedLabel(property.created_at);
  const statusLabel = property.status === "for_rent" ? "For Rent" : "For Sale";
  const img = roomUrls[roomIdx] ?? roomUrls[0] ?? property.image_url;

  const hiddenCount = Math.max(0, connectedAgents.length - 2);
  type AgentRow =
    | { kind: "agent"; agent: MarketplaceAgent }
    | { kind: "placeholder" };
  const agentRows: AgentRow[] = (() => {
    const n = connectedAgents.length;
    if (n === 0) {
      return [{ kind: "placeholder" }, { kind: "placeholder" }];
    }
    if (n === 1) {
      return [{ kind: "agent", agent: connectedAgents[0]! }, { kind: "placeholder" }];
    }
    return connectedAgents.slice(0, 2).map((a) => ({ kind: "agent" as const, agent: a }));
  })();
  const showYourListingBadge =
    !!viewerUserId &&
    connectedAgents.some((a) => a.userId === viewerUserId);

  const imgH = compact ? "h-44 sm:h-48" : "h-52 sm:h-56";
  const titleLine = property.name?.trim() || property.location;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md",
        grid
          ? gridCardClassName ?? "w-[260px] shrink-0 md:w-[280px] lg:w-[300px]"
          : cn(cardWidthClass ?? "w-[300px]", "shrink-0"),
      )}
    >
      <div className={`relative w-full overflow-hidden bg-neutral-900 ${imgH}`}>
        <Image
          src={img}
          alt={property.name ?? property.location}
          fill
          quality={92}
          className="object-cover"
          sizes={grid ? "(min-width: 1024px) 300px, (min-width: 768px) 280px, 260px" : compact ? "300px" : "360px"}
        />
        <button
          type="button"
          onClick={onOpenPropertyZoom}
          className="absolute inset-0 z-[6] cursor-pointer bg-transparent"
          aria-label="Open property details"
        />

        {roomUrls.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRoomPrev();
              }}
              className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100"
              aria-label="Previous room photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRoomNext();
              }}
              className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100"
              aria-label="Next room photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-black/25 to-transparent" />

        <div className="absolute left-3 top-3 z-20">
          <span className="rounded-full bg-[#6B9E6E] px-3 py-1 text-[11px] font-bold text-white shadow-sm">
            {statusLabel}
          </span>
        </div>

        <div className="absolute right-3 top-3 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSaved();
            }}
            className="rounded-full bg-white/95 p-2 shadow-sm ring-1 ring-black/5"
            aria-label={isSaved ? "Unsave" : "Save"}
          >
            <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"}`} />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-5rem)] flex-col items-start gap-1.5">
          <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-sm ring-1 ring-black/5">
            {listedLabel}
          </span>
          {showYourListingBadge ? (
            <Link
              href="/dashboard/agent"
              className="pointer-events-auto rounded-full bg-[#D4A843]/95 px-2.5 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm ring-1 ring-[#8a6d32]/30 hover:bg-[#D4A843]"
              onClick={(e) => e.stopPropagation()}
            >
              This is your listing
            </Link>
          ) : null}
        </div>
      </div>

      <div className={`border-t border-[#2C2C2C]/10 bg-white ${compact ? "px-3 py-2.5" : "px-3 py-3 sm:px-4"}`}>
        <p
          className={`font-serif font-bold tracking-tight text-[#D4A843] ${compact ? "text-base" : "text-lg sm:text-xl"}`}
        >
          {property.price}
        </p>
        <p className={`mt-1 line-clamp-2 text-[#2C2C2C] ${compact ? "text-sm font-bold" : "text-base font-bold"}`}>
          {titleLine}
        </p>
        <p className={`mt-1 text-[#6B6B6B] ${compact ? "text-[11px]" : "text-xs"}`}>
          {property.beds ? `${property.beds} beds` : "Studio"} · {property.baths} baths · {property.sqft} sqft
        </p>
        <p
          className={`mt-1.5 flex items-start gap-1 text-[#6B6B6B] ${compact ? "text-[11px]" : "text-xs"}`}
        >
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E8E8E]" aria-hidden />
          <span className="line-clamp-2 leading-snug">{property.location}</span>
        </p>
      </div>

      <div
        className="relative z-10 flex flex-col gap-0 border-t border-gray-100 bg-white pt-2"
        style={{ minHeight: compact ? "108px" : "124px" }}
      >
        <div className="flex flex-1 flex-col justify-between px-4 pb-0 pt-2">
          <div>
            <div className="space-y-2">
              {agentRows.map((row, idx) =>
                row.kind === "agent" ? (
                  <Link
                    key={row.agent.id}
                    href={`/agents/${encodeURIComponent(row.agent.id)}`}
                    title={row.agent.name}
                    onClick={(e) => e.stopPropagation()}
                    className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-0.5 -mx-1 transition-colors duration-150 ease-out hover:bg-[#6B9E6E15]"
                  >
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                      <AgentAvatarFill name={row.agent.name} imageUrl={row.agent.image} sizes="28px" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#2C2C2C]/75 transition-colors duration-150 ease-out group-hover:text-[#2C2C2C]">
                      {row.agent.name.length > 12 ? `${row.agent.name.slice(0, 12)}…` : row.agent.name}
                    </span>
                    <BadgeCheck className="h-4 w-4 shrink-0 text-[#D4A843]" aria-label="Verified" />
                    <span className="shrink-0 text-xs font-bold text-[#2C2C2C]/80 transition-colors duration-150 ease-out group-hover:text-[#2C2C2C]">
                      {Math.round(row.agent.score)}
                    </span>
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
                      aria-hidden
                    />
                  </Link>
                ) : (
                  <div key={`placeholder-${idx}`} className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] ring-1 ring-black/10">
                      <span className="text-sm font-bold text-white">?</span>
                    </div>
                    <AgentSlotPlaceholder
                      onLinkClick={(e) => e.stopPropagation()}
                      propertyId={property.id}
                      verifiedListingAgent={verifiedListingAgent}
                    />
                  </div>
                ),
              )}
            </div>

            {hiddenCount > 0 ? (
              <p
                className="mt-2 cursor-pointer text-center text-xs font-semibold text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
                onClick={onOpenPropertyZoom}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenPropertyZoom();
                  }
                }}
              >
                Show More
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={onOpenPropertyZoom}
            className="rounded-full p-1 text-[#2C2C2C]/40 transition hover:bg-neutral-50 hover:text-[#2C2C2C]/60"
            aria-label="Open property details"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function countActiveFilters(filters: FiltersState, sortMode: SortMode): number {
  let n = 0;
  if (filters.minPrice !== 0 || filters.maxPrice !== 350_000_000) n++;
  if (filters.beds !== "any") n++;
  if (filters.baths !== "any") n++;
  if (filters.propertyType !== "any") n++;
  if (sortMode !== "newest") n++;
  return n;
}

function activeFilterChips(
  filters: FiltersState,
  sortMode: SortMode,
  actions: {
    clearPrice: () => void;
    clearBeds: () => void;
    clearBaths: () => void;
    clearType: () => void;
    clearSort: () => void;
  },
) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.minPrice !== 0 || filters.maxPrice !== 350_000_000) {
    chips.push({
      key: "price",
      label: `Price ${formatPeso(filters.minPrice)}–${formatPeso(filters.maxPrice)}`,
      onRemove: actions.clearPrice,
    });
  }
  if (filters.beds !== "any") {
    chips.push({ key: "beds", label: `Beds ${filters.beds === 4 ? "4+" : filters.beds}`, onRemove: actions.clearBeds });
  }
  if (filters.baths !== "any") {
    chips.push({ key: "baths", label: `Baths ${filters.baths === 3 ? "3+" : filters.baths}`, onRemove: actions.clearBaths });
  }
  if (filters.propertyType !== "any") {
    chips.push({ key: "type", label: `Type ${filters.propertyType}`, onRemove: actions.clearType });
  }
  if (sortMode !== "newest") {
    const label =
      sortMode === "price_low"
        ? "Sort Price ↑"
        : sortMode === "price_high"
          ? "Sort Price ↓"
          : sortMode === "most_beds"
            ? "Sort Beds"
            : "Sort";
    chips.push({ key: "sort", label, onRemove: actions.clearSort });
  }
  return chips;
}

function PropertyRows({
  rows,
  showMore,
  onToggleShowMore,
  rowRefs,
  cardRoomIdx,
  setCardRoomIdx,
  saved,
  connectedAgentsByPropertyId,
  viewerUserId,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
}: {
  rows: { key: string; title: string; subtitle: string; items: DbProperty[]; featured?: boolean }[];
  showMore: boolean;
  onToggleShowMore: () => void;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  saved: ReturnType<typeof useSavedPropertyIds>;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
}) {
  const first = rows.slice(0, 4);
  const rest = rows.slice(4);

  return (
    <div className="space-y-6">
      {first.map((r, i) => (
        <div key={r.key}>
          <RowCarousel
            rowKey={r.key}
            title={r.title}
            subtitle={r.subtitle}
            items={r.items}
            featured={!!r.featured}
            rowRefs={rowRefs}
            cardRoomIdx={cardRoomIdx}
            setCardRoomIdx={setCardRoomIdx}
            saved={saved}
            connectedAgentsByPropertyId={connectedAgentsByPropertyId}
            viewerUserId={viewerUserId}
            onOpenPropertyZoom={onOpenPropertyZoom}
            viewerVerifiedListingAgent={viewerVerifiedListingAgent}
          />
          {i < first.length - 1 ? (
            <hr className="mx-auto my-3 w-3/4 border-t border-[#2C2C2C]/10" />
          ) : null}
        </div>
      ))}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleShowMore}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2C2C]/75 ring-1 ring-black/10 hover:bg-neutral-50"
        >
          {showMore ? "Show Less ↑" : "Show More Categories ↓"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showMore ? (
          <motion.div
            key="more-cats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden space-y-6"
          >
            {rest.map((r) => (
              <div key={r.key}>
                <RowCarousel
                  rowKey={r.key}
                  title={r.title}
                  subtitle={r.subtitle}
                  items={r.items}
                  featured={!!r.featured}
                  rowRefs={rowRefs}
                  cardRoomIdx={cardRoomIdx}
                  setCardRoomIdx={setCardRoomIdx}
                  saved={saved}
                  connectedAgentsByPropertyId={connectedAgentsByPropertyId}
                  viewerUserId={viewerUserId}
                  onOpenPropertyZoom={onOpenPropertyZoom}
                  viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                />
                <hr className="mx-auto my-3 w-3/4 border-t border-[#2C2C2C]/10" />
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ListingRowPlaceholderCard({ cardWidthClass }: { cardWidthClass: string }) {
  return (
    <div
      className={`flex min-h-[300px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2C2C2C]/15 bg-white px-3 py-8 shadow-md ${cardWidthClass}`}
    >
      <Home className="mb-2 h-6 w-6 text-[#6B9E6E]/55" />
      <p className="text-center text-xs font-semibold text-[#2C2C2C]/45">More listings coming soon</p>
    </div>
  );
}

function RowCarousel({
  rowKey,
  title,
  subtitle,
  items,
  featured,
  rowRefs,
  cardRoomIdx,
  setCardRoomIdx,
  saved,
  connectedAgentsByPropertyId,
  viewerUserId,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
}: {
  rowKey: string;
  title: string;
  subtitle: string;
  items: DbProperty[];
  featured: boolean;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  saved: ReturnType<typeof useSavedPropertyIds>;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
}) {
  const scroll = (dir: "prev" | "next") => {
    const el = rowRefs.current[rowKey];
    if (!el) return;
    const step = Math.max(300, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const list = items.slice(0, 12);
  const placeholderCount = list.length > 0 && list.length < 5 ? 5 - list.length : 0;
  const featuredClasses = featured ? "rounded-2xl border border-[#D4A843]/30 bg-[#D4A843]/5 px-3 pt-3" : "";
  const cardWidthClass = "w-[260px] shrink-0 md:w-[280px] lg:w-[300px]";

  return (
    <div className={featuredClasses}>
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {featured ? <Star className="h-4 w-4 shrink-0 text-[#D4A843]" /> : null}
          <h2 className="min-w-0 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">{title}</h2>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      <div className="flex items-stretch gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => scroll("prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={(el) => {
            rowRefs.current[rowKey] = el;
          }}
          className="min-w-0 flex-1 overflow-x-auto pb-2 scrollbar-hide"
        >
          <div className="flex w-max flex-nowrap gap-3">
            {list.map((p) => (
              <NewlyListedCard
                key={`${rowKey}-${p.id}`}
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
                isSaved={saved.has(p.id)}
                onToggleSaved={() => saved.toggle(p.id)}
                connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
                cardWidthClass={cardWidthClass}
                viewerUserId={viewerUserId}
                compact
                verifiedListingAgent={viewerVerifiedListingAgent}
              />
            ))}
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <ListingRowPlaceholderCard key={`ph-${rowKey}-${i}`} cardWidthClass={cardWidthClass} />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scroll("next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

