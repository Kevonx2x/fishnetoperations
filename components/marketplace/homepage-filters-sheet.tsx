"use client";

import { useState } from "react";
import {
  Activity,
  ArrowDown,
  Building2,
  Car,
  ChevronsUp,
  Columns,
  Home,
  Landmark,
  LayoutGrid,
  MapPin,
  PawPrint,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  type AmenityFilterKey,
  type FiltersState,
  type FurnishingFilter,
  type HomePropertyKind,
  type TransactionFilter,
  defaultHomepageFiltersState,
  filterBedBathPill,
  homePropertyKindChipClass,
  transactionPillClass,
} from "@/lib/homepage-marketplace-filters";
import { HomepageFilterDualPriceSlider } from "@/components/marketplace/homepage-filter-price-slider";

type LocationOption = { label: string };

export function HomepageFiltersSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  locationOptions,
  matchCount,
  onClearAll,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FiltersState;
  onFiltersChange: React.Dispatch<React.SetStateAction<FiltersState>>;
  locationOptions: LocationOption[];
  matchCount: number;
  onClearAll: () => void;
  onApply: () => void;
}) {
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "flex h-full w-full max-w-none flex-col gap-0 border-l border-[#2C2C2C]/10 bg-[#FAF8F4] p-0 shadow-2xl sm:!max-w-[min(420px,100vw)]",
          "data-[side=right]:w-full sm:data-[side=right]:w-[min(100vw,420px)]",
          "max-sm:data-[side=right]:inset-0 max-sm:data-[side=right]:h-[100dvh]",
        )}
        overlayClassName="bg-[#2C2C2C]/25 backdrop-blur-[2px]"
      >
        <SheetTitle className="sr-only">Filters</SheetTitle>

        <div className="flex shrink-0 items-center justify-between border-b border-[#2C2C2C]/10 px-5 py-4">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C]">Filters</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#2C2C2C] transition hover:bg-stone-200/80"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Price range</p>
            <div className="mt-3">
              <HomepageFilterDualPriceSlider
                minPrice={filters.minPrice}
                maxPrice={filters.maxPrice}
                onChange={(next) => onFiltersChange((s) => ({ ...s, ...next }))}
              />
            </div>
          </section>

          <section className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Property type</p>
            <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-5 sm:gap-1.5">
              {(
                [
                  ["any", LayoutGrid, "Any"] as const,
                  ["condo", Building2, "Condo"] as const,
                  ["house", Home, "House"] as const,
                  ["townhouse", Landmark, "Townhouse"] as const,
                  ["lot", MapPin, "Lot"] as const,
                ] as const
              ).map(([kind, Icon, label]) => {
                const k = kind as HomePropertyKind;
                const on = filters.homePropertyKind === k;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      onFiltersChange((s) => ({
                        ...s,
                        homePropertyKind: k,
                        propertyType: "any",
                      }))
                    }
                    className={homePropertyKindChipClass(on)}
                  >
                    <Icon className={cn("h-4 w-4", on ? "text-[#6B9E6E]" : "text-[#2C2C2C]/40")} aria-hidden />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Transaction type</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ["any", "Any"],
                  ["for_rent", "For Rent"],
                  ["for_sale", "For Sale"],
                ] as const
              ).map(([val, label]) => {
                const v = val as TransactionFilter;
                const on = filters.transactionType === v;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onFiltersChange((s) => ({ ...s, transactionType: v }))}
                    className={transactionPillClass(on)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Bedrooms</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["any", "Any"],
                    ["1", "1"],
                    ["2", "2"],
                    ["3", "3"],
                    ["4", "4+"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={`bed-${val}`}
                    type="button"
                    onClick={() =>
                      onFiltersChange((s) => ({
                        ...s,
                        beds: (val === "any" ? "any" : Number(val)) as FiltersState["beds"],
                      }))
                    }
                    className={filterBedBathPill(
                      val === "any" ? filters.beds === "any" : filters.beds === Number(val),
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Bathrooms</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["any", "Any"],
                    ["1", "1"],
                    ["2", "2"],
                    ["3", "3"],
                    ["4", "4+"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={`bath-${val}`}
                    type="button"
                    onClick={() =>
                      onFiltersChange((s) => ({
                        ...s,
                        baths: (val === "any" ? "any" : Number(val)) as FiltersState["baths"],
                      }))
                    }
                    className={filterBedBathPill(
                      val === "any" ? filters.baths === "any" : filters.baths === Number(val),
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Furnishing</p>
              <select
                value={filters.furnishing}
                onChange={(e) =>
                  onFiltersChange((s) => ({ ...s, furnishing: e.target.value as FurnishingFilter }))
                }
                className="mt-2 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
                aria-label="Furnishing"
              >
                <option value="any">Any</option>
                <option value="furnished">Furnished</option>
                <option value="semi">Semi-furnished</option>
                <option value="unfurnished">Unfurnished</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Floor area (sqm)</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={filters.floorAreaMin}
                  onChange={(e) =>
                    onFiltersChange((s) => ({ ...s, floorAreaMin: e.target.value.replace(/[^\d]/g, "") }))
                  }
                  placeholder="Min"
                  className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85 placeholder:text-[#2C2C2C]/35"
                  inputMode="numeric"
                  aria-label="Minimum floor area"
                />
                <input
                  value={filters.floorAreaMax}
                  onChange={(e) =>
                    onFiltersChange((s) => ({ ...s, floorAreaMax: e.target.value.replace(/[^\d]/g, "") }))
                  }
                  placeholder="Max"
                  className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85 placeholder:text-[#2C2C2C]/35"
                  inputMode="numeric"
                  aria-label="Maximum floor area"
                />
              </div>
            </div>
          </section>

          <section className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Location</p>
            <select
              value={filters.locationLabel ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onFiltersChange((s) => ({ ...s, locationLabel: v ? v : null }));
              }}
              className="mt-2 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
              aria-label="Filter by location"
            >
              <option value="">Any location</option>
              {locationOptions.map((loc) => (
                <option key={loc.label} value={loc.label}>
                  {loc.label}
                </option>
              ))}
            </select>
          </section>

          <section className="mt-6 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Amenities</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
              {(
                [
                  ["parking", Car, "Parking"],
                  ["pool", Waves, "Pool"],
                  ["gym", Activity, "Gym"],
                  ["aircon", Wind, "Aircon"],
                  ["balcony", Columns, "Balcony"],
                  ["elevator", ChevronsUp, "Elevator"],
                  ["pet", PawPrint, "Pet friendly"],
                ] as const
              ).map(([key, Icon, label]) => {
                const k = key as AmenityFilterKey;
                const checked = filters.amenities.includes(k);
                return (
                  <label
                    key={k}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/75"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0 rounded border-black/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                      checked={checked}
                      onChange={() =>
                        onFiltersChange((s) => ({
                          ...s,
                          amenities: s.amenities.includes(k)
                            ? s.amenities.filter((x) => x !== k)
                            : [...s.amenities, k],
                        }))
                      }
                    />
                    <Icon className="h-3.5 w-3.5 text-[#6B9E6E]" aria-hidden />
                    {label}
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setAmenitiesExpanded((e) => !e)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#6B9E6E] hover:underline"
            >
              {amenitiesExpanded ? "Show less" : "Show more"}
              <ArrowDown className={cn("h-3.5 w-3.5 transition", amenitiesExpanded && "rotate-180")} aria-hidden />
            </button>
            {amenitiesExpanded ? (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[#2C2C2C]/8 pt-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#2C2C2C]/75">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-black/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                    checked={filters.amenityExtra.nearSchools}
                    onChange={(e) =>
                      onFiltersChange((s) => ({
                        ...s,
                        amenityExtra: { ...s.amenityExtra, nearSchools: e.target.checked },
                      }))
                    }
                  />
                  Near schools
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#2C2C2C]/75">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-black/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                    checked={filters.amenityExtra.familyFriendly}
                    onChange={(e) =>
                      onFiltersChange((s) => ({
                        ...s,
                        amenityExtra: { ...s.amenityExtra, familyFriendly: e.target.checked },
                      }))
                    }
                  />
                  Family friendly
                </label>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#2C2C2C]/10 bg-[#FAF8F4] px-5 py-4">
          <button
            type="button"
            onClick={() => {
              onFiltersChange(defaultHomepageFiltersState());
              setAmenitiesExpanded(false);
              onClearAll();
            }}
            className="text-sm font-semibold text-[#6B9E6E] hover:underline"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="inline-flex min-w-[10rem] items-center justify-center rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60]"
          >
            Apply filters ({matchCount})
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
