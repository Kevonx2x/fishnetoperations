import { cn } from "@/lib/utils";
import type { SortMode } from "@/lib/marketplace-property";

export const HOMEPAGE_FILTER_MAX_PRICE = 350_000_000;

export type HomePropertyKind = "any" | "condo" | "house" | "townhouse" | "lot";
export type TransactionFilter = "any" | "for_sale" | "for_rent";
export type FurnishingFilter = "any" | "furnished" | "semi" | "unfurnished";
export type AmenityFilterKey =
  | "parking"
  | "pool"
  | "gym"
  | "aircon"
  | "balcony"
  | "elevator"
  | "pet";

export type FiltersState = {
  minPrice: number;
  maxPrice: number;
  beds: "any" | 1 | 2 | 3 | 4;
  baths: "any" | 1 | 2 | 3 | 4;
  propertyType: "any" | "House" | "Condo" | "Villa" | "Land" | "Studio" | "Presale";
  homePropertyKind: HomePropertyKind;
  transactionType: TransactionFilter;
  furnishing: FurnishingFilter;
  floorAreaMin: string;
  floorAreaMax: string;
  locationLabel: string | null;
  amenities: AmenityFilterKey[];
  amenityExtra: { nearSchools: boolean; familyFriendly: boolean };
};

export function defaultHomepageFiltersState(): FiltersState {
  return {
    minPrice: 0,
    maxPrice: HOMEPAGE_FILTER_MAX_PRICE,
    beds: "any",
    baths: "any",
    propertyType: "any",
    homePropertyKind: "any",
    transactionType: "any",
    furnishing: "any",
    floorAreaMin: "",
    floorAreaMax: "",
    locationLabel: null,
    amenities: [],
    amenityExtra: { nearSchools: false, familyFriendly: false },
  };
}

export function formatPesoInputLong(n: number): string {
  if (!Number.isFinite(n)) return "₱0";
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}

export function formatHomepageFilterPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "P0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const dec = m >= 10 || m % 1 === 0 ? 0 : 1;
    let s = m.toFixed(dec);
    if (dec === 1) s = s.replace(/\.0$/, "");
    return `P${s}M`;
  }
  if (n >= 1_000) {
    const k = Math.round(n / 1_000);
    return `P${k}K`;
  }
  return `P${Math.round(n)}`;
}

export function filterBedBathPill(selected: boolean): string {
  return cn(
    "flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold transition",
    selected ? "bg-[#6B9E6E] text-white shadow-sm" : "border border-black/12 bg-[#F3F1EC] text-[#2C2C2C]/78",
  );
}

export function homePropertyKindChipClass(selected: boolean): string {
  return cn(
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] font-semibold transition sm:gap-1 sm:px-1.5 sm:py-2 sm:text-[11px]",
    selected
      ? "border-[#6B9E6E] bg-[#6B9E6E]/10 text-[#6B9E6E]"
      : "border-black/10 bg-white text-[#2C2C2C]/65 hover:border-[#6B9E6E]/30",
  );
}

export function transactionPillClass(selected: boolean): string {
  return cn(
    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition ring-1",
    selected ? "bg-white text-[#6B9E6E] ring-[#6B9E6E]" : "bg-[#FAF8F4] text-[#2C2C2C]/55 ring-black/10",
  );
}

export function countActiveFilters(filters: FiltersState): number {
  let n = 0;
  if (filters.minPrice !== 0 || filters.maxPrice !== HOMEPAGE_FILTER_MAX_PRICE) n++;
  if (filters.beds !== "any") n++;
  if (filters.baths !== "any") n++;
  if (filters.homePropertyKind !== "any") n++;
  if (filters.transactionType !== "any") n++;
  if (filters.furnishing !== "any") n++;
  if (filters.floorAreaMin.trim() || filters.floorAreaMax.trim()) n++;
  if (filters.locationLabel) n++;
  if (filters.amenities.length > 0) n++;
  if (filters.amenityExtra.nearSchools) n++;
  if (filters.amenityExtra.familyFriendly) n++;
  return n;
}

export function hasActiveHomepageFilters(
  filters: FiltersState,
  opts?: { search?: string; neighborhoodFilter?: string | null },
): boolean {
  if (opts?.search?.trim()) return true;
  if (opts?.neighborhoodFilter) return true;
  if (filters.minPrice !== 0 || filters.maxPrice !== HOMEPAGE_FILTER_MAX_PRICE) return true;
  if (filters.beds !== "any" || filters.baths !== "any") return true;
  if (filters.homePropertyKind !== "any") return true;
  if (filters.transactionType !== "any") return true;
  if (filters.furnishing !== "any") return true;
  if (filters.floorAreaMin.trim() || filters.floorAreaMax.trim()) return true;
  if (filters.locationLabel) return true;
  if (filters.amenities.length > 0) return true;
  if (filters.amenityExtra.nearSchools || filters.amenityExtra.familyFriendly) return true;
  return false;
}

const KIND_ROW_LABEL: Record<Exclude<HomePropertyKind, "any">, string> = {
  condo: "Condos",
  house: "Houses",
  townhouse: "Townhouses",
  lot: "Lots",
};

/** Curated row title with active filter context (Playfair headings in UI). */
export function buildHomepageRowTitle(
  baseTitle: string,
  filters: FiltersState,
  mode: "buy" | "rent",
): string {
  const listingsInMatch = baseTitle.match(/^Listings in (.+)$/i);
  const embeddedLocation = listingsInMatch?.[1] ?? null;

  let intent = baseTitle;
  if (baseTitle.startsWith("Featured Picks")) intent = "Featured";
  else if (baseTitle.startsWith("Newly Listed")) intent = "Newly Listed";
  else if (listingsInMatch) intent = "Listings";

  const segments: string[] = [intent];

  if (filters.homePropertyKind !== "any") {
    segments.push(KIND_ROW_LABEL[filters.homePropertyKind]);
  }

  if (filters.beds !== "any") {
    segments.push(filters.beds === 4 ? "4+ BR" : `${filters.beds}BR`);
  }

  if (filters.transactionType === "for_rent") {
    segments.push(mode === "buy" ? "for rent" : "");
  } else if (filters.transactionType === "for_sale") {
    segments.push("for sale");
  }

  const location = filters.locationLabel ?? embeddedLocation;
  if (location) {
    segments.push(`in ${location}`);
  }

  const cleaned = segments.filter(Boolean);
  const spaced = cleaned.join(" ");
  if (spaced.length <= 50) return spaced;
  return cleaned.join(" · ");
}

export type FilterChipActions = {
  clearPrice: () => void;
  clearBeds: () => void;
  clearBaths: () => void;
  clearKind: () => void;
  clearTransaction: () => void;
  clearFurnishing: () => void;
  clearFloor: () => void;
  clearLocation: () => void;
  clearAmenities: () => void;
  clearSort: () => void;
  clearSearch?: () => void;
  clearNeighborhood?: () => void;
};

export function activeFilterChips(
  filters: FiltersState,
  actions: FilterChipActions,
  opts?: { search?: string; neighborhoodLabel?: string | null },
) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (opts?.neighborhoodLabel && actions.clearNeighborhood) {
    chips.push({
      key: "neighborhood",
      label: opts.neighborhoodLabel,
      onRemove: actions.clearNeighborhood,
    });
  } else if (opts?.search?.trim() && actions.clearSearch) {
    chips.push({
      key: "search",
      label: opts.search.trim(),
      onRemove: actions.clearSearch,
    });
  }

  if (filters.transactionType === "for_rent") {
    chips.push({ key: "tx", label: "For Rent", onRemove: actions.clearTransaction });
  } else if (filters.transactionType === "for_sale") {
    chips.push({ key: "tx", label: "For Sale", onRemove: actions.clearTransaction });
  }

  if (filters.locationLabel) {
    chips.push({ key: "loc", label: filters.locationLabel, onRemove: actions.clearLocation });
  }

  if (filters.homePropertyKind !== "any") {
    const k = filters.homePropertyKind;
    const t =
      k === "condo"
        ? "Condo"
        : k === "house"
          ? "House"
          : k === "townhouse"
            ? "Townhouse"
            : "Lot";
    chips.push({ key: "kind", label: t, onRemove: actions.clearKind });
  }

  if (filters.beds !== "any") {
    chips.push({
      key: "beds",
      label: filters.beds === 4 ? "4+ Bedrooms" : `${filters.beds} Bedroom${filters.beds === 1 ? "" : "s"}`,
      onRemove: actions.clearBeds,
    });
  }
  if (filters.baths !== "any") {
    chips.push({
      key: "baths",
      label: filters.baths === 4 ? "4+ Bathrooms" : `${filters.baths} Bathroom${filters.baths === 1 ? "" : "s"}`,
      onRemove: actions.clearBaths,
    });
  }

  if (filters.minPrice !== 0 || filters.maxPrice !== HOMEPAGE_FILTER_MAX_PRICE) {
    chips.push({
      key: "price",
      label: `${formatPesoInputLong(filters.minPrice)} - ${formatPesoInputLong(filters.maxPrice)}`,
      onRemove: actions.clearPrice,
    });
  }

  if (filters.furnishing !== "any") {
    const label =
      filters.furnishing === "semi"
        ? "Semi-furnished"
        : filters.furnishing === "furnished"
          ? "Furnished"
          : "Unfurnished";
    chips.push({ key: "furnish", label, onRemove: actions.clearFurnishing });
  }

  if (filters.floorAreaMin.trim() || filters.floorAreaMax.trim()) {
    chips.push({
      key: "sqm",
      label: `${filters.floorAreaMin || "0"}–${filters.floorAreaMax || "∞"} sqm`,
      onRemove: actions.clearFloor,
    });
  }

  if (filters.amenities.length > 0 || filters.amenityExtra.nearSchools || filters.amenityExtra.familyFriendly) {
    chips.push({
      key: "amen",
      label: `Amenities (${filters.amenities.length + (filters.amenityExtra.nearSchools ? 1 : 0) + (filters.amenityExtra.familyFriendly ? 1 : 0)})`,
      onRemove: actions.clearAmenities,
    });
  }

  return chips;
}

export function buildResultsHeading(
  count: number,
  filters: FiltersState,
  mode: "buy" | "rent",
  search: string,
  neighborhoodLabel: string | null,
): string {
  const location = filters.locationLabel || neighborhoodLabel || (search.trim() || null);
  const rent =
    filters.transactionType === "for_rent" || (filters.transactionType === "any" && mode === "rent");
  const sale =
    filters.transactionType === "for_sale" || (filters.transactionType === "any" && mode === "buy");

  const kindPlural: Record<Exclude<HomePropertyKind, "any">, string> = {
    condo: "condos",
    house: "houses",
    townhouse: "townhouses",
    lot: "lots",
  };

  if (filters.homePropertyKind !== "any") {
    const k = kindPlural[filters.homePropertyKind];
    const txPart = rent ? "for rent" : sale ? "for sale" : "";
    const base = `${count} ${k}${txPart ? ` ${txPart}` : ""}`;
    return location ? `${base} in ${location}` : base;
  }

  const noun = rent ? "rentals" : sale ? "properties for sale" : "properties";
  const base = `${count} ${noun}`;
  if (location) return `${base} in ${location}`;
  if (count === 0) return "No listings match your filters";
  return `${count} listings matching your filters`;
}

export function loosenMostRestrictiveFilter(
  filters: FiltersState,
  search: string,
  neighborhoodFilter: string | null,
  actions: FilterChipActions & { clearSearch: () => void; clearNeighborhood: () => void },
): "loosened" | "modal" {
  if (filters.locationLabel) {
    actions.clearLocation();
    return "loosened";
  }
  if (neighborhoodFilter) {
    actions.clearNeighborhood();
    return "loosened";
  }
  if (search.trim()) {
    actions.clearSearch();
    return "loosened";
  }
  if (
    filters.amenities.length > 0 ||
    filters.amenityExtra.nearSchools ||
    filters.amenityExtra.familyFriendly
  ) {
    actions.clearAmenities();
    return "loosened";
  }
  if (filters.beds !== "any") {
    actions.clearBeds();
    return "loosened";
  }
  if (filters.baths !== "any") {
    actions.clearBaths();
    return "loosened";
  }
  if (filters.homePropertyKind !== "any") {
    actions.clearKind();
    return "loosened";
  }
  if (filters.furnishing !== "any") {
    actions.clearFurnishing();
    return "loosened";
  }
  if (filters.floorAreaMin.trim() || filters.floorAreaMax.trim()) {
    actions.clearFloor();
    return "loosened";
  }
  if (filters.minPrice !== 0 || filters.maxPrice !== HOMEPAGE_FILTER_MAX_PRICE) {
    actions.clearPrice();
    return "loosened";
  }
  if (filters.transactionType !== "any") {
    actions.clearTransaction();
    return "loosened";
  }
  return "modal";
}
