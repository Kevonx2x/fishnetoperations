"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { DormspaceRowCarousel } from "@/components/dormspaces/dormspace-row-carousel";
import {
  DORMSPACE_GENDER_OPTIONS,
  DORMSPACE_ROOM_TYPE_OPTIONS,
  METRO_MANILA_CITIES,
  type DormspaceGenderPreference,
  type DormspaceRoomType,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import {
  EMPTY_DORMSPACE_BROWSE_FILTERS,
  type DormspaceBrowseFilters,
} from "@/lib/dormspace-browse-filters";
import {
  buildDormspaceBrowseRows,
  dormspaceMatchesFilters,
  hasActiveDormspaceFilters,
} from "@/lib/dormspace-browse-rows";
import type { DormspacePopularArea } from "@/lib/dormspace-popular-areas";

const FIELD =
  "rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

export type { DormspaceBrowseFilters } from "@/lib/dormspace-browse-filters";

type Props = {
  listings: DormspaceWithPhotos[];
  featuredNeighborhoods?: DormspacePopularArea[];
  filters?: DormspaceBrowseFilters;
  onFiltersChange?: (filters: DormspaceBrowseFilters) => void;
  syncLocationToHero?: (location: string) => void;
};

export function DormspaceBrowse({
  listings,
  featuredNeighborhoods,
  filters: controlledFilters,
  onFiltersChange,
  syncLocationToHero,
}: Props) {
  const [city, setCity] = useState("");
  const [roomType, setRoomType] = useState<"" | DormspaceRoomType>("");
  const [gender, setGender] = useState<"" | DormspaceGenderPreference>("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const isControlled = controlledFilters != null && onFiltersChange != null;

  useEffect(() => {
    if (!controlledFilters) return;
    setCity(controlledFilters.city);
    setRoomType(controlledFilters.roomType);
    setGender(controlledFilters.gender);
    setMinPrice(controlledFilters.minPrice);
    setMaxPrice(controlledFilters.maxPrice);
  }, [controlledFilters]);

  const filters = useMemo(
    () =>
      isControlled && controlledFilters
        ? controlledFilters
        : {
            ...EMPTY_DORMSPACE_BROWSE_FILTERS,
            city,
            roomType,
            gender,
            minPrice,
            maxPrice,
          },
    [isControlled, controlledFilters, city, roomType, gender, minPrice, maxPrice],
  );

  const updateFilters = (next: Partial<DormspaceBrowseFilters>) => {
    const merged = { ...filters, ...next };
    if (onFiltersChange) {
      onFiltersChange(merged);
      if (syncLocationToHero && "city" in next) {
        syncLocationToHero(next.city ?? merged.city);
      }
    } else {
      if (next.city !== undefined) setCity(next.city);
      if (next.roomType !== undefined) setRoomType(next.roomType);
      if (next.gender !== undefined) setGender(next.gender);
      if (next.minPrice !== undefined) setMinPrice(next.minPrice);
      if (next.maxPrice !== undefined) setMaxPrice(next.maxPrice);
    }
  };

  const filtersActive = hasActiveDormspaceFilters(filters);

  const filtered = useMemo(
    () => listings.filter((row) => dormspaceMatchesFilters(row, filters, featuredNeighborhoods)),
    [listings, filters, featuredNeighborhoods],
  );

  const rows = useMemo(() => {
    if (filtersActive) {
      if (filtered.length === 0) return [];
      const categoryRows = buildDormspaceBrowseRows(filtered).filter((r) => r.key !== "featured");
      return [
        {
          key: "matches",
          title: filters.city ? `Dorms in ${filters.city}` : "Matching dormspaces",
          subtitle: `${filtered.length} listing${filtered.length === 1 ? "" : "s"} match your filters`,
          items: filtered,
          featured: true,
        },
        ...categoryRows.slice(0, 2),
      ];
    }
    return buildDormspaceBrowseRows(listings);
  }, [listings, filtered, filtersActive, filters.city]);

  const clearFilters = () => {
    if (onFiltersChange) {
      onFiltersChange(EMPTY_DORMSPACE_BROWSE_FILTERS);
      syncLocationToHero?.("");
    } else {
      setCity("");
      setRoomType("");
      setGender("");
      setMinPrice("");
      setMaxPrice("");
    }
  };

  return (
    <section id="listings" className="mx-auto mt-4 max-w-7xl scroll-mt-24 px-4 pb-12 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">
            Browse dormspaces
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#484848]">
            Scroll by area and category — verified landlords across Metro Manila
          </p>
        </div>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-bold text-[#6B9E6E] hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-[#DDDDDD] bg-white p-4 shadow-sm">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          City
          <select
            className={FIELD}
            value={filters.city}
            onChange={(e) => updateFilters({ city: e.target.value })}
          >
            <option value="">All cities</option>
            {METRO_MANILA_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Room type
          <select
            className={FIELD}
            value={filters.roomType}
            onChange={(e) => updateFilters({ roomType: e.target.value as "" | DormspaceRoomType })}
          >
            <option value="">All types</option>
            {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Min ₱/mo
          <input
            className={FIELD}
            type="number"
            min={0}
            value={filters.minPrice}
            onChange={(e) => updateFilters({ minPrice: e.target.value })}
          />
        </label>
        <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Max ₱/mo
          <input
            className={FIELD}
            type="number"
            min={0}
            value={filters.maxPrice}
            onChange={(e) => updateFilters({ maxPrice: e.target.value })}
          />
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Gender
          <select
            className={FIELD}
            value={filters.gender}
            onChange={(e) => updateFilters({ gender: e.target.value as "" | DormspaceGenderPreference })}
          >
            <option value="">Any</option>
            {DORMSPACE_GENDER_OPTIONS.filter((o) => o.value !== "any").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtersActive && filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white px-6 py-14 text-center">
          <p className="font-serif text-xl font-semibold text-[#2C2C2C]">No dormspaces match your filters</p>
          <p className="mt-2 text-sm font-medium text-[#484848]">Try adjusting your filters or browse all listings below.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-[#2C2C2C]/15 px-6 text-sm font-bold text-[#2C2C2C]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          {rows.map((row, i) => (
            <div key={row.key}>
              <DormspaceRowCarousel
                rowKey={row.key}
                title={row.title}
                subtitle={row.subtitle}
                items={row.items}
                featured={row.featured}
              />
              {i < rows.length - 1 ? <div className="mt-6 h-0 sm:mt-8" aria-hidden /> : null}
            </div>
          ))}
        </div>
      )}

      {!filtersActive && listings.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-[#484848]">
            Be the first landlord on BahayGo Dormspaces — listings you add appear in these rows instantly.
          </p>
          <Link
            href="/dormspaces/welcome"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white"
          >
            List your dormspace
          </Link>
        </div>
      ) : null}
    </section>
  );
}
