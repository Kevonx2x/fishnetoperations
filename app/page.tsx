"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Heart,
  X,
  Calendar,
  Clock,
  Calculator,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { WelcomeOverlay } from "@/components/marketplace/welcome-overlay";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { MaddenAgentRow } from "@/components/marketplace/madden-agent-row";
import { BottomNav, type BottomTab } from "@/components/marketplace/bottom-nav";
import { BrokersDirectory } from "@/components/marketplace/brokers-directory";
import {
  parsePriceValue,
  sortProperties,
  matchesPropertyTypeDb,
  type SortMode,
} from "@/lib/marketplace-property";
import {
  mapRowToMarketplaceAgent,
  type MarketplaceAgent,
} from "@/lib/marketplace-types";
import { SearchTabPanel } from "@/components/marketplace/search-tab-panel";
import {
  PropertyDetailFull,
  type DetailProperty,
} from "@/components/marketplace/property-detail-full";
import { KeyFavoriteBurst } from "@/components/marketplace/mascots/key-mascot";
import { FinnMascot } from "@/components/marketplace/mascots/finn-mascot";

const PropertiesMap = dynamic(
  () =>
    import("@/components/marketplace/properties-map").then(
      (m) => m.PropertiesMap,
    ),
  { ssr: false },
);

type ListingAgentProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
} | null;

interface Property {
  id: string;
  created_at: string;
  location: string;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  listed_by: string | null;
  property_type: string | null;
  lat: number | null;
  lng: number | null;
  listing_agent: ListingAgentProfile;
}

const ROOM_IMAGES = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
];

function buildRoomGallery(property: Property): string[] {
  const primary = property.image_url;
  // Filter out the primary image to avoid duplicates, but ensure we have enough extras
  let extras = ROOM_IMAGES.filter((u) => u !== primary);

  // If we don't have at least 3 extras (e.g., primary was a custom URL not in the list), pad with defaults
  if (extras.length < 3) {
    const defaults = ROOM_IMAGES.filter((u) => u !== primary);
    while (extras.length < 3 && defaults.length) {
      extras.push(...defaults);
    }
    // Final fallback: if still not enough, just add the first image repeatedly
    while (extras.length < 3) {
      extras.push(ROOM_IMAGES[0]);
    }
  }

  // Remove duplicates (simple dedupe by value, since all are strings)
  extras = [...new Map(extras.map((url) => [url, url])).values()];

  // Deterministic shuffle based on property ID to make the gallery unique per property
  let hash = 0;
  for (let i = 0; i < property.id.length; i++) {
    hash = (hash + property.id.charCodeAt(i) * (i + 1)) % 1024;
  }
  const start = extras.length ? hash % extras.length : 0;
  const rotated = [...extras.slice(start), ...extras.slice(0, start)];

  // Return primary + up to 3 distinct extras
  return [primary, ...rotated.slice(0, 3)];
}

function filterProperties(
  list: Property[],
  applied: {
    searchQuery: string;
    priceRange: [number, number];
    bedsFilter: number | null;
    bathsFilter: number | null;
    propertyType: string | null;
  },
): Property[] {
  const q = applied.searchQuery.trim().toLowerCase();
  return list.filter((p) => {
    if (q && !p.location.toLowerCase().includes(q)) return false;
    const pv = parsePriceValue(p.price);
    if (pv < applied.priceRange[0] || pv > applied.priceRange[1]) return false;
    if (applied.bedsFilter !== null && p.beds < applied.bedsFilter)
      return false;
    if (applied.bathsFilter !== null && p.baths < applied.bathsFilter)
      return false;
    if (
      !matchesPropertyTypeDb(p.location, p.property_type, applied.propertyType)
    )
      return false;
    return true;
  });
}

type HomeAgentTab = "top" | "mc" | "shared" | "ut" | "props";

export default function FishnetHome() {
  const [bottomTab, setBottomTab] = useState<BottomTab>("home");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleAgent, setScheduleAgent] = useState<MarketplaceAgent | null>(
    null,
  );
  const [heroSaved, setHeroSaved] = useState(false);
  const savedPrevRef = useRef(false);
  const [keyBurstShow, setKeyBurstShow] = useState(false);
  const [homeAgentTab, setHomeAgentTab] = useState<HomeAgentTab>("top");
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);

  const [filterDraft, setFilterDraft] = useState({
    searchQuery: "",
    priceRange: [0, 350_000_000] as [number, number],
    bedsFilter: null as number | null,
    bathsFilter: null as number | null,
    propertyType: null as string | null,
  });
  const [filterApplied, setFilterApplied] = useState({
    searchQuery: "",
    priceRange: [0, 350_000_000] as [number, number],
    bedsFilter: null as number | null,
    bathsFilter: null as number | null,
    propertyType: null as string | null,
  });
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [heroPropertyId, setHeroPropertyId] = useState<string | null>(null);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [marketplaceAgents, setMarketplaceAgents] = useState<
    MarketplaceAgent[]
  >([]);
  const propertyCarouselRef = useRef<HTMLDivElement | null>(null);

  const scrollPropertyCarousel = useCallback((direction: "prev" | "next") => {
    const el = propertyCarouselRef.current;
    if (!el) return;
    const step = Math.max(200, Math.round(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === "next" ? step : -step,
      behavior: "smooth",
    });
  }, []);

  // Fetch properties with corrected Supabase join syntax
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPropertiesLoading(true);
      setPropertiesError(null);
      // FIXED: Use dot notation for the join if the relationship is named 'profiles'
      // If your foreign key is named differently, you might need to use the exact constraint name.
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          id, created_at, location, price, sqft, beds, baths, image_url, listed_by, property_type, lat, lng,
          listing_agent:profiles!listed_by (id, full_name, avatar_url)
        `,
        )
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Supabase error:", error);
        setPropertiesError(error.message);
        setProperties([]);
      } else {
        const rows = (data ?? []).map(
          (raw: any) =>
            ({
              ...raw,
              listing_agent: raw.listing_agent ?? null,
              listed_by: raw.listed_by ?? null,
              property_type: raw.property_type ?? null,
              lat: raw.lat ?? null,
              lng: raw.lng ?? null,
            }) as Property,
        );
        setProperties(rows);
      }
      setPropertiesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch agents
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("agents")
        .select(
          `
          id, user_id, name, image_url, score, closings, response_time, availability,
          brokers (id, company_name, logo_url)
        `,
        )
        .eq("status", "approved")
        .eq("verified", true);
      if (cancelled) return;
      if (!error && data) {
        // Simplified mapping to avoid complex type casting
        const mapped = data.map((row: any) => mapRowToMarketplaceAgent(row));
        setMarketplaceAgents(mapped);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentRecordIdByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of marketplaceAgents) m.set(a.userId, a.id);
    return m;
  }, [marketplaceAgents]);

  const applyFilters = useCallback(
    () => setFilterApplied({ ...filterDraft }),
    [filterDraft],
  );
  const resetFilters = useCallback(() => {
    const cleared = {
      searchQuery: "",
      priceRange: [0, 350_000_000] as [number, number],
      bedsFilter: null as number | null,
      bathsFilter: null as number | null,
      propertyType: null as string | null,
    };
    setFilterDraft(cleared);
    setFilterApplied(cleared);
  }, []);

  const openScheduleForProfile = useCallback(
    (profileId: string) => {
      const agentId = agentRecordIdByUserId.get(profileId);
      const ag = marketplaceAgents.find((a) => a.id === agentId);
      if (ag) {
        setScheduleAgent(ag);
        setShowScheduleModal(true);
      }
    },
    [agentRecordIdByUserId, marketplaceAgents],
  );

  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "price_asc", label: "Price (Low to High)" },
    { value: "price_desc", label: "Price (High to Low)" },
    { value: "newest", label: "Newest" },
    { value: "beds_desc", label: "Most Beds" },
  ];

  const searchFiltered = useMemo(
    () => filterProperties(properties, filterApplied),
    [properties, filterApplied],
  );
  const draftSearchFiltered = useMemo(
    () => filterProperties(properties, filterDraft),
    [properties, filterDraft],
  );
  const sortedFiltered = useMemo(
    () => sortProperties(searchFiltered, sortMode),
    [searchFiltered, sortMode],
  );

  const heroProperty = useMemo(() => {
    if (!sortedFiltered.length) return null;
    if (heroPropertyId) {
      const found = sortedFiltered.find((p) => p.id === heroPropertyId);
      if (found) return found;
    }
    return sortedFiltered[0];
  }, [sortedFiltered, heroPropertyId]);

  const heroRoomGallery = useMemo(
    () => (heroProperty ? buildRoomGallery(heroProperty) : []),
    [heroProperty],
  );

  // Reset room index when property changes
  useEffect(() => {
    setActiveRoomIndex(0);
  }, [heroProperty?.id]);

  const heroAgent = useMemo(() => {
    if (!heroProperty?.listed_by) return null;
    return (
      marketplaceAgents.find((a) => a.userId === heroProperty.listed_by) ?? null
    );
  }, [heroProperty, marketplaceAgents]);

  const displayAgent = useMemo(() => {
    const byScore = [...marketplaceAgents].sort((a, b) => b.score - a.score);
    if (!marketplaceAgents.length) return null;
    if (homeAgentTab === "top") return byScore[0] ?? null;
    if (homeAgentTab === "mc")
      return (
        byScore.find((a) => a.company.toLowerCase().includes("mc")) ??
        byScore[0] ??
        null
      );
    if (homeAgentTab === "shared") return heroAgent ?? byScore[0] ?? null;
    if (homeAgentTab === "ut")
      return (
        byScore.find((a) => a.company.toLowerCase().includes("ut")) ??
        byScore[0] ??
        null
      );
    return heroAgent ?? byScore[0] ?? null;
  }, [homeAgentTab, marketplaceAgents, heroAgent]);

  const connectedForDisplay = useMemo(() => {
    if (!displayAgent?.brokerId) return [];
    return marketplaceAgents.filter(
      (a) => a.brokerId === displayAgent.brokerId && a.id !== displayAgent.id,
    );
  }, [displayAgent, marketplaceAgents]);

  useEffect(() => {
    if (heroPropertyId && !sortedFiltered.some((p) => p.id === heroPropertyId))
      setHeroPropertyId(null);
  }, [sortedFiltered, heroPropertyId]);

  useEffect(() => {
    if (heroSaved && !savedPrevRef.current) setKeyBurstShow(true);
    savedPrevRef.current = heroSaved;
  }, [heroSaved]);

  const heroCarouselIndex = useMemo(
    () =>
      heroProperty
        ? sortedFiltered.findIndex((p) => p.id === heroProperty.id)
        : -1,
    [heroProperty, sortedFiltered],
  );

  // Carousel scroll effect
  useEffect(() => {
    if (!propertyCarouselRef.current || !heroProperty) return;
    const idx = sortedFiltered.findIndex((p) => p.id === heroProperty.id);
    if (idx < 0) return;
    const el = propertyCarouselRef.current;
    const card = el.children[idx] as HTMLElement | undefined;
    card?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [heroProperty?.id, sortedFiltered]);

  const detailGallery = useMemo(
    () => (detailProperty ? buildRoomGallery(detailProperty) : []),
    [detailProperty],
  );
  const detailSimilar = useMemo(
    () =>
      detailProperty
        ? sortedFiltered.filter((p) => p.id !== detailProperty.id).slice(0, 8)
        : [],
    [detailProperty, sortedFiltered],
  );
  const toDetail = (p: Property): DetailProperty => ({
    id: p.id,
    created_at: p.created_at,
    location: p.location,
    price: p.price,
    sqft: p.sqft,
    beds: p.beds,
    baths: p.baths,
    image_url: p.image_url,
    listed_by: p.listed_by,
    property_type: p.property_type,
    lat: p.lat,
    lng: p.lng,
    listing_agent: p.listing_agent,
  });
  const handleBottomTab = (t: Exclude<BottomTab, "profile">) => setBottomTab(t);

  const homeAgentTabs: { id: HomeAgentTab; label: string }[] = [
    { id: "top", label: "Top Agents" },
    { id: "mc", label: "MC Agents" },
    { id: "shared", label: "Shared Agents" },
    { id: "ut", label: "UT Agents" },
    { id: "props", label: `${sortedFiltered.length} Properties` },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-24">
      <WelcomeOverlay />
      <KeyFavoriteBurst
        show={keyBurstShow}
        onDone={() => setKeyBurstShow(false)}
      />

      <div className="mx-auto max-w-6xl bg-[#FAF8F4] min-h-screen shadow-xl shadow-black/5">
        <MaddenTopNav />

        {bottomTab === "map" && (
          <div className="px-4 pt-2">
            <PropertiesMap
              properties={sortedFiltered.map((p) => ({
                id: p.id,
                location: p.location,
                price: p.price,
                lat: p.lat,
                lng: p.lng,
              }))}
              onSelectProperty={(id) => {
                setHeroPropertyId(id);
                setBottomTab("home");
              }}
            />
          </div>
        )}

        {bottomTab === "brokers" && <BrokersDirectory />}

        {bottomTab === "search" && (
          <SearchTabPanel
            filterDraft={filterDraft}
            setFilterDraft={setFilterDraft}
            resetFilters={resetFilters}
            sortMode={sortMode}
            setSortMode={setSortMode}
            sortOptions={sortOptions}
            draftMatchCount={draftSearchFiltered.length}
            onApplyAndGoHome={() => {
              applyFilters();
              setBottomTab("home");
            }}
          />
        )}

        {bottomTab === "home" && (
          <main className="pb-2">
            {/* ── PROPERTY CAROUSEL (TOP) ── */}
            {!propertiesLoading &&
              !propertiesError &&
              sortedFiltered.length > 0 && (
                <section className="px-4 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                      Property Carousel
                    </p>
                    <button
                      type="button"
                      onClick={() => setBottomTab("search")}
                      className="text-xs font-semibold text-[#7C9A7E]"
                    >
                      Filters & sort
                    </button>
                  </div>
                  <div className="relative">
                    {sortedFiltered.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => scrollPropertyCarousel("prev")}
                          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-black/10 bg-white p-1.5 shadow-md"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollPropertyCarousel("next")}
                          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-black/10 bg-white p-1.5 shadow-md"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    <div
                      ref={propertyCarouselRef}
                      className="flex gap-3 overflow-x-auto scroll-smooth pb-2 scrollbar-hide px-1"
                    >
                      {sortedFiltered.map((property) => (
                        <PropertyCarouselCard
                          key={property.id}
                          property={property}
                          isSelected={heroProperty?.id === property.id}
                          onSelect={() => {
                            setHeroPropertyId(property.id);
                            setHeroSaved(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Dots */}
                  <div className="mt-3 flex justify-center gap-1.5">
                    {sortedFiltered.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const p = sortedFiltered[i];
                          if (p) {
                            setHeroPropertyId(p.id);
                            setHeroSaved(false);
                          }
                        }}
                        className={`h-1.5 rounded-full transition-all ${heroCarouselIndex === i ? "w-5 bg-[#7C9A7E]" : "w-1.5 bg-[#2C2C2C]/20"}`}
                      />
                    ))}
                  </div>
                </section>
              )}

            {propertiesLoading && (
              <div className="mx-4 mt-4 h-48 rounded-2xl animate-pulse bg-[#2C2C2C]/8" />
            )}

            {/* ── FEATURED PROPERTY + ROOM CAROUSEL INSIDE HERO ── */}
            {!propertiesLoading && !propertiesError && heroProperty && (
              <section className="mt-6 px-4">
                <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
                  {/* LEFT: Hero image with room carousel inside */}
                  <div
                    className="relative w-full overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] md:flex-1"
                    style={{ minHeight: 320 }}
                  >
                    {/* Main hero image - safe access with fallback */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={
                          heroRoomGallery[activeRoomIndex] ||
                          heroProperty.image_url
                        }
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0"
                      >
                        <Image
                          src={
                            heroRoomGallery[activeRoomIndex] ||
                            heroProperty.image_url
                          }
                          alt={heroProperty.location}
                          fill
                          className="object-cover"
                          sizes="(min-width: 768px) 50vw, 100vw"
                          priority
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* Dark gradient overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Heart save button */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setHeroSaved((s) => !s)}
                      className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-lg backdrop-blur-sm"
                    >
                      <Heart
                        className={`h-5 w-5 transition-all ${heroSaved ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"}`}
                      />
                    </motion.button>

                    {/* ROOM THUMBNAIL STRIP — translucent, inside bottom of hero */}
                    <div className="absolute bottom-0 left-0 right-0 z-10">
                      <div className="bg-black/40 backdrop-blur-md px-3 py-2.5">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                          {heroRoomGallery.map((roomImg, idx) => (
                            <motion.button
                              key={roomImg}
                              type="button"
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setActiveRoomIndex(idx)}
                              className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                                activeRoomIndex === idx
                                  ? "border-[#C9A84C] opacity-100"
                                  : "border-white/20 opacity-60 hover:opacity-90"
                              }`}
                            >
                              <Image
                                src={roomImg}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Property details */}
                  <div className="flex flex-1 flex-col justify-center md:max-w-sm">
                    <span className="inline-flex w-fit rounded-md bg-[#C9A84C]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                      Featured
                    </span>
                    <h2 className="mt-3 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">
                      {heroProperty.location.split(",")[0]?.trim() ||
                        heroProperty.location}
                    </h2>
                    <p className="mt-2 font-serif text-3xl font-bold text-[#2C2C2C]">
                      {heroProperty.price}
                    </p>
                    <div className="mt-3 flex gap-3 text-sm text-[#2C2C2C]/60">
                      <span>{heroProperty.beds} Bed</span>
                      <span>·</span>
                      <span>{heroProperty.baths} Bath</span>
                      <span>·</span>
                      <span>{heroProperty.sqft} sqft</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[#2C2C2C]/60">
                      A curated luxury opportunity in {heroProperty.location}.
                      Click to explore all details, photos, and schedule a
                      private viewing.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDetailProperty(heroProperty)}
                      className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#7C9A7E] transition-colors"
                    >
                      Learn More <span aria-hidden>→</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* ── AGENT TABS & CARDS ── */}
            {!propertiesLoading && !propertiesError && heroProperty && (
              <section className="mt-8 border-t border-[#2C2C2C]/6 px-4 pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                    {heroAgent ? `Listed by` : "Top Agents"}
                  </p>
                  <Link
                    href="/agents"
                    className="text-xs font-semibold text-[#7C9A7E]"
                  >
                    Directory →
                  </Link>
                </div>
                <div className="mb-5 flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                  {homeAgentTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHomeAgentTab(tab.id)}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        homeAgentTab === tab.id
                          ? "bg-[#2C2C2C] text-white"
                          : "bg-white text-[#2C2C2C]/50 border border-[#2C2C2C]/10 hover:text-[#2C2C2C]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {displayAgent ? (
                    <motion.div
                      key={displayAgent.id + homeAgentTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                    >
                      <MaddenAgentRow
                        agent={displayAgent}
                        connected={connectedForDisplay}
                        locationLine={
                          heroAgent && displayAgent.id === heroAgent.id
                            ? heroProperty.location
                            : undefined
                        }
                        onAvailable={() => {
                          setScheduleAgent(displayAgent);
                          setShowScheduleModal(true);
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="no-agent"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-6 text-center"
                    >
                      <FinnMascot mood="still" size={56} className="mx-auto" />
                      <p className="mt-3 text-sm text-[#2C2C2C]/50">
                        No verified agents in the network yet.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}

            {/* ── MORTGAGE CALCULATOR ── */}
            {!propertiesLoading &&
              heroProperty &&
              sortedFiltered.length > 0 && (
                <section className="mt-6 border-t border-[#2C2C2C]/6 px-4 pb-4 pt-6">
                  <MortgageCalculator
                    propertyPrice={parsePriceValue(heroProperty.price)}
                  />
                </section>
              )}

            {/* Empty / error states */}
            {!propertiesLoading &&
              sortedFiltered.length === 0 &&
              !propertiesError &&
              properties.length > 0 && (
                <div className="flex flex-col items-center justify-center px-6 py-12">
                  <FinnMascot mood="sad" size={88} />
                  <p className="mt-4 max-w-xs text-center text-sm text-[#2C2C2C]/50">
                    No homes match your filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => setBottomTab("search")}
                    className="mt-4 rounded-full bg-[#7C9A7E] px-6 py-2 text-sm font-semibold text-white"
                  >
                    Adjust search
                  </button>
                </div>
              )}
          </main>
        )}
      </div>

      <BottomNav active={bottomTab} onTab={handleBottomTab} />

      {showScheduleModal && scheduleAgent && (
        <ScheduleViewingModal
          agent={scheduleAgent}
          onClose={() => {
            setShowScheduleModal(false);
            setScheduleAgent(null);
          }}
        />
      )}
      <PropertyDetailFull
        property={detailProperty ? toDetail(detailProperty) : null}
        open={detailProperty !== null}
        onOpenChange={(open) => {
          if (!open) setDetailProperty(null);
        }}
        galleryImages={detailGallery}
        agentRecordId={
          detailProperty?.listed_by
            ? (agentRecordIdByUserId.get(detailProperty.listed_by) ?? null)
            : null
        }
        onListingAgentAvailable={openScheduleForProfile}
        similar={detailSimilar.map(toDetail)}
        onSelectSimilar={(p) => {
          const full = properties.find((x) => x.id === p.id);
          if (full) setDetailProperty(full);
        }}
      />
    </div>
  );
}

// --- Mortgage Calculator Component (Fixed) ---
function MortgageCalculator({ propertyPrice }: { propertyPrice: number }) {
  const [downPayment, setDownPayment] = useState(20);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [isExpanded, setIsExpanded] = useState(false);

  const safePrice = Math.max(propertyPrice, 1);
  const loanAmount = safePrice * (1 - downPayment / 100);
  const numPayments = loanTerm * 12;

  // Calculate monthly payment safely, handling zero interest rate
  let monthlyPayment = 0;
  if (interestRate === 0) {
    monthlyPayment = loanAmount / numPayments;
  } else {
    const monthlyRate = interestRate / 100 / 12;
    const factor = Math.pow(1 + monthlyRate, numPayments);
    monthlyPayment = (loanAmount * (monthlyRate * factor)) / (factor - 1);
  }

  // Guard against NaN or Infinity
  if (isNaN(monthlyPayment) || !isFinite(monthlyPayment)) {
    monthlyPayment = 0;
  }

  return (
    <motion.div
      layout
      className="rounded-2xl border border-[#2C2C2C]/8 bg-white p-4 shadow-lg"
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#7C9A7E]" />
          <span className="font-serif font-semibold text-[#2C2C2C]">
            Mortgage Calculator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg font-bold text-[#5f7a62]">{`₱${Math.round(monthlyPayment).toLocaleString()}/mo`}</span>
          <ChevronDown
            className={`h-4 w-4 text-[#2C2C2C]/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-4"
        >
          <div>
            <div className="mb-1 flex justify-between">
              <label className="text-xs font-medium text-[#2C2C2C]/50">
                Down payment
              </label>
              <span className="text-xs font-medium">{downPayment}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              value={downPayment}
              onChange={(e) => setDownPayment(parseInt(e.target.value, 10))}
              className="w-full accent-[#7C9A7E]"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between">
              <label className="text-xs font-medium text-[#2C2C2C]/50">
                Interest rate
              </label>
              <span className="text-xs font-medium">{interestRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value))}
              className="w-full accent-[#7C9A7E]"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-[#2C2C2C]/50">
              Loan term
            </label>
            <div className="flex gap-2">
              {[15, 20, 25, 30].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setLoanTerm(term)}
                  className={`flex-1 rounded-xl py-1.5 text-xs font-semibold ${loanTerm === term ? "bg-[#7C9A7E] text-white" : "bg-[#FAF8F4] text-[#2C2C2C]/50"}`}
                >
                  {term} yrs
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// --- Schedule Viewing Modal ---
function ScheduleViewingModal({
  agent,
  onClose,
}: {
  agent: MarketplaceAgent;
  onClose: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const dates = [
    { day: "Today", date: "Mar 29" },
    { day: "Tomorrow", date: "Mar 30" },
    { day: "Sun", date: "Mar 31" },
    { day: "Mon", date: "Apr 1" },
    { day: "Tue", date: "Apr 2" },
  ];
  const times = [
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
  ];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2C2C2C]/45 backdrop-blur-sm">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="w-full max-w-md rounded-t-3xl bg-[#FAF8F4] p-6"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">
            Schedule Viewing
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <Image
            src={agent.image}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <p className="font-medium text-[#2C2C2C]">{agent.name}</p>
            <p className="text-sm text-[#2C2C2C]/50">{agent.company}</p>
          </div>
        </div>
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#7C9A7E]" />
            <span className="text-sm font-medium">Select date</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {dates.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`flex shrink-0 flex-col items-center rounded-xl px-4 py-2 ${selectedDate === d.date ? "bg-[#7C9A7E] text-white" : "bg-white text-[#2C2C2C]/50"}`}
              >
                <span className="text-xs">{d.day}</span>
                <span className="text-sm font-medium">{d.date}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#7C9A7E]" />
            <span className="text-sm font-medium">Select time</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {times.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedTime(time)}
                className={`rounded-lg py-2 text-xs font-medium ${selectedTime === time ? "bg-[#7C9A7E] text-white" : "bg-white text-[#2C2C2C]/50"}`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={!selectedDate || !selectedTime}
          className={`w-full rounded-full py-3 text-base font-semibold ${selectedDate && selectedTime ? "bg-[#2C2C2C] text-white" : "bg-[#2C2C2C]/10 text-[#2C2C2C]/30 cursor-not-allowed"}`}
        >
          {selectedDate && selectedTime ? "Confirm" : "Pick date & time"}
        </button>
      </motion.div>
    </div>
  );
}

// --- Property Carousel Card Component ---
function PropertyCarouselCard({
  property,
  onSelect,
  isSelected,
}: {
  property: Property;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <motion.div
      layout
      whileTap={{ scale: 0.97 }}
      className={`flex w-[200px] shrink-0 overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all sm:w-52 ${isSelected ? "ring-2 ring-[#C9A84C] ring-offset-1" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="relative block aspect-[4/3] w-full overflow-hidden text-left"
      >
        <Image
          src={property.image_url}
          alt=""
          fill
          className="object-cover"
          sizes="200px"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-2.5">
          <p className="line-clamp-1 text-[11px] font-medium text-white/90">
            {property.location}
          </p>
          <p className="mt-0.5 font-serif text-base font-bold text-white">
            {property.price}
          </p>
        </div>
      </button>
    </motion.div>
  );
}
