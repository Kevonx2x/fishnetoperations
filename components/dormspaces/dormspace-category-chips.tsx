"use client";

import { useCallback, useRef } from "react";
import {
  BedDouble,
  GraduationCap,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { RowScrollNavButton } from "@/components/ui/gallery-nav-button";

import type { DormspaceBrowseFilters } from "@/lib/dormspace-browse-filters";
import { EMPTY_DORMSPACE_BROWSE_FILTERS } from "@/lib/dormspace-browse-filters";
import { DORMSPACE_CATEGORY_CHIPS } from "@/lib/dormspace-category-chips";
import { cn } from "@/lib/utils";

const CHIP_ICONS: Record<string, typeof GraduationCap> = {
  "near-dlsu": GraduationCap,
  "near-ust": GraduationCap,
  "near-feu": GraduationCap,
  female: Users,
  male: Users,
  bedspace: BedDouble,
  private: BedDouble,
  budget: Wallet,
};

type Props = {
  activeChipId: string | null;
  filters: DormspaceBrowseFilters;
  onSelectChip: (chipId: string | null, filters: DormspaceBrowseFilters) => void;
};

export function DormspaceCategoryChips({ activeChipId, filters, onSelectChip }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = useCallback((dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "next" ? 220 : -220, behavior: "smooth" });
  }, []);

  const handleChip = (id: string) => {
    const chip = DORMSPACE_CATEGORY_CHIPS.find((c) => c.id === id);
    if (!chip) return;
    if (activeChipId === id) {
      onSelectChip(null, EMPTY_DORMSPACE_BROWSE_FILTERS);
      return;
    }
    onSelectChip(id, {
      ...EMPTY_DORMSPACE_BROWSE_FILTERS,
      city: chip.filters.city ?? "",
      roomType: chip.filters.roomType ?? "",
      gender: chip.filters.gender ?? "",
      minPrice: chip.filters.minPrice ?? "",
      maxPrice: chip.filters.maxPrice ?? "",
    });
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <section className="bg-[#FAF8F4] py-3 sm:py-4">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-5">
        <RowScrollNavButton
          direction="prev"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2"
          onClick={() => scroll("prev")}
          aria-label="Scroll categories left"
        />
        <RowScrollNavButton
          direction="next"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2"
          onClick={() => scroll("next")}
          aria-label="Scroll categories right"
        />
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide md:px-10"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <button
            type="button"
            onClick={() => onSelectChip(null, EMPTY_DORMSPACE_BROWSE_FILTERS)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition",
              !activeChipId &&
                !filters.city &&
                !filters.gender &&
                !filters.roomType &&
                !filters.maxPrice &&
                !filters.universityId &&
                !filters.neighborhood
                ? "border-[#6B9E6E] bg-[#6B9E6E] text-white shadow-sm"
                : "border-[#2C2C2C]/12 bg-white text-[#484848] hover:border-[#6B9E6E]/40",
            )}
          >
            <Sparkles className="size-4 shrink-0" aria-hidden />
            All
          </button>
          {DORMSPACE_CATEGORY_CHIPS.map((chip) => {
            const Icon = CHIP_ICONS[chip.id] ?? GraduationCap;
            const active = activeChipId === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleChip(chip.id)}
                className={cn(
                  "flex shrink-0 flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition sm:min-w-[120px]",
                  active
                    ? "border-[#6B9E6E] bg-white shadow-[0_4px_16px_rgba(107,158,110,0.2)] ring-2 ring-[#6B9E6E]/25"
                    : "border-[#2C2C2C]/10 bg-white hover:border-[#D4A843]/50",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-[#2C2C2C]">
                  <Icon className="size-4 text-[#6B9E6E]" aria-hidden />
                  {chip.label}
                </span>
                {chip.countLabel ? (
                  <span className="mt-0.5 text-[10px] font-semibold text-[#888888]">{chip.countLabel}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
