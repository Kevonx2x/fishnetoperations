"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Shield,
  BadgeCheck,
  Lock,
  Flame,
  Users,
  Star,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { ConnectedAgentsBox } from "@/components/marketplace/connected-agents-box";
import { FinnMascot } from "@/components/marketplace/mascots/finn-mascot";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty, SortMode } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { useSavedPropertyIds } from "@/lib/saved-properties";
import { useAuth } from "@/contexts/auth-context";
import { PropertyZoomModal } from "@/components/marketplace/property-zoom-modal";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { listingListedLabel } from "@/lib/listing-listed-time";

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
  const [cardAgentsExpanded, setCardAgentsExpanded] = useState<Record<string, boolean>>({});
  const [zoomProperty, setZoomProperty] = useState<DbProperty | null>(null);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const topAgentsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          id, created_at, name, location, price, sqft, beds, baths, image_url, status, listed_by,
          property_photos (url, sort_order),
          property_agents (agent:agents (id, user_id, name, image_url, score, closings, response_time, availability, brokers (id, company_name, logo_url)))
        `,
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setProperties([]);
      } else {
        setProperties((data ?? []) as unknown as DbProperty[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, user_id, name, image_url, score, closings, response_time, availability, brokers (id, company_name, logo_url)")
        .eq("status", "approved")
        .eq("verified", true);
      if (cancelled) return;
      if (!error) {
        setAgents((data ?? []).map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0])));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allConnectedAgentsByPropertyId = useMemo(() => {
    const m = new Map<string, MarketplaceAgent[]>();
    for (const p of properties) {
      const nested = (p.property_agents ?? [])
        .map((x) => (x as { agent?: unknown }).agent)
        .filter(Boolean)
        .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]));
      const dedup = new Map(nested.map((a) => [a.id, a]));
      m.set(p.id, [...dedup.values()]);
    }
    return m;
  }, [properties]);

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

  const topAgents = useMemo(() => [...agents].sort((a, b) => b.score - a.score).slice(0, 10), [agents]);
  const featured = useMemo(() => properties[0] ?? null, [properties]);
  const featuredPhotos = useMemo(() => {
    const list = (featured?.property_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    return list.length ? list.map((x) => x.url) : featured?.image_url ? [featured.image_url] : [];
  }, [featured]);

  const scrollRow = (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => {
    const el = ref.current;
    if (!el) return;
    const step = Math.max(280, Math.round(el.clientWidth * 0.75));
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
    <div className="min-h-screen bg-[#FAF8F4]">
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
              <div className="rounded-3xl border border-white/25 bg-white/85 p-4 shadow-2xl backdrop-blur-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by location, neighborhood, or zip code"
                    className="w-full flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
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
                      const step = Math.max(260, Math.round(el.clientWidth * 0.85));
                      el.scrollBy({ left: -step, behavior: "smooth" });
                    }}
                    className="rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#6C8C70] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
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
                          className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-[#FAF8F4]"
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
                          className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-[#FAF8F4]"
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
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
            <Stat icon={<Home className="h-4 w-4 text-[#6B9E6E]" />} value="1,200+" label="Active Listings" />
            <Stat icon={<Users className="h-4 w-4 text-[#6B9E6E]" />} value="847" label="Verified Agents" />
            <Stat icon={<Shield className="h-4 w-4 text-[#6B9E6E]" />} value="0" label="Reported Scams" />
          </div>
        </div>
      </section>

      <hr className="mx-auto w-3/4 border-t border-[#2C2C2C]/10" />

      <main className="mx-auto max-w-6xl px-3 pb-16 pt-10">
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
                <div className="flex flex-wrap items-center gap-2">
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
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-[#FAF8F4]"
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className="relative inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4]"
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
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4] focus-visible:outline-none"
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
                            className="mt-2 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
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
                            className="mt-2 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
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
                            className="mt-2 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
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
                        className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4]"
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
                        <FinnMascot mood="sad" size={120} className="drop-shadow-sm" />
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
                            agentsExpanded={cardAgentsExpanded[p.id] ?? false}
                            onToggleAgentsExpanded={() =>
                              setCardAgentsExpanded((s) => ({ ...s, [p.id]: !(s[p.id] ?? false) }))
                            }
                            onOpenPropertyZoom={() => setZoomProperty(p)}
                            grid
                            viewerUserId={user?.id ?? null}
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
                        cardAgentsExpanded={cardAgentsExpanded}
                        setCardAgentsExpanded={setCardAgentsExpanded}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
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
                        cardAgentsExpanded={cardAgentsExpanded}
                        setCardAgentsExpanded={setCardAgentsExpanded}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 5. BROWSE BY NEIGHBORHOOD */}
            <section id="neighborhoods" className="mt-12">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Browse by Neighborhood</h2>
                  <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Filter newly listed homes instantly</p>
                </div>
                {neighborhoodFilter ? (
                  <button
                    type="button"
                    onClick={() => setNeighborhoodFilter(null)}
                    className="text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C]"
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                  className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-[#FAF8F4] sm:flex"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div ref={topAgentsRef} className="min-w-0 flex-1 overflow-x-auto pb-2 scrollbar-hide">
                  <div className="flex gap-4">
                    {topAgents.map((a) => (
                      <AgentCard key={a.id} agent={a} />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollRow(topAgentsRef, "next")}
                  className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-[#FAF8F4] sm:flex"
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
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
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
  cardAgentsExpanded,
  setCardAgentsExpanded,
  scrollRow,
  onOpenPropertyZoom,
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
  cardAgentsExpanded: Record<string, boolean>;
  setCardAgentsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  scrollRow: (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => void;
  onOpenPropertyZoom: (p: DbProperty) => void;
}) {
  const visible = expanded ? items : items.slice(0, 12);

  return (
    <>
      <div>
        <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      <div className="mt-4 flex items-stretch gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-[#FAF8F4] sm:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={sectionRef} className="min-w-0 flex-1 overflow-x-auto pb-2 scrollbar-hide">
          <div className="grid min-w-[980px] grid-cols-4 gap-4">
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
                agentsExpanded={cardAgentsExpanded[p.id] ?? false}
                onToggleAgentsExpanded={() =>
                  setCardAgentsExpanded((s) => ({ ...s, [p.id]: !(s[p.id] ?? false) }))
                }
                onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
                grid
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-[#FAF8F4] sm:flex"
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
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-[#FAF8F4]"
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
        active ? "bg-[#2C2C2C] text-white" : "bg-white text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
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
  agentsExpanded,
  onToggleAgentsExpanded,
  onOpenPropertyZoom,
  grid,
  cardWidthClass,
  viewerUserId,
}: {
  property: DbProperty;
  roomUrls: string[];
  roomIdx: number;
  onRoomPrev: () => void;
  onRoomNext: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
  connectedAgents: MarketplaceAgent[];
  agentsExpanded: boolean;
  onToggleAgentsExpanded: () => void;
  onOpenPropertyZoom: () => void;
  grid?: boolean;
  cardWidthClass?: string;
  viewerUserId?: string | null;
}) {
  const listedLabel = listingListedLabel(property.created_at);
  const statusLabel = property.status === "for_rent" ? "For Rent" : "For Sale";
  const img = roomUrls[roomIdx] ?? roomUrls[0] ?? property.image_url;

  const visibleAgents = agentsExpanded ? connectedAgents : connectedAgents.slice(0, 2);
  const hiddenCount = Math.max(0, connectedAgents.length - 2);
  const showYourListingBadge =
    !!viewerUserId &&
    connectedAgents.some((a) => a.userId === viewerUserId);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md ${
        grid ? "" : `${cardWidthClass ?? "w-[260px]"} shrink-0`
      }`}
    >
      <div className="relative h-40 w-full bg-black/5">
        <Image
          src={img}
          alt={property.name ?? property.location}
          fill
          quality={92}
          className="object-cover"
          sizes={grid ? "(min-width: 1024px) 360px, 100vw" : "260px"}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
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
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow-md hover:bg-white"
              aria-label="Previous room photo"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRoomNext();
              }}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow-md hover:bg-white"
              aria-label="Next room photo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}

        <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-sm">
            {listedLabel}
          </span>
          {showYourListingBadge ? (
            <Link
              href="/dashboard/agent"
              className="rounded-full bg-[#D4A843]/95 px-2.5 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm ring-1 ring-[#8a6d32]/30 backdrop-blur-sm hover:bg-[#D4A843]"
              onClick={(e) => e.stopPropagation()}
            >
              This is your listing
            </Link>
          ) : null}
        </div>
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          <span className="rounded-full bg-[#6B9E6E] px-3 py-1 text-[11px] font-bold text-white shadow-sm">
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSaved();
            }}
            className="rounded-full bg-white/90 p-2 shadow-sm"
            aria-label={isSaved ? "Unsave" : "Save"}
          >
            <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"}`} />
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4">
          <p className="font-serif text-2xl font-bold text-white">{property.price}</p>
          <p className="mt-1 line-clamp-1 text-sm font-semibold text-white/90">{property.name ?? property.location}</p>
          <p className="mt-1 text-xs font-semibold text-white/80">
            {property.beds ? `${property.beds} beds` : "Studio"} · {property.baths} baths · {property.sqft} sqft
          </p>
        </div>
      </div>

      {/* Connected agents strip */}
      <div className="relative border-t border-[#2C2C2C]/10 bg-white px-4 pb-4 pt-4">
        <div className="space-y-2">
          {visibleAgents.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5">
              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="28px" />
              </div>
              <Link
                href={`/agents/${encodeURIComponent(a.id)}`}
                className="min-w-0 flex-1 truncate text-xs font-semibold text-[#2C2C2C] hover:underline hover:decoration-[#D4A843]/60 hover:underline-offset-4"
                title={a.name}
              >
                {a.name.length > 12 ? `${a.name.slice(0, 12)}…` : a.name}
              </Link>
              <BadgeCheck className="h-4 w-4 shrink-0 text-[#D4A843]" aria-label="Verified" />
              <span className="ml-auto text-xs font-bold text-[#2C2C2C]">
                {Math.round(a.score)}
              </span>
            </div>
          ))}
        </div>

        {hiddenCount > 0 ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={onToggleAgentsExpanded}
              className="text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C]"
            >
              Show More
            </button>
          </div>
        ) : null}
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={onOpenPropertyZoom}
            className="rounded-full p-1 text-[#2C2C2C]/40 transition hover:bg-[#FAF8F4] hover:text-[#2C2C2C]/60"
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
  cardAgentsExpanded,
  setCardAgentsExpanded,
  viewerUserId,
  onOpenPropertyZoom,
}: {
  rows: { key: string; title: string; subtitle: string; items: DbProperty[]; featured?: boolean }[];
  showMore: boolean;
  onToggleShowMore: () => void;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  saved: ReturnType<typeof useSavedPropertyIds>;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  cardAgentsExpanded: Record<string, boolean>;
  setCardAgentsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
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
            cardAgentsExpanded={cardAgentsExpanded}
            setCardAgentsExpanded={setCardAgentsExpanded}
            viewerUserId={viewerUserId}
            onOpenPropertyZoom={onOpenPropertyZoom}
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
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2C2C]/75 ring-1 ring-black/10 hover:bg-[#FAF8F4]"
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
                  cardAgentsExpanded={cardAgentsExpanded}
                  setCardAgentsExpanded={setCardAgentsExpanded}
                  viewerUserId={viewerUserId}
                  onOpenPropertyZoom={onOpenPropertyZoom}
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
  cardAgentsExpanded,
  setCardAgentsExpanded,
  viewerUserId,
  onOpenPropertyZoom,
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
  cardAgentsExpanded: Record<string, boolean>;
  setCardAgentsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
}) {
  const scroll = (dir: "prev" | "next") => {
    const el = rowRefs.current[rowKey];
    if (!el) return;
    const step = Math.max(260, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const list = items.slice(0, 12);
  const placeholderCount = list.length > 0 && list.length < 4 ? 4 - list.length : 0;
  const featuredClasses = featured ? "rounded-2xl border border-[#D4A843]/30 bg-[#D4A843]/5 px-3 pt-3" : "";
  const cardWidthClass = "w-[260px]";

  return (
    <div className={featuredClasses}>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          {featured ? <Star className="h-4 w-4 text-[#D4A843]" /> : null}
          <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">{title}</h2>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      <div className="flex items-stretch gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => scroll("prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-[#FAF8F4] sm:flex"
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
          <div className="flex gap-4">
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
                agentsExpanded={cardAgentsExpanded[p.id] ?? false}
                onToggleAgentsExpanded={() =>
                  setCardAgentsExpanded((s) => ({ ...s, [p.id]: !(s[p.id] ?? false) }))
                }
                onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
                cardWidthClass={cardWidthClass}
                viewerUserId={viewerUserId}
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
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-[#FAF8F4] sm:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: MarketplaceAgent }) {
  return (
    <div className="w-[320px] shrink-0 rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-md">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
          <AgentAvatarFill name={agent.name} imageUrl={agent.image} sizes="64px" textClassName="text-lg" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-[#2C2C2C]">{agent.name}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-1 text-[11px] font-bold text-[#8a6d32]">
              <Flame className="h-3.5 w-3.5 text-[#D4A843]" />
              Verified
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[#2C2C2C]/55">{agent.company || agent.brokerName}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#2C2C2C]/60">
            <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{agent.closings} closings</span>
            <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">Score {Math.round(agent.score)}</span>
          </div>
        </div>
      </div>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className="mt-4 inline-flex w-full justify-center rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
      >
        View Profile
      </Link>
    </div>
  );
}
