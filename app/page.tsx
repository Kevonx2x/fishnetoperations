"use client";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  X,
  Calendar,
  Clock,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { MaddenTopNav } from "../components/marketplace/madden-top-nav";
import {
  parsePriceValue,
  sortProperties,
  matchesPropertyTypeDb,
  type SortMode,
} from "../lib/marketplace-property";
import {
  mapRowToMarketplaceAgent,
  type MarketplaceAgent,
} from "../lib/marketplace-types";
import {
  PropertyDetailFull,
  type DetailProperty,
} from "../components/marketplace/property-detail-full";
import { KeyFavoriteBurst } from "../components/marketplace/mascots/key-mascot";
import { FinnMascot } from "../components/marketplace/mascots/finn-mascot";
import { ConnectedAgentsBox } from "../components/marketplace/connected-agents-box";
import { useSavedPropertyIds } from "../lib/saved-properties";

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
  const extras = ROOM_IMAGES.filter((u) => u !== primary);
  let hash = 0;
  for (let i = 0; i < property.id.length; i++) {
    hash = (hash + property.id.charCodeAt(i) * (i + 1)) % 1024;
  }
  const start = extras.length ? hash % extras.length : 0;
  const rotated = [...extras.slice(start), ...extras.slice(0, start)];
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
    if (applied.bedsFilter !== null && p.beds < applied.bedsFilter) return false;
    if (applied.bathsFilter !== null && p.baths < applied.bathsFilter) return false;
    if (!matchesPropertyTypeDb(p.location, p.property_type, applied.propertyType)) return false;
    return true;
  });
}

export default function FishnetHome() {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleAgent, setScheduleAgent] = useState<MarketplaceAgent | null>(null);
  const [keyBurstShow, setKeyBurstShow] = useState(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);

  const [filterApplied] = useState({
    searchQuery: "",
    priceRange: [0, 350_000_000] as [number, number],
    bedsFilter: null as number | null,
    bathsFilter: null as number | null,
    propertyType: null as string | null,
  });
  const [sortMode] = useState<SortMode>("newest");
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [heroPropertyId, setHeroPropertyId] = useState<string | null>(null);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);
  const [marketplaceAgents, setMarketplaceAgents] = useState<MarketplaceAgent[]>([]);
  const propertyCarouselRef = useRef<HTMLDivElement | null>(null);
  const saved = useSavedPropertyIds();

  const scrollPropertyCarousel = useCallback((direction: "prev" | "next") => {
    const el = propertyCarouselRef.current;
    if (!el) return;
    const step = Math.max(200, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction === "next" ? step : -step, behavior: "smooth" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPropertiesLoading(true);
      setPropertiesError(null);
      const { data, error } = await supabase
        .from("properties")
        .select(`id, created_at, location, price, sqft, beds, baths, image_url, listed_by, property_type, lat, lng, listing_agent:profiles!listed_by (id, full_name, avatar_url)`)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        setPropertiesError(error.message);
        setProperties([]);
      } else {
        const rows = (data ?? []).map((raw: Record<string, unknown>) => ({
          ...(raw as unknown as Property),
          listing_agent: (raw.listing_agent as ListingAgentProfile) ?? null,
          listed_by: (raw.listed_by as string | null) ?? null,
          property_type: (raw.property_type as string | null) ?? null,
          lat: (raw.lat as number | null) ?? null,
          lng: (raw.lng as number | null) ?? null,
        } as Property));
        setProperties(rows);
      }
      setPropertiesLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("agents")
        .select(`id, user_id, name, image_url, score, closings, response_time, availability, brokers (id, company_name, logo_url)`)
        .eq("status", "approved")
        .eq("verified", true);
      if (cancelled) return;
      if (!error) {
        setMarketplaceAgents((data ?? []).map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0])));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const agentRecordIdByUserId = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of marketplaceAgents) m.set(a.userId, a.id);
    return m;
  }, [marketplaceAgents]);

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

  const sortedFiltered = useMemo(() => {
    // Keep the page layout simple like the screenshot: always show results, newest first.
    const searchFiltered = filterProperties(properties, filterApplied);
    return sortProperties(searchFiltered, sortMode);
  }, [properties, filterApplied, sortMode]);

  const heroProperty = useMemo(() => {
    if (!sortedFiltered.length) return null;
    if (heroPropertyId) {
      const found = sortedFiltered.find((p) => p.id === heroPropertyId);
      if (found) return found;
    }
    return sortedFiltered[0];
  }, [sortedFiltered, heroPropertyId]);

  const heroRoomGallery = useMemo(() => heroProperty ? buildRoomGallery(heroProperty) : [], [heroProperty]);
  const heroIsSaved = heroProperty ? saved.has(heroProperty.id) : false;

  useEffect(() => {
    // Reset room index when the featured property changes (queued to satisfy lint rule)
    queueMicrotask(() => setActiveRoomIndex(0));
  }, [heroProperty?.id]);

  const heroAgent = useMemo(() => {
    if (!heroProperty?.listed_by) return null;
    return marketplaceAgents.find((a) => a.userId === heroProperty.listed_by) ?? null;
  }, [heroProperty, marketplaceAgents]);

  const agentsByScore = useMemo(
    () => [...marketplaceAgents].sort((a, b) => b.score - a.score),
    [marketplaceAgents],
  );

  const connectedAgentsForHero = (() => {
    if (heroAgent?.brokerId) {
      const sameBroker = agentsByScore.filter((a) => a.brokerId === heroAgent.brokerId);
      if (sameBroker.length) return sameBroker;
    }
    return agentsByScore;
  })();

  useEffect(() => {
    const heroId = heroProperty?.id ?? null;
    if (!propertyCarouselRef.current || !heroId) return;
    const idx = sortedFiltered.findIndex((p) => p.id === heroId);
    if (idx < 0) return;
    const el = propertyCarouselRef.current;
    const card = el.children[idx] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [heroProperty?.id, sortedFiltered]);

  const detailGallery = useMemo(() => detailProperty ? buildRoomGallery(detailProperty) : [], [detailProperty]);
  const detailSimilar = useMemo(() => detailProperty ? sortedFiltered.filter((p) => p.id !== detailProperty.id).slice(0, 8) : [], [detailProperty, sortedFiltered]);
  const toDetail = (p: Property): DetailProperty => ({ id: p.id, created_at: p.created_at, location: p.location, price: p.price, sqft: p.sqft, beds: p.beds, baths: p.baths, image_url: p.image_url, listed_by: p.listed_by, property_type: p.property_type, lat: p.lat, lng: p.lng, listing_agent: p.listing_agent });

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <KeyFavoriteBurst show={keyBurstShow} onDone={() => setKeyBurstShow(false)} />

      <div className="mx-auto max-w-6xl bg-[#FAF8F4] min-h-screen">
        <MaddenTopNav />

        <main className="pb-10">
          {/* PROPERTY CAROUSEL STRIP */}
          {!propertiesLoading && !propertiesError && sortedFiltered.length > 0 && (
            <section className="px-4 pt-4">
              <p className="mb-3 text-sm font-semibold text-[#2C2C2C]">Property Carousel</p>
              <div className="relative">
                {sortedFiltered.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => scrollPropertyCarousel("prev")}
                      className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollPropertyCarousel("next")}
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}

                <div ref={propertyCarouselRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-hide">
                  {sortedFiltered.map((p) => (
                    <PropertyCarouselCard
                      key={p.id}
                      property={p}
                      isSelected={heroProperty?.id === p.id}
                      isSaved={saved.has(p.id)}
                      onToggleSaved={() => {
                        const next = !saved.has(p.id);
                        saved.toggle(p.id);
                        if (next) setKeyBurstShow(true);
                      }}
                      onSelect={() => {
                        setHeroPropertyId(p.id);
                        setActiveRoomIndex(0);
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="px-4 pt-4">
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-[#F6F1E7] p-3 shadow-sm">
              {propertiesLoading && (
                <div className="h-56 rounded-2xl animate-pulse bg-[#2C2C2C]/8" />
              )}

              {!propertiesLoading && !propertiesError && heroProperty && (
                <>
                  {/* FEATURED HERO IMAGE (full width, arrows inside, corner thumbnails, dots) */}
                  <div className="relative overflow-hidden rounded-2xl bg-white">
                    <div className="relative aspect-[21/9] w-full bg-black/5">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={heroRoomGallery[activeRoomIndex]}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35 }}
                          className="absolute inset-0"
                        >
                          <Image
                            src={heroRoomGallery[activeRoomIndex] ?? heroProperty.image_url}
                            alt={heroProperty.location}
                            fill
                            className="object-cover"
                            sizes="(min-width: 1024px) 1100px, 100vw"
                            priority
                          />
                        </motion.div>
                      </AnimatePresence>

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />

                      {heroRoomGallery.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveRoomIndex((i) => (i - 1 + heroRoomGallery.length) % heroRoomGallery.length)}
                            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
                            aria-label="Previous"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveRoomIndex((i) => (i + 1) % heroRoomGallery.length)}
                            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
                            aria-label="Next"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const next = !saved.has(heroProperty.id);
                          saved.toggle(heroProperty.id);
                          if (next) setKeyBurstShow(true);
                        }}
                        className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-lg"
                        aria-label="Save"
                      >
                        <Heart className={`h-5 w-5 ${heroIsSaved ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"}`} />
                      </motion.button>

                      {/* Corner thumbnails */}
                      {heroRoomGallery.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveRoomIndex((i) => (i - 1 + heroRoomGallery.length) % heroRoomGallery.length)}
                            className="absolute bottom-3 left-3 z-10 overflow-hidden rounded-md border border-white/60 bg-white/20 shadow-sm"
                            aria-label="Previous thumbnail"
                          >
                            <div className="relative h-12 w-20">
                              <Image
                                src={heroRoomGallery[(activeRoomIndex - 1 + heroRoomGallery.length) % heroRoomGallery.length] ?? heroProperty.image_url}
                                alt=""
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveRoomIndex((i) => (i + 1) % heroRoomGallery.length)}
                            className="absolute bottom-3 right-3 z-10 overflow-hidden rounded-md border border-white/60 bg-white/20 shadow-sm"
                            aria-label="Next thumbnail"
                          >
                            <div className="relative h-12 w-20">
                              <Image
                                src={heroRoomGallery[(activeRoomIndex + 1) % heroRoomGallery.length] ?? heroProperty.image_url}
                                alt=""
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            </div>
                          </button>
                        </>
                      )}

                      {/* Dots */}
                      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                        {heroRoomGallery.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveRoomIndex(i)}
                            className={`h-1.5 rounded-full ${i === activeRoomIndex ? "w-5 bg-white" : "w-1.5 bg-white/45"}`}
                            aria-label={`Image ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* FEATURED DETAILS (below image, like screenshot) */}
                  <div className="px-2 pb-2 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">
                      Featured
                    </p>
                    <h2 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
                      {heroProperty.location.split(",")[0]?.trim() || heroProperty.location}
                    </h2>
                    <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">
                      {heroProperty.price}
                    </p>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#2C2C2C]/65">
                      The large property property as scale of down and Makati Real property rewriters to collide sent and an conformomiblile.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDetailProperty(heroProperty)}
                      className="mt-3 text-sm font-medium text-[#2C2C2C]/70 underline decoration-[#C9A84C]/60 underline-offset-4 hover:text-[#2C2C2C]"
                    >
                      Learn More →
                    </button>
                  </div>

                  {/* CONNECTED AGENTS (replaces tabs) */}
                  <div className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
                    <ConnectedAgentsBox
                      title="Connected Agents"
                      agents={connectedAgentsForHero}
                      defaultVisible={3}
                    />
                  </div>

          {/* ── LEAD CAPTURE FORM (BOTTOM) ── */}
          {!propertiesLoading && heroProperty && (
            <div className="mt-8 px-2 pb-2">
              <p className="text-sm font-semibold text-[#2C2C2C]">Lead Capture Form</p>
              <div className="mt-3">
                <LeadCaptureForm property={heroProperty} agentProfileId={heroProperty.listed_by} />
              </div>
            </div>
          )}

          {/* Empty / error states */}
          {!propertiesLoading && sortedFiltered.length === 0 && !propertiesError && properties.length > 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-12">
              <FinnMascot mood="sad" size={88} />
              <p className="mt-4 max-w-xs text-center text-sm text-[#2C2C2C]/50">No homes match your filters.</p>
            </div>
          )}
                </>
              )}
            </div>
          </section>
        </main>
      </div>

      {showScheduleModal && scheduleAgent && (
        <ScheduleViewingModal agent={scheduleAgent} onClose={() => { setShowScheduleModal(false); setScheduleAgent(null); }} />
      )}

      <PropertyDetailFull
        property={detailProperty ? toDetail(detailProperty) : null}
        open={detailProperty !== null}
        onOpenChange={(open) => { if (!open) setDetailProperty(null); }}
        galleryImages={detailGallery}
        agentRecordId={detailProperty?.listed_by ? agentRecordIdByUserId.get(detailProperty.listed_by) ?? null : null}
        onListingAgentAvailable={openScheduleForProfile}
        similar={detailSimilar.map(toDetail)}
        onSelectSimilar={(p) => { const full = properties.find((x) => x.id === p.id); if (full) setDetailProperty(full); }}
      />
    </div>
  );
}

function ScheduleViewingModal({ agent, onClose }: { agent: MarketplaceAgent; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const dates = [{ day: "Today", date: "Mar 29" }, { day: "Tomorrow", date: "Mar 30" }, { day: "Sun", date: "Mar 31" }, { day: "Mon", date: "Apr 1" }, { day: "Tue", date: "Apr 2" }];
  const times = ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2C2C2C]/45 backdrop-blur-sm">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 28, stiffness: 320 }} className="w-full max-w-md rounded-t-3xl bg-[#FAF8F4] p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">Schedule Viewing</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <Image src={agent.image} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
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
              <button key={d.date} type="button" onClick={() => setSelectedDate(d.date)}
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
              <button key={time} type="button" onClick={() => setSelectedTime(time)}
                className={`rounded-lg py-2 text-xs font-medium ${selectedTime === time ? "bg-[#7C9A7E] text-white" : "bg-white text-[#2C2C2C]/50"}`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={onClose} disabled={!selectedDate || !selectedTime}
          className={`w-full rounded-full py-3 text-base font-semibold ${selectedDate && selectedTime ? "bg-[#2C2C2C] text-white" : "bg-[#2C2C2C]/10 text-[#2C2C2C]/30 cursor-not-allowed"}`}
        >
          {selectedDate && selectedTime ? "Confirm" : "Pick date & time"}
        </button>
      </motion.div>
    </div>
  );
}

function PropertyCarouselCard({
  property,
  onSelect,
  isSelected,
  isSaved,
  onToggleSaved,
}: {
  property: Property;
  onSelect: () => void;
  isSelected: boolean;
  isSaved: boolean;
  onToggleSaved: () => void;
}) {
  return (
    <motion.div layout whileTap={{ scale: 0.97 }}
      className={`flex w-[200px] shrink-0 overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all sm:w-52 ${isSelected ? "ring-2 ring-[#C9A84C] ring-offset-1" : ""}`}
    >
      <button type="button" onClick={onSelect} className="relative block aspect-[4/3] w-full overflow-hidden text-left">
        <Image src={property.image_url} alt="" fill className="object-cover" sizes="200px" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSaved();
          }}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 shadow-sm"
          aria-label={isSaved ? "Unsave" : "Save"}
        >
          <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"}`} />
        </button>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-2.5">
          <p className="line-clamp-1 text-[11px] font-medium text-white/90">{property.location}</p>
          <p className="mt-0.5 font-serif text-base font-bold text-white">{property.price}</p>
        </div>
      </button>
    </motion.div>
  );
}

function LeadCaptureForm({
  property,
  agentProfileId,
}: {
  property: Property;
  agentProfileId: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setOk(null);
    setErr(null);
    if (!name.trim() || !email.trim()) {
      setErr("Please enter your name and email.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() ? phone.trim() : null,
        property_interest: `${property.location} (${property.id})`,
        message: message.trim() ? message.trim() : null,
        source: "homepage",
        stage: "new",
        agent_id: agentProfileId,
        broker_id: null,
        client_id: null,
      });
      if (error) throw error;
      setOk("Thanks! We’ll reach out shortly.");
      setMessage("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
        />
        <div className="rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C]/65">
          Interest: <span className="font-semibold text-[#2C2C2C]">{property.location}</span>
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message (optional)"
        rows={4}
        className="mt-3 w-full resize-none rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
      />

      {err ? (
        <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700">
          {err}
        </div>
      ) : null}
      {ok ? (
        <div className="mt-3 rounded-xl bg-[#7C9A7E]/12 px-3 py-2 text-xs font-semibold text-[#2C2C2C]/70">
          {ok}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className={`mt-3 w-full rounded-full px-5 py-3 text-sm font-semibold shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35 ${
          busy
            ? "cursor-not-allowed bg-[#2C2C2C]/10 text-[#2C2C2C]/40"
            : "bg-[#2C2C2C] text-white hover:bg-[#7C9A7E] transition-colors"
        }`}
      >
        {busy ? "Sending…" : "Submit"}
      </button>
    </div>
  );
}
