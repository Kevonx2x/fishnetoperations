"use client";

import { motion } from "framer-motion";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { SortMode } from "@/lib/marketplace-property";

export function SearchTabPanel({
  filterDraft,
  setFilterDraft,
  resetFilters,
  sortMode,
  setSortMode,
  sortOptions,
  draftMatchCount,
  onApplyAndGoHome,
}: {
  filterDraft: {
    searchQuery: string;
    priceRange: [number, number];
    bedsFilter: number | null;
    bathsFilter: number | null;
    propertyType: string | null;
  };
  setFilterDraft: React.Dispatch<
    React.SetStateAction<{
      searchQuery: string;
      priceRange: [number, number];
      bedsFilter: number | null;
      bathsFilter: number | null;
      propertyType: string | null;
    }>
  >;
  resetFilters: () => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;
  sortOptions: { value: SortMode; label: string }[];
  draftMatchCount: number;
  onApplyAndGoHome: () => void;
}) {
  const setPriceRange = (next: [number, number]) => {
    const lo = Math.max(0, Math.min(next[0], next[1]));
    const hi = Math.min(350_000_000, Math.max(next[0], next[1]));
    setFilterDraft((f) => ({ ...f, priceRange: [lo, hi] as [number, number] }));
  };

  return (
    <div className="px-4 pt-4 pb-28">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
            Search
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
            <SlidersHorizontal className="h-5 w-5 text-[#7C9A7E]" />
            Filters & Sort
          </h2>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[#2C2C2C]/70 shadow-sm hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
        >
          <RotateCcw className="h-4 w-4 text-[#7C9A7E]" />
          Reset
        </button>
      </div>

      {/* Location */}
      <section className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/45">
          Location
        </p>
        <input
          value={filterDraft.searchQuery}
          onChange={(e) =>
            setFilterDraft((f) => ({ ...f, searchQuery: e.target.value }))
          }
          placeholder="Try: Forbes Park, Rockwell, Alabang…"
          className="mt-3 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
        />
      </section>

      {/* Price */}
      <section className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/45">
            Price range
          </p>
          <div className="rounded-full bg-[#7C9A7E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70">
            {formatPeso(filterDraft.priceRange[0])} – {formatPeso(filterDraft.priceRange[1])}
          </div>
        </div>

        <div className="mt-4">
          <Slider
            min={0}
            max={350_000_000}
            step={1_000_000}
            value={filterDraft.priceRange}
            onValueChange={(v) => setPriceRange([v[0] ?? 0, v[1] ?? 350_000_000] as [number, number])}
            className="[&_[data-slot=slider-range]]:bg-[#7C9A7E] [&_[data-slot=slider-track]]:bg-[#2C2C2C]/10 [&_[data-slot=slider-thumb]]:border-[#C9A84C] [&_[data-slot=slider-thumb]]:ring-[#C9A84C]/35"
          />
          <div className="mt-2 flex justify-between text-[11px] font-medium text-[#2C2C2C]/45">
            <span>₱0</span>
            <span>₱350M</span>
          </div>
        </div>
      </section>

      {/* Beds */}
      <section className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/45">
          Bedrooms
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Any", value: null as number | null },
            { label: "1+", value: 1 },
            { label: "2+", value: 2 },
            { label: "3+", value: 3 },
            { label: "4+", value: 4 },
          ].map((opt) => (
            <Chip
              key={opt.label}
              active={filterDraft.bedsFilter === opt.value}
              onClick={() => setFilterDraft((f) => ({ ...f, bedsFilter: opt.value }))}
              label={opt.label}
            />
          ))}
        </div>
      </section>

      {/* Baths */}
      <section className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/45">
          Bathrooms
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Any", value: null as number | null },
            { label: "1+", value: 1 },
            { label: "2+", value: 2 },
            { label: "3+", value: 3 },
            { label: "4+", value: 4 },
          ].map((opt) => (
            <Chip
              key={opt.label}
              active={filterDraft.bathsFilter === opt.value}
              onClick={() => setFilterDraft((f) => ({ ...f, bathsFilter: opt.value }))}
              label={opt.label}
            />
          ))}
        </div>
      </section>

      {/* Property type */}
      <section className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/45">
          Property type
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "House", value: "House" },
            { label: "Condo", value: "Condo" },
            { label: "Villa", value: "Villa" },
            { label: "Land", value: "Land" },
          ].map((opt) => (
            <Chip
              key={opt.value}
              active={(filterDraft.propertyType ?? "").toLowerCase() === opt.value.toLowerCase()}
              onClick={() =>
                setFilterDraft((f) => ({
                  ...f,
                  propertyType:
                    (f.propertyType ?? "").toLowerCase() === opt.value.toLowerCase()
                      ? null
                      : opt.value,
                }))
              }
              label={opt.label}
            />
          ))}
        </div>
      </section>

      {/* Sort */}
      <section className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/45">
          Sort
        </p>
        <div className="mt-3 relative">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="w-full appearance-none rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 pr-10 text-sm font-semibold text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/45" />
        </div>
      </section>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#2C2C2C]/8 bg-[#FAF8F4]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={onApplyAndGoHome}
            className="w-full rounded-full bg-[#2C2C2C] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#7C9A7E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
          >
            Show {draftMatchCount} Results
          </motion.button>
          <p className="mt-2 text-center text-[11px] font-medium text-[#2C2C2C]/45">
            Refine until it feels right—then jump back to Home.
          </p>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35 ${
        active
          ? "bg-[#7C9A7E] text-white"
          : "bg-white text-[#2C2C2C]/60 border border-[#2C2C2C]/10 hover:bg-[#FAF8F4]"
      }`}
    >
      {label}
    </button>
  );
}

function formatPeso(value: number): string {
  const v = Math.max(0, Math.round(value));
  if (v >= 1_000_000_000) return `₱${Math.round(v / 1_000_000_000)}B`;
  if (v >= 1_000_000) return `₱${Math.round(v / 1_000_000)}M`;
  return `₱${v.toLocaleString()}`;
}

