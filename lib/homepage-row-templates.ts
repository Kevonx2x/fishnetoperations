import type { DbProperty } from "@/lib/marketplace-property";
import type { FiltersState } from "@/lib/homepage-marketplace-filters";

/** Client-side row filter merged with sheet filters and optional Featured Location label. */
export type HomepageRowTemplateContext = {
  mode: "buy" | "rent";
  locationLabel: string | null;
  filters: FiltersState;
};

export type HomepageRowTemplate = {
  id: string;
  priority: number;
  minResults?: number;
  limit?: number;
  featured?: boolean;
  sort: "newest" | "trust";
  /** When set, template is omitted (e.g. rent-only price bands). */
  showIf?: (ctx: HomepageRowTemplateContext) => boolean;
  baseTitle: string;
  /** Bedroom rows ignore conflicting bed count from the filter sheet in titles. */
  bedroomSpecific?: boolean;
  subtitle: string | ((ctx: HomepageRowTemplateContext) => string);
  matches: (p: DbProperty, ctx: HomepageRowTemplateContext) => boolean;
};

export type BuiltHomepageRow = {
  key: string;
  title: string;
  subtitle: string;
  items: DbProperty[];
  featured?: boolean;
};

function normType(p: DbProperty): string {
  return String(p.property_type ?? "").trim().toLowerCase();
}

function isRentListing(p: DbProperty): boolean {
  const lt = String(p.listing_type ?? "sale");
  return (lt === "rent" || lt === "both") && (p.status === "for_rent" || p.status === "both");
}

function isSaleListing(p: DbProperty): boolean {
  const lt = String(p.listing_type ?? "sale");
  return (lt === "sale" || lt === "both") && (p.status === "for_sale" || p.status === "both");
}

function parsePesoAmount(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0;
  const cleaned = raw.replace(/[₱,\s]/g, "").toUpperCase();
  const m = cleaned.match(/^([\d.]+)\s*([KM])?$/);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return 0;
    const suffix = m[2];
    if (suffix === "M") return n * 1_000_000;
    if (suffix === "K") return n * 1_000;
    return n;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function effectivePrice(p: DbProperty, mode: "buy" | "rent"): number {
  if (mode === "rent") return parsePesoAmount(p.rent_price);
  return parsePesoAmount(p.price);
}

/** Title with optional location + non-conflicting filter context. */
export function buildTemplateRowTitle(template: HomepageRowTemplate, ctx: HomepageRowTemplateContext): string {
  const { locationLabel, filters } = ctx;
  let label = template.baseTitle;

  if (locationLabel) {
    if (label === "Featured Picks") {
      label = `Featured in ${locationLabel}`;
    } else {
      label = `${label} in ${locationLabel}`;
    }
  }

  if (!template.bedroomSpecific && filters.beds !== "any") {
    const br = filters.beds === 4 ? "4+ BR" : `${filters.beds}BR`;
    const withBr = `${label} · ${br}`;
    if (withBr.length <= 50) return withBr;
    return `${label} · ${br}`;
  }

  if (label.length <= 50) return label;
  const parts = label.split(" in ");
  if (parts.length === 2) return `${parts[0]} · ${parts[1]}`;
  return label;
}

function templateSubtitle(template: HomepageRowTemplate, ctx: HomepageRowTemplateContext): string {
  return typeof template.subtitle === "function" ? template.subtitle(ctx) : template.subtitle;
}

/**
 * Row templates — columns verified on `public.properties`:
 * featured, created_at, sales_status, pet_friendly, family_friendly, near_schools,
 * beds, listing_type, status, price, rent_price, property_type.
 */
export const HOMEPAGE_ROW_TEMPLATES: HomepageRowTemplate[] = [
  {
    id: "featured",
    priority: 10,
    limit: 8,
    featured: true,
    sort: "trust",
    baseTitle: "Featured Picks",
    subtitle: "Recommended for you",
    matches: (p) => p.featured === true,
  },
  {
    id: "newly-listed",
    priority: 20,
    limit: 8,
    sort: "newest",
    baseTitle: "Newly Listed",
    subtitle: (ctx) => (ctx.mode === "buy" ? "Fresh on the market" : "Just posted — explore first"),
    matches: () => true,
  },
  {
    id: "move-in-ready",
    priority: 30,
    sort: "newest",
    baseTitle: "Move-in Ready",
    subtitle: "Ready for occupancy (RFO)",
    matches: (p) => String(p.sales_status ?? "").trim().toUpperCase() === "RFO",
  },
  {
    id: "presale",
    priority: 40,
    sort: "newest",
    baseTitle: "Pre-selling",
    subtitle: "Pre-construction pricing & early picks",
    matches: (p) =>
      String(p.sales_status ?? "").trim().toLowerCase() === "presale" || Boolean(p.is_presale),
  },
  {
    id: "pet-friendly",
    priority: 50,
    sort: "newest",
    baseTitle: "Pet-Friendly",
    subtitle: "Welcoming your furry family",
    matches: (p) => p.pet_friendly === true,
  },
  {
    id: "family-friendly",
    priority: 60,
    sort: "newest",
    baseTitle: "Family-Friendly",
    subtitle: "Room to grow and gather",
    matches: (p) => p.family_friendly === true,
  },
  {
    id: "near-schools",
    priority: 70,
    sort: "newest",
    baseTitle: "Near Schools",
    subtitle: "Close to schools & everyday essentials",
    matches: (p) => p.near_schools === true,
  },
  {
    id: "studio-1br",
    priority: 80,
    bedroomSpecific: true,
    sort: "newest",
    baseTitle: "Studio & 1BR",
    subtitle: "Compact, efficient layouts",
    matches: (p) => p.beds === 0 || p.beds === 1,
  },
  {
    id: "2-bedroom",
    priority: 90,
    bedroomSpecific: true,
    sort: "newest",
    baseTitle: "2-Bedroom",
    subtitle: "Balanced space for work and rest",
    matches: (p) => p.beds === 2,
  },
  {
    id: "family-sized",
    priority: 100,
    bedroomSpecific: true,
    sort: "newest",
    baseTitle: "Family-sized (3BR+)",
    subtitle: "Extra rooms for everyone",
    matches: (p) => p.beds >= 3,
  },
  {
    id: "budget-rentals",
    priority: 110,
    showIf: (ctx) => ctx.mode === "rent",
    sort: "newest",
    baseTitle: "Budget rentals",
    subtitle: "Under ₱30,000 per month",
    matches: (p, ctx) => isRentListing(p) && effectivePrice(p, ctx.mode) > 0 && effectivePrice(p, ctx.mode) <= 30_000,
  },
  {
    id: "luxury-rentals",
    priority: 120,
    showIf: (ctx) => ctx.mode === "rent",
    sort: "newest",
    baseTitle: "Luxury rentals",
    subtitle: "Premium addresses, elevated living",
    matches: (p, ctx) => isRentListing(p) && effectivePrice(p, ctx.mode) >= 100_000,
  },
  {
    id: "under-5m",
    priority: 130,
    showIf: (ctx) => ctx.mode === "buy",
    sort: "newest",
    baseTitle: "Under ₱5M",
    subtitle: "Accessible price points for buyers",
    matches: (p, ctx) => {
      const n = effectivePrice(p, ctx.mode);
      return isSaleListing(p) && n > 0 && n <= 5_000_000;
    },
  },
  {
    id: "premium-20m",
    priority: 140,
    showIf: (ctx) => ctx.mode === "buy",
    sort: "newest",
    baseTitle: "Premium ₱20M+",
    subtitle: "Signature homes & investment-grade stock",
    matches: (p, ctx) => isSaleListing(p) && effectivePrice(p, ctx.mode) >= 20_000_000,
  },
  {
    id: "condos",
    priority: 150,
    sort: "newest",
    baseTitle: "Condos",
    subtitle: "Tower living across the metro",
    matches: (p) => {
      const t = normType(p);
      return t.includes("condo") || t.includes("apartment") || t.includes("studio");
    },
  },
  {
    id: "townhouses",
    priority: 160,
    sort: "newest",
    baseTitle: "Townhouses",
    subtitle: "Townhouse communities & rows",
    matches: (p) => normType(p).includes("townhouse"),
  },
  {
    id: "houses-lots",
    priority: 170,
    sort: "newest",
    baseTitle: "Houses & Lots",
    subtitle: "Land and house inventory",
    matches: (p) => {
      const t = normType(p);
      return (t.includes("house") && !t.includes("townhouse")) || t.includes("lot") || t.includes("land");
    },
  },
];

export function buildHomepageRowsFromTemplates(args: {
  pool: DbProperty[];
  passesGlobalFilters: (p: DbProperty) => boolean;
  ctx: HomepageRowTemplateContext;
  propertyTrustScoreById: Map<string, number>;
}): BuiltHomepageRow[] {
  const sortNewest = (a: DbProperty, b: DbProperty) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const sortTrust = (a: DbProperty, b: DbProperty) =>
    (args.propertyTrustScoreById.get(b.id) ?? 0) - (args.propertyTrustScoreById.get(a.id) ?? 0);

  const templates = [...HOMEPAGE_ROW_TEMPLATES]
    .filter((t) => !t.showIf || t.showIf(args.ctx))
    .sort((a, b) => a.priority - b.priority);

  const rows: BuiltHomepageRow[] = [];

  for (const template of templates) {
    const min = template.minResults ?? 1;
    const limit = template.limit ?? 12;
    const sort = template.sort === "trust" ? sortTrust : sortNewest;

    const items = args.pool
      .filter((p) => template.matches(p, args.ctx) && args.passesGlobalFilters(p))
      .sort(sort)
      .slice(0, limit);
    if (items.length < min) continue;

    rows.push({
      key: template.id,
      title: buildTemplateRowTitle(template, args.ctx),
      subtitle: templateSubtitle(template, args.ctx),
      items,
      featured: template.featured,
    });
  }

  return rows;
}

export function buildFilteredEmptyMessage(
  filters: FiltersState,
  neighborhoodLabel: string | null,
  search: string,
): string {
  const location = filters.locationLabel || neighborhoodLabel || (search.trim() || null);
  if (location) {
    return `No listings match your filters in ${location}. Try expanding your search.`;
  }
  return "No listings match your filters. Try expanding your search.";
}

/*
 * Future templates (require new SQL columns):
 * - Near Mall — `near_mall boolean` or `landmark_tags text[]`
 * - Tourist Areas — `tourist_area boolean` or `area_tags text[]`
 * - By Building Name — `building_name text` with index for grouping
 * - Near Transit — `near_transit boolean` / `mrt_station text`
 * - Gated Community — `gated_community boolean` (distinct from generic amenities text)
 */
