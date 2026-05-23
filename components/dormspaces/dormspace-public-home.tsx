"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  ChevronDown,
  GraduationCap,
  Heart,
  MapPin,
  Sparkles,
  Wifi,
} from "lucide-react";

import { DormspaceBrowse, type DormspaceBrowseFilters } from "@/components/dormspaces/dormspace-browse";
import { DormspaceCategoryChips } from "@/components/dormspaces/dormspace-category-chips";
import { DormspaceCommunityCta } from "@/components/dormspaces/dormspace-community-cta";
import { DormspacePopularAreasSection } from "@/components/dormspaces/dormspace-popular-areas-section";
import { DormspaceRecommendedSection } from "@/components/dormspaces/dormspace-recommended-section";
import { DormspaceTestimonialsSection } from "@/components/dormspaces/dormspace-testimonials-section";
import { DormspaceWhyStudentsSection } from "@/components/dormspaces/dormspace-why-students";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import {
  DORMSPACE_HERO_IMAGE,
  DORMSPACE_ROOM_TYPE_OPTIONS,
  type DormspaceRoomType,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

const FIELD =
  "rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

const POLAROID_A =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=200&h=240&fit=crop";
const POLAROID_B =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=240&fit=crop";

function parseCityFromLocation(value: string): string {
  const t = value.trim();
  if (!t) return "";
  const parts = t.split(",").map((p) => p.trim());
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : t;
}

export function DormspacePublicHome({ listings }: { listings: DormspaceWithPhotos[] }) {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#listings") return;
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const [locationQuery, setLocationQuery] = useState("");
  const [roomType, setRoomType] = useState<"" | DormspaceRoomType>("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  const [filters, setFilters] = useState<DormspaceBrowseFilters>({
    city: "",
    roomType: "",
    gender: "",
    minPrice: "",
    maxPrice: "",
  });

  const applySearch = () => {
    const city = parseCityFromLocation(locationQuery);
    setActiveChipId(null);
    setFilters({
      city,
      roomType,
      gender: "",
      minPrice,
      maxPrice,
    });
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleChipSelect = (chipId: string | null, next: DormspaceBrowseFilters) => {
    setActiveChipId(chipId);
    setFilters(next);
    if (next.city) setLocationQuery(next.city);
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#2C2C2C]/8 bg-[#FAF8F4]">
        <div className="pointer-events-none absolute -right-24 top-8 size-64 rounded-full bg-[#D4A843]/12 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-16 bottom-0 size-48 rounded-full bg-[#6B9E6E]/10 blur-3xl" aria-hidden />

        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-14">
          <div className="order-2 lg:order-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#D4A843]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#8a6d32]">
              <Sparkles className="size-3.5" aria-hidden />
              Student housing, verified
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.1] tracking-tight text-[#2C2C2C] md:text-[2.65rem]">
              Find your space.
              <br />
              Live your{" "}
              <span className="text-[#C49A2E]">campus life.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-[#484848] md:text-lg">
              Verified dorms and rooms near your school. Safe, affordable, and student-approved across Metro
              Manila.
            </p>

            <div className="mt-6 rounded-2xl border border-[#DDDDDD]/80 bg-white p-4 shadow-[0_8px_32px_rgba(44,44,44,0.07)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                <div className="min-w-0 flex-1">
                  <PhLocationInput
                    value={locationQuery}
                    onChange={setLocationQuery}
                    onSubmitSearch={applySearch}
                    placeholder="Where are you studying?"
                    inputClassName="w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium"
                    aria-label="Location"
                  />
                </div>
                <select
                  className={`${FIELD} min-w-[140px] lg:max-w-[180px]`}
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value as "" | DormspaceRoomType)}
                  aria-label="Room type"
                >
                  <option value="">Any room type</option>
                  {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applySearch}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E] px-8 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] lg:h-auto lg:min-h-[44px]"
                >
                  Search
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowMoreFilters((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#6B9E6E] hover:underline"
              >
                More filters
                <ChevronDown
                  className={`size-3.5 transition ${showMoreFilters ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>

              {showMoreFilters ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                    Min ₱/mo
                    <input
                      className={FIELD}
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                    Max ₱/mo
                    <input
                      className={FIELD}
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ValueChip icon={<GraduationCap className="size-4 text-[#6B9E6E]" />} label="Near universities" />
              <ValueChip icon={<Heart className="size-4 text-[#D4A843]" />} label="Budget friendly" />
              <ValueChip icon={<BadgeCheck className="size-4 text-[#6B9E6E]" />} label="Verified listings" />
              <ValueChip icon={<Sparkles className="size-4 text-[#D4A843]" />} label="Free for everyone" />
            </div>
          </div>

          <div className="relative order-1 min-h-[300px] lg:order-2 lg:min-h-[440px]">
            <div className="relative mx-auto h-[300px] max-w-md overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(44,44,44,0.15)] lg:mx-0 lg:h-[440px] lg:max-w-none">
              <Image
                src={DORMSPACE_HERO_IMAGE}
                alt=""
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e22]/50 via-transparent to-transparent" />

              <div className="absolute left-4 top-4 z-10 max-w-[11rem] rounded-2xl bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#2C2C2C]">
                  <MapPin className="size-3.5 text-[#6B9E6E]" aria-hidden />
                  Near campus
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#888888]">Walking distance to schools</p>
              </div>
              <div className="absolute bottom-20 right-3 z-10 max-w-[10rem] rounded-2xl bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#2C2C2C]">
                  <Wifi className="size-3.5 text-[#6B9E6E]" aria-hidden />
                  Wi-Fi included
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-[#888888]">Study-ready speeds</p>
              </div>
              <div className="absolute bottom-4 left-4 z-10 rounded-2xl bg-[#D4A843]/95 px-3 py-2 shadow-lg">
                <p className="text-[11px] font-bold text-[#2C2C2C]">Move-in ready</p>
                <p className="text-[10px] font-semibold text-[#484848]">Verified landlords</p>
              </div>
            </div>

            <div
              className="absolute -left-2 top-8 z-20 hidden w-[88px] rotate-[-8deg] overflow-hidden rounded-lg border-[3px] border-white bg-white p-1 shadow-xl sm:block lg:-left-6"
              aria-hidden
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm">
                <Image src={POLAROID_A} alt="" fill className="object-cover" sizes="88px" />
              </div>
            </div>
            <div
              className="absolute -right-1 bottom-16 z-20 hidden w-[80px] rotate-[6deg] overflow-hidden rounded-lg border-[3px] border-white bg-white p-1 shadow-xl sm:block lg:-right-4"
              aria-hidden
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm">
                <Image src={POLAROID_B} alt="" fill className="object-cover" sizes="80px" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <DormspaceCategoryChips
        activeChipId={activeChipId}
        filters={filters}
        onSelectChip={handleChipSelect}
      />

      <DormspacePopularAreasSection
        listings={listings}
        activeCity={filters.city}
        onSelectArea={(partial) => {
          setActiveChipId(null);
          setFilters((f) => ({ ...f, ...partial }));
        }}
        onClearArea={() => {
          setActiveChipId(null);
          setFilters({ city: "", roomType: "", gender: "", minPrice: "", maxPrice: "" });
        }}
      />

      <DormspaceRecommendedSection listings={listings} />

      <DormspaceWhyStudentsSection />

      <DormspaceCommunityCta />

      <DormspaceTestimonialsSection />

      <DormspaceBrowse
        listings={listings}
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          setActiveChipId(null);
        }}
        syncLocationToHero={setLocationQuery}
      />

      <DormspacePortalFooter />
    </>
  );
}

function ValueChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/80 px-2 py-3 text-center ring-1 ring-[#2C2C2C]/6">
      {icon}
      <span className="text-[10px] font-bold leading-tight text-[#484848] sm:text-[11px]">{label}</span>
    </div>
  );
}
