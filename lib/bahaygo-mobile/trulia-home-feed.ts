import type { DbProperty } from "@/lib/marketplace-property";

export type TruliaFeedTab = {
  id: string;
  label: string;
  listings: DbProperty[];
};

export type TruliaFeedSection =
  | { kind: "vertical"; listings: DbProperty[] }
  | {
      kind: "property_type_tabs";
      title: string;
      tabs: TruliaFeedTab[];
    }
  | {
      kind: "tourist_location_tabs";
      title: string;
      tabs: TruliaFeedTab[];
    };

function normType(p: DbProperty): string {
  return String(p.property_type ?? "").trim().toLowerCase();
}

function propertyLocationText(p: DbProperty): string {
  return `${p.city ?? ""} ${p.location ?? ""} ${p.region ?? ""}`.toLowerCase();
}

function matchesLocationKeywords(p: DbProperty, keywords: string[]): boolean {
  const text = propertyLocationText(p);
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

function isCondoListing(p: DbProperty): boolean {
  const t = normType(p);
  return t.includes("condo") || t.includes("apartment") || t.includes("studio");
}

function isTownhouseListing(p: DbProperty): boolean {
  return normType(p).includes("townhouse");
}

function isHouseListing(p: DbProperty): boolean {
  const t = normType(p);
  return (t.includes("house") && !t.includes("townhouse")) || t.includes("lot");
}

function takeSequential(pool: DbProperty[], count: number, reserved: Set<string>): DbProperty[] {
  const out: DbProperty[] = [];
  for (const p of pool) {
    if (reserved.has(p.id)) continue;
    reserved.add(p.id);
    out.push(p);
    if (out.length >= count) break;
  }
  return out;
}

function filterTabListings(
  pool: DbProperty[],
  matcher: (p: DbProperty) => boolean,
  limit: number,
): DbProperty[] {
  return pool.filter(matcher).slice(0, limit);
}

export type BuildTruliaMobileFeedOptions = {
  pool: DbProperty[];
  mode: "buy" | "rent";
};

/**
 * Partitions the mobile discovery pool into Trulia-style alternating vertical blocks
 * and horizontal tabbed carousels. Vertical blocks dedupe by id; carousels may reuse
 * listings from the full pool for richer browsing.
 */
export function buildTruliaMobileFeedSections(
  options: BuildTruliaMobileFeedOptions,
): TruliaFeedSection[] {
  const { pool, mode } = options;
  if (pool.length === 0) return [];

  const reservedVertical = new Set<string>();
  const sections: TruliaFeedSection[] = [];

  const vertical1 = takeSequential(pool, 3, reservedVertical);
  if (vertical1.length > 0) {
    sections.push({ kind: "vertical", listings: vertical1 });
  }

  const propertyTypeTabs: TruliaFeedTab[] = [
    {
      id: "condos",
      label: "Condos",
      listings: filterTabListings(pool, isCondoListing, 10),
    },
    {
      id: "townhouses",
      label: "Townhouses",
      listings: filterTabListings(pool, isTownhouseListing, 10),
    },
    {
      id: "houses",
      label: "Houses",
      listings: filterTabListings(pool, isHouseListing, 10),
    },
  ].filter((tab) => tab.listings.length > 0);

  if (propertyTypeTabs.length > 0) {
    sections.push({
      kind: "property_type_tabs",
      title: mode === "rent" ? "Rental types" : "Home types",
      tabs: propertyTypeTabs,
    });
  }

  const vertical2 = takeSequential(pool, 4, reservedVertical);
  if (vertical2.length > 0) {
    sections.push({ kind: "vertical", listings: vertical2 });
  }

  const touristLocationTabs: TruliaFeedTab[] = [
    {
      id: "tagaytay",
      label: "Tagaytay",
      listings: filterTabListings(pool, (p) => matchesLocationKeywords(p, ["tagaytay"]), 10),
    },
    {
      id: "cebu",
      label: "Cebu",
      listings: filterTabListings(pool, (p) => matchesLocationKeywords(p, ["cebu"]), 10),
    },
    {
      id: "subic",
      label: "Subic",
      listings: filterTabListings(
        pool,
        (p) => matchesLocationKeywords(p, ["subic", "olongapo", "zambales"]),
        10,
      ),
    },
    {
      id: "metro-manila",
      label: "Metro Manila",
      listings: filterTabListings(
        pool,
        (p) =>
          matchesLocationKeywords(p, [
            "makati",
            "taguig",
            "manila",
            "pasig",
            "quezon",
            "mandaluyong",
            "paranaque",
            "las pinas",
            "muntinlupa",
            "bgc",
            "bonifacio",
            "ortigas",
          ]),
        10,
      ),
    },
  ].filter((tab) => tab.listings.length > 0);

  if (touristLocationTabs.length > 0) {
    sections.push({
      kind: "tourist_location_tabs",
      title: "Tourist locations",
      tabs: touristLocationTabs,
    });
  }

  const vertical3 = takeSequential(pool, 4, reservedVertical);
  if (vertical3.length > 0) {
    sections.push({ kind: "vertical", listings: vertical3 });
  }

  const remainder = pool.filter((p) => !reservedVertical.has(p.id));
  if (remainder.length > 0) {
    sections.push({ kind: "vertical", listings: remainder.slice(0, 6) });
  }

  return sections;
}

export function truliaFeedListingCount(sections: TruliaFeedSection[]): number {
  const ids = new Set<string>();
  for (const section of sections) {
    if (section.kind === "vertical") {
      for (const p of section.listings) ids.add(p.id);
    } else {
      for (const tab of section.tabs) {
        for (const p of tab.listings) ids.add(p.id);
      }
    }
  }
  return ids.size;
}
