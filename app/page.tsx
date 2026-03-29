"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Heart,
  X,
  Calendar,
  Clock,
  Calculator,
} from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Agent {
  id: number;
  name: string;
  company: string;
  companyLogo?: string;
  score: number;
  closings: number;
  responseTime: number;
  expertise?: number;
  negotiation?: number;
  availability: string;
  availabilityType: "now" | "today" | "tomorrow";
  image: string;
}

interface Property {
  id: string;
  created_at: string;
  location: string;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
}

const agents: Agent[] = [
  {
    id: 1,
    name: "Sarah Reyes",
    company: "RE/MAX",
    score: 95,
    closings: 360,
    responseTime: 97,
    expertise: 91,
    availability: "Available Now",
    availabilityType: "now",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
  },
  {
    id: 2,
    name: "James Santos",
    company: "Ayala Land Premier",
    companyLogo: "DAMAX",
    score: 92,
    closings: 340,
    responseTime: 91,
    availability: "Today 5:00 PM",
    availabilityType: "today",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
  },
  {
    id: 3,
    name: "Mia Tan",
    company: "Filinvest",
    score: 89,
    closings: 335,
    responseTime: 87,
    negotiation: 89,
    availability: "Tomorrow",
    availabilityType: "tomorrow",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
  },
];

/** Extra luxury listing photos for hero gallery (primary URL always comes from Supabase). */
const HERO_IMAGE_ALTS = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
];

function unsplashPhotoKey(url: string): string {
  const m = url.match(/photo-([^?/]+)/i);
  return (m?.[1] ?? url).toLowerCase();
}

function buildHeroImageGallery(property: Property): string[] {
  const primary = property.image_url;
  const pk = unsplashPhotoKey(primary);
  const extras = HERO_IMAGE_ALTS.filter((u) => unsplashPhotoKey(u) !== pk);

  let hash = 0;
  for (let i = 0; i < property.id.length; i++) {
    hash = (hash + property.id.charCodeAt(i) * (i + 1)) % 1024;
  }
  const start = extras.length ? hash % extras.length : 0;
  const rotated = extras.length
    ? [...extras.slice(start), ...extras.slice(0, start)]
    : [];
  const gallery = [primary, ...rotated.slice(0, 3)];
  return [...new Set(gallery)];
}

function parsePriceValue(price: string): number {
  const t = price.replace(/₱|\s/g, "").toUpperCase();
  if (t.includes("M")) {
    const num = parseFloat(t.replace(/[^0-9.]/g, ""));
    return (Number.isFinite(num) ? num : 0) * 1_000_000;
  }
  const digits = parseInt(t.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(digits) ? digits : 0;
}

function LeadForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    property_interest: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: supabaseError } = await supabase
      .from("leads")
      .insert([{ ...form, status: "new" }]);

    if (supabaseError) {
      setError(
        supabaseError.message ||
          "An error occurred while submitting your request.",
      );
    } else {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          notifyEmail: "ron.business101@gmail.com",
        }),
      });
      setSuccess(true);
      setForm({
        name: "",
        email: "",
        phone: "",
        property_interest: "",
        message: "",
      });
    }

    setLoading(false);
  };

  return (
    <section className="px-4 pt-8 pb-8">
      <h2 className="text-lg font-bold text-foreground mb-1">
        Request a Viewing
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        An agent will contact you within 24 hours.
      </p>

      {success && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          ✅ Request sent! An agent will contact you shortly.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          required
          placeholder="Full Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <input
          required
          type="email"
          placeholder="Email Address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <input
          placeholder="Phone Number"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <input
          placeholder="Property Interest (e.g. Forbes Park)"
          value={form.property_interest}
          onChange={(e) =>
            setForm({ ...form, property_interest: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <textarea
          placeholder="Message (optional)"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage resize-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-sage py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Request Viewing"}
        </button>
      </form>
    </section>
  );
}

export default function MaddenRealEstate() {
  const [activeTab, setActiveTab] = useState<"properties" | "agents">(
    "properties",
  );
  const [agentFilter, setAgentFilter] = useState<
    "top" | "viewing" | "recommended"
  >("top");
  const [showFilters, setShowFilters] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [heroSaved, setHeroSaved] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState([0, 350_000_000]);
  const [bedsFilter, setBedsFilter] = useState<number | null>(null);
  const [bathsFilter, setBathsFilter] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [heroPropertyId, setHeroPropertyId] = useState<string | null>(null);
  const [detailProperty, setDetailProperty] = useState<Property | null>(null);

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  const propertyCarouselRef = useRef<HTMLDivElement | null>(null);
  const agentsCarouselRef = useRef<HTMLDivElement | null>(null);

  const scrollPropertyCarousel = useCallback((direction: "prev" | "next") => {
    const el = propertyCarouselRef.current;
    if (!el) return;
    const step = Math.max(200, Math.round(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === "next" ? step : -step,
      behavior: "smooth",
    });
  }, []);

  const scrollAgentsRow = useCallback((direction: "prev" | "next") => {
    const el = agentsCarouselRef.current;
    if (!el) return;
    const step = Math.max(160, Math.round(el.clientWidth * 0.6));
    el.scrollBy({
      left: direction === "next" ? step : -step,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPropertiesLoading(true);
      setPropertiesError(null);
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, created_at, location, price, sqft, beds, baths, image_url",
        )
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        setPropertiesError(error.message);
        setProperties([]);
      } else {
        setProperties((data as Property[]) ?? []);
      }
      setPropertiesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const matchesPropertyType = (location: string, type: string | null) => {
    if (!type) return true;
    const l = location.toLowerCase();
    switch (type) {
      case "House":
        return true;
      case "Condo":
        return l.includes("condo") || l.includes("tower") || l.includes("rockwell");
      case "Villa":
        return l.includes("villa") || l.includes("village") || l.includes("hills");
      case "Townhouse":
        return l.includes("townhouse") || l.includes("town");
      default:
        return true;
    }
  };

  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return properties.filter((p) => {
      if (q && !p.location.toLowerCase().includes(q)) return false;
      const pv = parsePriceValue(p.price);
      if (pv < priceRange[0] || pv > priceRange[1]) return false;
      if (bedsFilter !== null && p.beds < bedsFilter) return false;
      if (bathsFilter !== null && p.baths < bathsFilter) return false;
      if (!matchesPropertyType(p.location, propertyType)) return false;
      return true;
    });
  }, [
    properties,
    searchQuery,
    priceRange,
    bedsFilter,
    bathsFilter,
    propertyType,
  ]);

  const heroProperty = useMemo(() => {
    if (!searchFiltered.length) return null;
    if (heroPropertyId) {
      const found = searchFiltered.find((p) => p.id === heroPropertyId);
      if (found) return found;
    }
    return searchFiltered[0];
  }, [searchFiltered, heroPropertyId]);

  useEffect(() => {
    if (
      heroPropertyId &&
      !searchFiltered.some((p) => p.id === heroPropertyId)
    ) {
      setHeroPropertyId(null);
    }
  }, [searchFiltered, heroPropertyId]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [heroProperty?.id]);

  const filteredAgents = useMemo(() => {
    const base = [...agents];
    if (agentFilter === "top") {
      return base.sort((a, b) => b.score - a.score);
    }
    if (agentFilter === "viewing") {
      return base.filter(
        (a) =>
          a.availabilityType === "now" || a.availabilityType === "today",
      );
    }
    return base.sort((a, b) => b.closings - a.closings);
  }, [agentFilter]);

  const displayAgent = useMemo(() => {
    if (!filteredAgents.length) return null;
    if (selectedAgentId != null) {
      const found = filteredAgents.find((a) => a.id === selectedAgentId);
      if (found) return found;
    }
    return filteredAgents[0];
  }, [filteredAgents, selectedAgentId]);

  useEffect(() => {
    if (
      selectedAgentId != null &&
      !filteredAgents.some((a) => a.id === selectedAgentId)
    ) {
      setSelectedAgentId(null);
    }
  }, [filteredAgents, selectedAgentId]);

  useEffect(() => {
    setSelectedAgentId(null);
  }, [agentFilter]);

  const propertyImages = useMemo(
    () => (heroProperty ? buildHeroImageGallery(heroProperty) : []),
    [heroProperty],
  );

  const showListingCarouselNav =
    !propertiesLoading &&
    !propertiesError &&
    searchFiltered.length > 1;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-md bg-cream pb-8">
        <header className="px-4 pt-4">
          <nav className="flex items-center gap-4 rounded-full bg-card/80 backdrop-blur-sm px-4 py-3 shadow-sm border border-border/50">
            <button
              type="button"
              onClick={() => setActiveTab("properties")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "properties"
                  ? "bg-sage/20 text-sage-dark"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`rounded-lg p-1.5 ${activeTab === "properties" ? "bg-sage/30" : "bg-muted"}`}
              >
                <Home className="h-4 w-4" />
              </div>
              Properties
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                  activeTab === "properties"
                    ? "bg-sage text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {propertiesLoading ? "–" : properties.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("agents")}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-all ${
                activeTab === "agents"
                  ? "bg-sage/20 text-sage-dark"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Agents
            </button>
          </nav>
        </header>

        {activeTab === "properties" && (
          <>
            <section className="px-4 pt-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search location, property type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-full bg-card border border-border/50 py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sage/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`rounded-full p-2.5 border transition-all ${
                    showFilters
                      ? "bg-sage text-primary-foreground border-sage"
                      : "bg-card border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
              </div>

              {showFilters && (
                <div className="mt-3 rounded-2xl bg-card border border-border/50 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">Filters</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setPriceRange([0, 350_000_000]);
                        setBedsFilter(null);
                        setBathsFilter(null);
                        setPropertyType(null);
                      }}
                      className="text-xs text-sage hover:text-sage-dark"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Price Range (max)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground">
                        ₱{(priceRange[0] / 1_000_000).toFixed(0)}M
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="350000000"
                        step="5000000"
                        value={priceRange[1]}
                        onChange={(e) =>
                          setPriceRange([priceRange[0], parseInt(e.target.value, 10)])
                        }
                        className="flex-1 accent-sage"
                      />
                      <span className="text-xs text-foreground">
                        ₱{(priceRange[1] / 1_000_000).toFixed(0)}M
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Bedrooms
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[3, 4, 5, 6, 7].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() =>
                            setBedsFilter(bedsFilter === num ? null : num)
                          }
                          className={`flex-1 min-w-[2.5rem] py-1.5 rounded-lg text-xs font-medium transition-all ${
                            bedsFilter === num
                              ? "bg-sage text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-sage/20"
                          }`}
                        >
                          {num}+
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Bathrooms
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[3, 4, 5, 6, 7, 8].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() =>
                            setBathsFilter(bathsFilter === num ? null : num)
                          }
                          className={`flex-1 min-w-[2.5rem] py-1.5 rounded-lg text-xs font-medium transition-all ${
                            bathsFilter === num
                              ? "bg-sage text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-sage/20"
                          }`}
                        >
                          {num}+
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Property Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["House", "Condo", "Villa", "Townhouse"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setPropertyType(propertyType === type ? null : type)
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            propertyType === type
                              ? "bg-sage text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-sage/20"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="px-4 pt-4">
              <div className="relative overflow-hidden rounded-2xl">
                {propertiesLoading ? (
                  <div className="h-72 w-full animate-pulse bg-muted" />
                ) : heroProperty ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDetailProperty(heroProperty)}
                      className="relative block w-full cursor-pointer text-left"
                      aria-label="View property details"
                    >
                      <Image
                        src={propertyImages[currentImageIndex] ?? heroProperty.image_url}
                        alt={heroProperty.location}
                        width={800}
                        height={600}
                        priority
                        className="h-72 w-full object-cover"
                        style={{ width: "100%", height: "auto" }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-sm text-cream/90">
                              {heroProperty.location}
                            </p>
                            <p className="text-2xl font-bold text-cream">
                              {heroProperty.price}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-cream/90">
                            <span>{heroProperty.sqft} SQFT</span>
                            <span className="text-cream/50">|</span>
                            <span>{heroProperty.beds} BED</span>
                            <span className="text-cream/50">|</span>
                            <span>{heroProperty.baths} BATH</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroSaved(!heroSaved)}
                      className="absolute top-4 right-4 rounded-full bg-card/80 backdrop-blur-sm p-2 transition-all hover:bg-card z-10"
                      aria-label="Save listing"
                    >
                      <Heart
                        className={`h-5 w-5 transition-all ${heroSaved ? "fill-red-500 text-red-500" : "text-foreground"}`}
                      />
                    </button>
                    {propertyImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Previous photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex((prev) =>
                              prev === 0 ? propertyImages.length - 1 : prev - 1,
                            );
                          }}
                          className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/50 bg-card/95 p-2 shadow-sm backdrop-blur-sm transition-all hover:bg-card"
                        >
                          <ChevronLeft className="h-4 w-4 text-foreground" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentImageIndex((prev) =>
                              prev === propertyImages.length - 1 ? 0 : prev + 1,
                            );
                          }}
                          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-border/50 bg-card/95 p-2 shadow-sm backdrop-blur-sm transition-all hover:bg-card"
                        >
                          <ChevronRight className="h-4 w-4 text-foreground" />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex h-72 w-full items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground">
                    {propertiesError
                      ? `Could not load properties: ${propertiesError}`
                      : properties.length > 0
                        ? "No listings match your filters."
                        : "No properties listed yet."}
                  </div>
                )}
              </div>

              {propertyImages.length > 1 && (
                <div className="flex gap-1 p-2 bg-card">
                  {propertyImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`flex-1 rounded-lg overflow-hidden transition-all ${
                        currentImageIndex === idx
                          ? "ring-2 ring-sage"
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`Property view ${idx + 1}`}
                        width={100}
                        height={60}
                        className="h-12 w-full object-cover"
                        style={{ width: "100%", height: "auto" }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {heroSaved && heroProperty && (
                <div className="mt-2 flex items-center gap-1 text-xs text-sage-dark">
                  <Heart className="h-3 w-3 fill-current" />
                  <span>Saved to favorites</span>
                </div>
              )}
              {heroProperty && (
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  Use the arrows to browse photos · tap the image for full
                  details · pick a card below to change the featured listing
                </p>
              )}
            </section>

            {filteredAgents.length > 0 && displayAgent && (
              <>
                <section className="px-4 pt-5">
                  <AgentFilterTabs
                    agentFilter={agentFilter}
                    onFilterChange={setAgentFilter}
                  />
                </section>

                <section className="px-4 pt-4">
                  <div
                    ref={agentsCarouselRef}
                    className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide scroll-smooth"
                  >
                    {filteredAgents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`flex flex-shrink-0 items-center gap-2 rounded-xl border p-2 pr-3 transition-all ${
                          displayAgent.id === agent.id
                            ? "border-sage bg-sage/10 ring-2 ring-sage/30"
                            : "border-border/50 bg-card hover:border-sage/40"
                        }`}
                      >
                        <Image
                          src={agent.image}
                          alt={agent.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                        <div className="text-left">
                          <p className="text-xs font-semibold text-foreground max-w-[100px] truncate">
                            {agent.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {agent.company}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="px-4 pt-3">
                  <FeaturedAgentCard
                    variant="compact"
                    agent={displayAgent}
                    onSchedule={() => setShowScheduleModal(true)}
                  />
                </section>

                <section className="px-4 pt-3">
                  <AgentBioCard agent={displayAgent} />
                </section>
              </>
            )}

            {!propertiesLoading && heroProperty && (
              <section className="px-4 pt-4">
                <MortgageCalculator
                  propertyPrice={parsePriceValue(heroProperty.price)}
                />
              </section>
            )}

            <section className="pt-6">
              <div className="px-4 mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  Similar Properties
                </h3>
                <span className="text-xs text-muted-foreground">
                  {searchFiltered.length} match
                  {searchFiltered.length === 1 ? "" : "es"}
                </span>
              </div>
              <div className="relative px-4">
                {showListingCarouselNav && (
                  <>
                    <button
                      type="button"
                      aria-label="Scroll listings left"
                      onClick={() => scrollPropertyCarousel("prev")}
                      className="absolute left-1 top-[52%] z-10 -translate-y-1/2 rounded-full border border-border/60 bg-card/95 p-2 shadow-md backdrop-blur-sm transition hover:bg-card"
                    >
                      <ChevronLeft className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      type="button"
                      aria-label="Scroll listings right"
                      onClick={() => scrollPropertyCarousel("next")}
                      className="absolute right-1 top-[52%] z-10 -translate-y-1/2 rounded-full border border-border/60 bg-card/95 p-2 shadow-md backdrop-blur-sm transition hover:bg-card"
                    >
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    </button>
                  </>
                )}
                <div
                  ref={propertyCarouselRef}
                  className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
                >
                  {propertiesLoading ? (
                    <>
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-28 w-40 flex-shrink-0 animate-pulse rounded-xl bg-muted"
                        />
                      ))}
                    </>
                  ) : propertiesError ? (
                    <p className="text-sm text-muted-foreground py-4">
                      {propertiesError}
                    </p>
                  ) : searchFiltered.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No properties to show.
                    </p>
                  ) : (
                    searchFiltered.map((property) => (
                      <PropertyCarouselCard
                        key={property.id}
                        property={property}
                        isSelected={heroProperty?.id === property.id}
                        onSelect={() => {
                          setHeroPropertyId(property.id);
                          setHeroSaved(false);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 pt-2">
                <button
                  type="button"
                  onClick={() => scrollPropertyCarousel("prev")}
                  disabled={!showListingCarouselNav}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-35 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => scrollPropertyCarousel("next")}
                  disabled={!showListingCarouselNav}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-35 disabled:pointer-events-none"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            <LeadForm />
          </>
        )}

        {activeTab === "agents" && filteredAgents.length === 0 && (
          <p className="px-4 pt-8 text-center text-sm text-muted-foreground">
            No agents match this filter.
          </p>
        )}

        {activeTab === "agents" && filteredAgents.length > 0 && displayAgent && (
          <>
            <section className="px-4 pt-6">
              <AgentFilterTabs
                agentFilter={agentFilter}
                onFilterChange={setAgentFilter}
              />
            </section>

            <section className="px-4 pt-4">
              <div
                ref={agentsCarouselRef}
                className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
              >
                {filteredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`flex flex-shrink-0 items-center gap-2 rounded-xl border p-2 pr-3 transition-all ${
                      displayAgent.id === agent.id
                        ? "border-sage bg-sage/10 ring-2 ring-sage/30"
                        : "border-border/50 bg-card hover:border-sage/40"
                    }`}
                  >
                    <Image
                      src={agent.image}
                      alt={agent.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-xl object-cover"
                    />
                    <div className="text-left min-w-0">
                      <p className="text-xs font-semibold text-foreground max-w-[120px] truncate">
                        {agent.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        Score {agent.score}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="px-4 pt-4">
              <FeaturedAgentCard
                variant="detailed"
                agent={displayAgent}
                onSchedule={() => setShowScheduleModal(true)}
              />
            </section>

            <section className="px-4 pt-4">
              <AgentDetailExtras agent={displayAgent} />
            </section>

            <section className="px-4 pt-4">
              <AgentBioCard agent={displayAgent} />
            </section>
          </>
        )}

        {showScheduleModal && displayAgent && (
          <ScheduleViewingModal
            agent={displayAgent}
            onClose={() => setShowScheduleModal(false)}
          />
        )}

        <PropertyDetailDialog
          property={detailProperty}
          open={detailProperty !== null}
          onOpenChange={(open) => {
            if (!open) setDetailProperty(null);
          }}
        />
      </div>
    </div>
  );
}

function PropertyDetailDialog({
  property,
  open,
  onOpenChange,
}: {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!property) return null;

  const listed = new Date(property.created_at).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{property.location}</DialogTitle>
          <DialogDescription>
            Listed {listed} · {property.price}
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg">
          <Image
            src={property.image_url}
            alt={property.location}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 100vw, 400px"
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Price</dt>
            <dd className="font-semibold text-foreground">{property.price}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Floor area</dt>
            <dd className="font-semibold text-foreground">
              {property.sqft} sq ft
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bedrooms</dt>
            <dd className="font-semibold text-foreground">{property.beds}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bathrooms</dt>
            <dd className="font-semibold text-foreground">{property.baths}</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function MortgageCalculator({ propertyPrice }: { propertyPrice: number }) {
  const [downPayment, setDownPayment] = useState(20);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [isExpanded, setIsExpanded] = useState(false);

  const safePrice = Math.max(propertyPrice, 1);
  const loanAmount = safePrice * (1 - downPayment / 100);
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;
  const monthlyPayment =
    loanAmount *
    ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1));

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-sage" />
          <span className="font-semibold text-foreground">
            Mortgage Calculator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-sage">
            ₱{Math.round(monthlyPayment).toLocaleString()}/mo
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">
                Down Payment
              </label>
              <span className="text-xs font-medium text-foreground">
                {downPayment}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              value={downPayment}
              onChange={(e) => setDownPayment(parseInt(e.target.value, 10))}
              className="w-full accent-sage"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ₱{Math.round((safePrice * downPayment) / 100).toLocaleString()}
            </p>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">
                Interest Rate
              </label>
              <span className="text-xs font-medium text-foreground">
                {interestRate}%
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="12"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value))}
              className="w-full accent-sage"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Loan Term
            </label>
            <div className="flex gap-2">
              {[15, 20, 25, 30].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setLoanTerm(term)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    loanTerm === term
                      ? "bg-sage text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-sage/20"
                  }`}
                >
                  {term} yrs
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Loan Amount</span>
              <span className="font-medium text-foreground">
                ₱{Math.round(loanAmount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Total Interest</span>
              <span className="font-medium text-foreground">
                ₱
                {Math.round(
                  monthlyPayment * numPayments - loanAmount,
                ).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentFilterTabs({
  agentFilter,
  onFilterChange,
}: {
  agentFilter: "top" | "viewing" | "recommended";
  onFilterChange: (v: "top" | "viewing" | "recommended") => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 border-b border-border">
      <button
        type="button"
        onClick={() => onFilterChange("top")}
        className={`relative pb-3 text-sm font-medium transition-all whitespace-nowrap ${
          agentFilter === "top"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Top Agents
        {agentFilter === "top" && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage rounded-full" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onFilterChange("viewing")}
        className={`relative flex items-center gap-0.5 pb-3 text-sm font-medium transition-all whitespace-nowrap ${
          agentFilter === "viewing"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Next Available Viewing
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        {agentFilter === "viewing" && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage rounded-full" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onFilterChange("recommended")}
        className={`relative flex items-center gap-0.5 pb-3 text-sm font-medium transition-all whitespace-nowrap ${
          agentFilter === "recommended"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Recommended agents
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        {agentFilter === "recommended" && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage rounded-full" />
        )}
      </button>
    </div>
  );
}

function FeaturedAgentCard({
  agent,
  onSchedule,
  variant = "compact",
}: {
  agent: Agent;
  onSchedule: () => void;
  variant?: "compact" | "detailed";
}) {
  const cta =
    agent.availabilityType === "now"
      ? "Available Now"
      : agent.availabilityType === "today"
        ? agent.availability
        : "Schedule viewing";

  const luxuryVal = agent.expertise ?? agent.negotiation ?? "—";
  const responseDisplay = String(agent.responseTime);

  if (variant === "compact") {
    return (
      <div className="rounded-2xl bg-card border border-border/50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <Image
              src={agent.image}
              alt={agent.name}
              width={72}
              height={72}
              className="rounded-xl object-cover"
              style={{ width: "72px", height: "72px" }}
            />
            <div className="absolute -top-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-sage text-xs font-bold text-primary-foreground shadow-md ring-2 ring-card">
              {agent.score}
            </div>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-lg font-semibold text-foreground leading-tight">
              {agent.name}
            </h3>
            <div className="mt-3 grid grid-cols-4 gap-1 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Agency
                </p>
                <p className="text-xs font-semibold text-foreground truncate px-0.5">
                  {agent.company.length > 10
                    ? `${agent.company.slice(0, 9)}…`
                    : agent.company}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Closings
                </p>
                <p className="text-xs font-semibold text-foreground">
                  {agent.closings}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Response
                </p>
                <p className="text-xs font-semibold text-foreground">
                  {responseDisplay}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Luxury
                </p>
                <p className="text-xs font-semibold text-foreground">
                  {luxuryVal}
                </p>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onSchedule}
          className="mt-4 w-full rounded-full bg-sage py-3 text-base font-medium text-primary-foreground transition-all hover:bg-sage-dark"
        >
          {cta}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5 shadow-sm space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-shrink-0">
          <Image
            src={agent.image}
            alt={agent.name}
            width={96}
            height={96}
            className="h-24 w-24 rounded-2xl object-cover"
          />
          <div className="absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-sage text-sm font-bold text-primary-foreground shadow-md ring-2 ring-card">
            {agent.score}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            {agent.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{agent.company}</p>
          <p className="mt-2 inline-flex rounded-full bg-sage/15 px-2.5 py-0.5 text-[11px] font-medium text-sage-dark">
            {agent.availability}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Closings</p>
          <p className="font-semibold text-foreground">{agent.closings}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Response score</p>
          <p className="font-semibold text-foreground">{agent.responseTime}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {agent.expertise ? "Expertise" : "Negotiation"}
          </p>
          <p className="font-semibold text-foreground">{luxuryVal}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Availability</p>
          <p className="font-semibold text-foreground capitalize">
            {agent.availabilityType}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSchedule}
        className="w-full rounded-full bg-sage py-3.5 text-base font-medium text-primary-foreground transition-all hover:bg-sage-dark"
      >
        {cta}
      </button>
    </div>
  );
}

function AgentDetailExtras({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Credentials &amp; focus
      </h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Markets: </span>
          NCR, Southern Luzon, Cebu corridors — luxury residential and
          investment-grade assets.
        </li>
        <li>
          <span className="font-medium text-foreground">Languages: </span>
          English, Filipino{agent.name.includes("Tan") ? ", Mandarin" : ""}.
        </li>
        <li>
          <span className="font-medium text-foreground">Approach: </span>
          Off-market introductions, portfolio exits, and high-touch relocation
          support.
        </li>
      </ul>
    </div>
  );
}

function AgentBioCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5 shadow-sm">
      <p className="text-base text-foreground leading-relaxed">
        <span className="font-semibold italic">{agent.name}</span>
        <span className="italic text-muted-foreground">
          {" "}
          is a top-rated luxury real estate agent known for exceptional client
          service and deep market knowledge across Metro Manila and key
          Philippine destinations.
        </span>
      </p>

      {expanded && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Whether you are buying or selling, {agent.name.split(" ")[0]}{" "}
          delivers tailored guidance, strong negotiation, and a calm,
          professional experience from first viewing to closing.
        </p>
      )}

      <div className="mt-4 flex items-center justify-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-sage-dark transition-colors"
        >
          {expanded ? "Show less" : "Read More"}
          {!expanded ? <ChevronRight className="h-4 w-4" /> : null}
        </button>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex justify-center mt-1">
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function ScheduleViewingModal({
  agent,
  onClose,
}: {
  agent: Agent;
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
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-end justify-center">
      <div className="bg-card rounded-t-3xl w-full max-w-md p-6 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Schedule Viewing
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-muted">
          <Image
            src={agent.image}
            alt={agent.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <p className="font-medium text-foreground">{agent.name}</p>
            <p className="text-sm text-muted-foreground">{agent.company}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-sage" />
            <span className="text-sm font-medium text-foreground">
              Select Date
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {dates.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl transition-all ${
                  selectedDate === d.date
                    ? "bg-sage text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-sage/20"
                }`}
              >
                <span className="text-xs">{d.day}</span>
                <span className="text-sm font-medium">{d.date}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-sage" />
            <span className="text-sm font-medium text-foreground">
              Select Time
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {times.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedTime(time)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedTime === time
                    ? "bg-sage text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-sage/20"
                }`}
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
          className={`w-full rounded-full py-3 text-base font-medium transition-all ${
            selectedDate && selectedTime
              ? "bg-sage text-primary-foreground hover:bg-sage-dark"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {selectedDate && selectedTime
            ? `Confirm ${selectedDate} at ${selectedTime}`
            : "Select Date & Time"}
        </button>
      </div>
    </div>
  );
}

function PropertyCarouselCard({
  property,
  onSelect,
  isSelected,
}: {
  property: Property;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const [isSaved, setIsSaved] = useState(false);

  return (
    <div
      className={`flex-shrink-0 w-40 overflow-hidden rounded-xl shadow-sm bg-card ring-offset-cream transition ${
        isSelected ? "ring-2 ring-sage" : ""
      }`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onSelect}
          className="relative block w-full text-left"
        >
          <Image
            src={property.image_url}
            alt={property.location}
            width={160}
            height={120}
            className="h-28 w-full object-cover"
            style={{ width: "100%", height: "auto" }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
          <div className="pointer-events-none absolute bottom-2 left-2 right-2">
            <p className="text-sm font-bold text-cream">{property.price}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setIsSaved(!isSaved)}
          className="absolute top-2 right-2 rounded-full bg-card/80 backdrop-blur-sm p-1 transition-all hover:bg-card z-10"
          aria-label="Save"
        >
          <Heart
            className={`h-3 w-3 transition-all ${isSaved ? "fill-red-500 text-red-500" : "text-foreground"}`}
          />
        </button>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-2 text-left hover:bg-muted/50 transition-colors"
      >
        <p className="text-xs font-medium text-foreground truncate">
          {property.location}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {property.beds} bed · {property.baths} bath
        </p>
      </button>
    </div>
  );
}
