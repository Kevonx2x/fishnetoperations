"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronDown, Heart, MessageCircle, Shield } from "lucide-react";

import { DormspaceBrowse, type DormspaceBrowseFilters } from "@/components/dormspaces/dormspace-browse";
import { DormspaceLandlordCtaBanner } from "@/components/dormspaces/dormspace-landlord-cta-banner";
import { DormspacePopularAreasSection } from "@/components/dormspaces/dormspace-popular-areas-section";
import { DormspaceRecommendedSection } from "@/components/dormspaces/dormspace-recommended-section";
import { DormspaceTestimonialsSection } from "@/components/dormspaces/dormspace-testimonials-section";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import {
  DORMSPACE_HERO_IMAGE,
  DORMSPACE_ROOM_TYPE_OPTIONS,
  type DormspaceRoomType,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

const FIELD =
  "rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

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

  const [filters, setFilters] = useState<DormspaceBrowseFilters>({
    city: "",
    roomType: "",
    gender: "",
    minPrice: "",
    maxPrice: "",
  });

  const applySearch = () => {
    const city = parseCityFromLocation(locationQuery);
    setFilters({
      city,
      roomType,
      gender: "",
      minPrice,
      maxPrice,
    });
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#2C2C2C]/8 bg-[#FAF8F4]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10 lg:py-14">
          <div className="order-2 lg:order-1">
            <h1 className="font-serif text-4xl font-bold tracking-tight text-[#2C2C2C] md:text-5xl">
              Better dorms.
              <br />
              Better days.
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-[#484848] md:text-lg">
              Find safe, verified bedspaces for students, BPO workers, and young professionals across Metro
              Manila.
            </p>

            <div className="mt-6 rounded-2xl border border-[#DDDDDD] bg-white p-3 shadow-[0_4px_20px_rgba(44,44,44,0.06)] sm:p-4">
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
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] lg:h-auto lg:min-h-[44px]"
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

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <TrustInline
                icon={<Shield className="size-5 text-[#6B9E6E]" />}
                title="Verified Listings"
                subtitle="All landlords verified with ID"
              />
              <TrustInline
                icon={<MessageCircle className="size-5 text-[#6B9E6E]" />}
                title="Direct Contact"
                subtitle="Message landlords through our platform"
              />
              <TrustInline
                icon={<Heart className="size-5 text-[#6B9E6E]" />}
                title="Free for Everyone"
                subtitle="No fees ever — landlords or tenants"
              />
            </div>
          </div>

          <div className="relative order-1 min-h-[240px] lg:order-2 lg:min-h-[420px]">
            <div
              className="relative h-full min-h-[240px] overflow-hidden shadow-[8px_0_24px_rgba(44,44,44,0.12)] lg:min-h-[420px]"
              style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0 100%)" }}
            >
              <Image
                src={DORMSPACE_HERO_IMAGE}
                alt=""
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              <div className="absolute inset-y-0 right-0 w-2 bg-[#D4A843]/80" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      <DormspacePopularAreasSection
        listings={listings}
        activeCity={filters.city}
        onSelectArea={(partial) => setFilters((f) => ({ ...f, ...partial }))}
        onClearArea={() =>
          setFilters({ city: "", roomType: "", gender: "", minPrice: "", maxPrice: "" })
        }
      />

      <DormspaceRecommendedSection listings={listings} />

      <DormspaceLandlordCtaBanner />

      <DormspaceTestimonialsSection />

      <DormspaceBrowse
        listings={listings}
        filters={filters}
        onFiltersChange={setFilters}
        syncLocationToHero={setLocationQuery}
      />
    </>
  );
}

function TrustInline({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-bold text-[#2C2C2C]">{title}</p>
        <p className="mt-0.5 text-xs font-medium text-[#888888]">{subtitle}</p>
      </div>
    </div>
  );
}
