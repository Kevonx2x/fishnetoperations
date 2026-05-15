"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAgentLiveAvailabilityFromPropertyRows } from "@/hooks/use-agent-live-availability";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowDown,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  Columns,
  Filter,
  Heart,
  Home,
  Landmark,
  LayoutGrid,
  MapPin,
  PawPrint,
  Pin,
  Search,
  Shield,
  Star,
  UserPlus,
  Flame,
  Waves,
  Wind,
  BadgeCheck,
  Lock,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cloudinaryPropertyPhotoHeroUrl } from "@/lib/cloudinary-property-photo-url";
import { isCloudinaryDeliveryUrl } from "@/lib/cloudinary";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty, SortMode } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import {
  usePropertyEngagementForProperties,
  type PropertyEngagement,
} from "@/hooks/use-property-engagement";
import { useAuth } from "@/contexts/auth-context";
import { PropertyZoomModal } from "@/components/marketplace/property-zoom-modal";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { listingListedLabel } from "@/lib/listing-listed-time";
import { AgentDirectoryCard } from "@/components/marketplace/agent-directory-card";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import { cn } from "@/lib/utils";
import { formatAgentScore } from "@/lib/format-agent-score";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { hideTutorialDemoPropertiesOrFilter } from "@/lib/tutorial-demo-property-filter";
import {
  availabilityCardOverlayClasses,
  availabilityCardOverlayLabel,
  propertyEngagementLooksUnavailable,
} from "@/lib/property-availability";
import { formatPropertyPriceDisplay, parsePriceToNumber } from "@/lib/format-listing-price";
import { propertyCanonicalCity } from "@/lib/normalize-city";
import { CoListRequestModal } from "@/components/marketplace/co-list-request-modal";
import { toast } from "sonner";
import { DEFAULT_AGENT_SPECIALTIES_COMMAS } from "@/lib/agent-profile-defaults";

export type { DbProperty, SortMode } from "@/lib/marketplace-property";
export { roomUrlsFor } from "@/lib/marketplace-property";

/** Display width for listing thumbs (~carousel + grid); keeps `/_next/image` requests small. */
const LISTING_IMAGE_SIZES = "(max-width: 639px) 100vw, (max-width: 1023px) 45vw, 320px" as const;

function firstBrowseListingThumbKey(
  rows: { key: string; items: DbProperty[] }[],
): string | undefined {
  for (const r of rows) {
    const first = r.items[0];
    if (first) return `${r.key}-${first.id}`;
  }
  return undefined;
}

/** First N listing cards (row order) for `next/image` priority (homepage has many rows). */
function listingThumbPriorityKeys(
  rows: { key: string; items: DbProperty[] }[],
  max: number,
): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    for (const p of r.items) {
      if (s.size >= max) return s;
      s.add(`${r.key}-${p.id}`);
    }
  }
  return s;
}

const FEATURED_CITIES: {
  key: string;
  label: string;
  imageUrl: string;
  /** Listings: canonical city from `propertyCanonicalCity` (uses `properties.city` when set). */
  match: (canonicalCity: string) => boolean;
  /** Agent directory: loose match on service-areas free text (unchanged behavior). */
  matchServiceArea: (serviceAreasText: string) => boolean;
}[] = [
  {
    key: "BGC",
    label: "BGC",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=300&h=200&fit=crop",
    match: (canon) => featuredMatchCanon(canon, "BGC", "BGC"),
    matchServiceArea: (loc) => loc.toLowerCase().includes("bgc"),
  },
  {
    key: "Makati",
    label: "Makati",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=300&h=200&fit=crop",
    match: (canon) => featuredMatchCanon(canon, "Makati", "Makati"),
    matchServiceArea: (loc) => loc.toLowerCase().includes("makati"),
  },
  {
    key: "Cebu City",
    label: "Cebu City",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=300&h=200&fit=crop",
    match: (canon) => featuredMatchCanon(canon, "Cebu City", "Cebu City"),
    matchServiceArea: (loc) => /cebu/i.test(loc),
  },
  {
    key: "Davao",
    label: "Davao",
    imageUrl: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=300&h=200&fit=crop",
    match: (canon) => featuredMatchCanon(canon, "Davao", "Davao"),
    matchServiceArea: (loc) => /davao/i.test(loc),
  },
  {
    key: "Ortigas",
    label: "Ortigas",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&h=200&fit=crop",
    match: (canon) => featuredMatchCanon(canon, "Ortigas", "Ortigas"),
    matchServiceArea: (loc) => loc.toLowerCase().includes("ortigas"),
  },
  {
    key: "Tagaytay",
    label: "Tagaytay",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&h=200&fit=crop",
    match: (canon) => featuredMatchCanon(canon, "Tagaytay", "Tagaytay"),
    matchServiceArea: (loc) => /tagaytay/i.test(loc),
  },
  {
    key: "Pasig",
    label: "Pasig",
    imageUrl: "https://images.unsplash.com/photo-1444084316824-dc26d6657664?w=400",
    match: (canon) => featuredMatchCanon(canon, "Pasig", "Pasig"),
    matchServiceArea: (loc) => /pasig/i.test(loc),
  },
  {
    key: "Mandaluyong",
    label: "Mandaluyong",
    imageUrl: "https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=400",
    match: (canon) => featuredMatchCanon(canon, "Mandaluyong", "Mandaluyong"),
    matchServiceArea: (loc) => /mandaluyong/i.test(loc),
  },
  {
    key: "Quezon City",
    label: "Quezon City",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400",
    match: (canon) => featuredMatchCanon(canon, "Quezon City", "Quezon City"),
    matchServiceArea: (loc) => {
      const l = loc.toLowerCase();
      return l.includes("quezon city") || /\bqc\b/.test(l);
    },
  },
  {
    key: "Alabang",
    label: "Alabang",
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400",
    match: (canon) => featuredMatchCanon(canon, "Alabang", "Alabang"),
    matchServiceArea: (loc) => /alabang|muntinlupa/i.test(loc),
  },
  {
    key: "Pasay",
    label: "Pasay",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400",
    match: (canon) => featuredMatchCanon(canon, "Pasay", "Pasay"),
    matchServiceArea: (loc) => /pasay/i.test(loc),
  },
  {
    key: "Paranaque",
    label: "Parañaque",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400",
    match: (canon) => featuredMatchCanon(canon, "Parañaque", "Paranaque"),
    matchServiceArea: (loc) => /parañaque|paranaque/i.test(loc),
  },
  {
    key: "Las Pinas",
    label: "Las Piñas",
    imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400",
    match: (canon) => featuredMatchCanon(canon, "Las Piñas", "Las Pinas"),
    matchServiceArea: (loc) => /las\s*piñas|las\s*pinas|laspiñas/i.test(loc),
  },
  {
    key: "Antipolo",
    label: "Antipolo",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400",
    match: (canon) => featuredMatchCanon(canon, "Antipolo", "Antipolo"),
    matchServiceArea: (loc) => /antipolo/i.test(loc),
  },
  {
    key: "Batangas",
    label: "Batangas",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400",
    match: (canon) => featuredMatchCanon(canon, "Batangas", "Batangas"),
    matchServiceArea: (loc) => /batangas/i.test(loc),
  },
  {
    key: "Iloilo",
    label: "Iloilo",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400",
    match: (canon) => featuredMatchCanon(canon, "Iloilo", "Iloilo"),
    matchServiceArea: (loc) => /iloilo/i.test(loc),
  },
  {
    key: "Bacolod",
    label: "Bacolod",
    imageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400",
    match: (canon) => featuredMatchCanon(canon, "Bacolod", "Bacolod"),
    matchServiceArea: (loc) => /bacolod/i.test(loc),
  },
];

/** Triplicate city strip for seamless infinite horizontal scroll (see Featured Locations section). */
const FEATURED_LOCATIONS_LOOP_COPIES = 3;

const FEATURED_LOCATIONS = [
  {
    label: "BGC",
    match: { neighborhood: "BGC" },
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=300&h=200&fit=crop",
  },
  {
    label: "Makati",
    match: { city: "Makati" },
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=300&h=200&fit=crop",
  },
  {
    label: "Ortigas",
    match: { neighborhood: "Ortigas Center" },
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&h=200&fit=crop",
  },
  {
    label: "Cebu City",
    match: { city: "Cebu City" },
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=300&h=200&fit=crop",
  },
  {
    label: "Davao",
    match: { city: "Davao" },
    imageUrl: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=300&h=200&fit=crop",
  },
  {
    label: "Tagaytay",
    match: { city: "Tagaytay" },
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&h=200&fit=crop",
  },
  {
    label: "Bacolod",
    match: { city: "Bacolod" },
    imageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400",
  },
] as const;

type RowConfig = {
  id: string;
  label: string;
  filter: {
    sortBy?: "created_at_desc" | "likes_desc" | "views_desc" | "price_asc" | "price_desc";
    limit?: number;
    listingTier?: ("featured" | "broker")[];
    sales_status?: string;
    /** Local-only: used only when mode is `all`. */
    listing_type?: "sale" | "rent";
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
    bedrooms_gte?: number;
    pet_friendly?: boolean;
    family_friendly?: boolean;
    near_schools?: boolean;
  };
};

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function listingPriceForMode(p: DbProperty, mode: "buy" | "rent" | "all"): number | null {
  if (mode === "rent") return parsePriceToNumber(p.rent_price);
  if (mode === "buy") return parsePriceToNumber(p.price);
  // all: use rent_price when present, else sale price
  return parsePriceToNumber(p.rent_price ?? "") ?? parsePriceToNumber(p.price);
}

function passesLocationRowPriceFilter(p: DbProperty, f: RowConfig["filter"], mode: "buy" | "rent" | "all"): boolean {
  if (f.min_price == null && f.max_price == null) return true;
  const n = listingPriceForMode(p, mode);
  if (n == null) return false;
  if (f.min_price != null && n < f.min_price) return false;
  if (f.max_price != null && n > f.max_price) return false;
  return true;
}

function rentLocationRows(placeLabel: string, idPrefix: string): RowConfig[] {
  const lim = 12 as const;
  return [
    { id: `${idPrefix}-newest`, label: `Newest in ${placeLabel}`, filter: { sortBy: "created_at_desc", limit: lim } },
    { id: `${idPrefix}-trending`, label: `Trending in ${placeLabel}`, filter: { sortBy: "likes_desc", limit: lim } },
    {
      id: `${idPrefix}-rent-under-30k`,
      label: `${placeLabel} under ₱30,000/mo`,
      filter: { max_price: 30_000, limit: lim },
    },
    {
      id: `${idPrefix}-rent-30-60k`,
      label: `${placeLabel} ₱30,000–₱60,000/mo`,
      filter: { min_price: 30_000, max_price: 60_000, limit: lim },
    },
    {
      id: `${idPrefix}-rent-luxury`,
      label: `${placeLabel} luxury rentals (₱60,000+/mo)`,
      filter: { min_price: 60_000, limit: lim },
    },
    { id: `${idPrefix}-studios`, label: `${placeLabel} studios`, filter: { bedrooms: 0, limit: lim } },
    { id: `${idPrefix}-bed-1`, label: `${placeLabel} 1-bedroom`, filter: { bedrooms: 1, limit: lim } },
    { id: `${idPrefix}-bed-2`, label: `${placeLabel} 2-bedroom`, filter: { bedrooms: 2, limit: lim } },
    { id: `${idPrefix}-bed-3p`, label: `${placeLabel} 3+ bedroom`, filter: { bedrooms_gte: 3, limit: lim } },
    { id: `${idPrefix}-pet`, label: `${placeLabel} Pet-friendly`, filter: { pet_friendly: true, limit: lim } },
    { id: `${idPrefix}-family`, label: `${placeLabel} Family-friendly`, filter: { family_friendly: true, limit: lim } },
    { id: `${idPrefix}-schools`, label: `${placeLabel} Near schools`, filter: { near_schools: true, limit: lim } },
  ];
}

function buyLocationRows(placeLabel: string, idPrefix: string): RowConfig[] {
  const lim = 12 as const;
  return [
    {
      id: `${idPrefix}-newest`,
      label: `Newest for sale in ${placeLabel}`,
      filter: { sortBy: "created_at_desc", limit: lim },
    },
    {
      id: `${idPrefix}-trending`,
      label: `Trending for sale in ${placeLabel}`,
      filter: { sortBy: "likes_desc", limit: lim },
    },
    { id: `${idPrefix}-under-5m`, label: `${placeLabel} under ₱5M`, filter: { max_price: 5_000_000, limit: lim } },
    {
      id: `${idPrefix}-5-10m`,
      label: `${placeLabel} ₱5M–₱10M`,
      filter: { min_price: 5_000_000, max_price: 10_000_000, limit: lim },
    },
    {
      id: `${idPrefix}-10-20m`,
      label: `${placeLabel} ₱10M–₱20M`,
      filter: { min_price: 10_000_000, max_price: 20_000_000, limit: lim },
    },
    { id: `${idPrefix}-luxury`, label: `${placeLabel} luxury (₱20M+)`, filter: { min_price: 20_000_000, limit: lim } },
    { id: `${idPrefix}-presale`, label: `${placeLabel} Presale`, filter: { sales_status: "Presale", limit: lim } },
    { id: `${idPrefix}-rfo`, label: `${placeLabel} Ready for occupancy`, filter: { sales_status: "RFO", limit: lim } },
    { id: `${idPrefix}-resale`, label: `${placeLabel} Resale`, filter: { sales_status: "Resale", limit: lim } },
    { id: `${idPrefix}-studios`, label: `${placeLabel} studios`, filter: { bedrooms: 0, limit: lim } },
    { id: `${idPrefix}-bed-1`, label: `${placeLabel} 1-bedroom`, filter: { bedrooms: 1, limit: lim } },
    { id: `${idPrefix}-bed-2`, label: `${placeLabel} 2-bedroom`, filter: { bedrooms: 2, limit: lim } },
    { id: `${idPrefix}-bed-3p`, label: `${placeLabel} 3+ bedroom`, filter: { bedrooms_gte: 3, limit: lim } },
    { id: `${idPrefix}-pet`, label: `${placeLabel} Pet-friendly`, filter: { pet_friendly: true, limit: lim } },
    { id: `${idPrefix}-family`, label: `${placeLabel} Family-friendly`, filter: { family_friendly: true, limit: lim } },
    { id: `${idPrefix}-schools`, label: `${placeLabel} Near schools`, filter: { near_schools: true, limit: lim } },
  ];
}

const LOCATION_ROW_CONFIG: Record<"rent" | "buy", Record<string, RowConfig[]>> = {
  rent: {
    BGC: rentLocationRows("BGC", "bgc"),
    Makati: rentLocationRows("Makati", "makati"),
    "Ortigas Center": rentLocationRows("Ortigas Center", "ortigas-center"),
    /** City-wide Pasig selection; labels use Ortigas Center. */
    Pasig: rentLocationRows("Ortigas Center", "pasig"),
    "Cebu City": rentLocationRows("Cebu", "cebu"),
    Davao: rentLocationRows("Davao", "davao"),
    Tagaytay: rentLocationRows("Tagaytay", "tagaytay"),
    Bacolod: rentLocationRows("Bacolod", "bacolod"),
  },
  buy: {
    BGC: buyLocationRows("BGC", "bgc"),
    Makati: buyLocationRows("Makati", "makati"),
    "Ortigas Center": buyLocationRows("Ortigas Center", "ortigas-center"),
    /** City-wide Pasig selection; labels use Ortigas Center. */
    Pasig: buyLocationRows("Ortigas Center", "pasig"),
    "Cebu City": buyLocationRows("Cebu", "cebu"),
    Davao: buyLocationRows("Davao", "davao"),
    Tagaytay: buyLocationRows("Tagaytay", "tagaytay"),
    Bacolod: buyLocationRows("Bacolod", "bacolod"),
  },
};

function defaultLocationRowIdPrefix(label: string): string {
  const slug = stripDiacritics(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.length > 0 ? slug : "location";
}

const DEFAULT_LOCATION_ROWS = (mode: "buy" | "rent", label: string): RowConfig[] => {
  const prefix = defaultLocationRowIdPrefix(label);
  return mode === "buy" ? buyLocationRows(label, prefix) : rentLocationRows(label, prefix);
};

/** Featured Locations card: compare persisted/derived canonical city to this card. */
function featuredMatchCanon(canon: string, label: string, key: string) {
  const n = stripDiacritics(canon).trim().toLowerCase();
  return (
    n === stripDiacritics(label).trim().toLowerCase() || n === stripDiacritics(key).trim().toLowerCase()
  );
}

/** When the search box exactly matches a featured city label/key, use its match() rules. */
function resolveFeaturedKeyFromQuery(qRaw: string): string | null {
  const t = qRaw.trim().toLowerCase();
  if (!t) return null;
  const strip = stripDiacritics(t);
  for (const c of FEATURED_CITIES) {
    if (c.key.toLowerCase() === t) return c.key;
    if (c.label.toLowerCase() === t) return c.key;
    if (stripDiacritics(c.label.toLowerCase()) === strip) return c.key;
  }
  return null;
}

/** `/locations/:slug` segment → featured city key (for notFound + marketplace hydration). */
export function resolveFeaturedCitySlugToKey(slug: string): string | null {
  const raw = decodeURIComponent(slug).trim();
  if (!raw) return null;
  const norm = (t: string) =>
    stripDiacritics(t).toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  const nSlug = norm(raw);
  for (const c of FEATURED_CITIES) {
    if (norm(c.key) === nSlug || norm(c.label) === nSlug) return c.key;
  }
  return null;
}

function featuredCityLabelToSlug(label: string): string {
  const raw = stripDiacritics(label).toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "locations";
}

function dedupeRowsTopToBottom<T extends { id: string }>(
  rows: { key: string; items: T[] }[],
): { rows: { key: string; items: T[] }[]; seen: Set<string> } {
  const seen = new Set<string>();
  const out: { key: string; items: T[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (i === 0) {
      out.push(r);
      for (const it of r.items) seen.add(it.id);
      continue;
    }
    const filtered = r.items.filter((it) => !seen.has(it.id));
    if (filtered.length < 3) continue;
    for (const it of filtered) seen.add(it.id);
    out.push({ ...r, items: filtered });
  }
  return { rows: out, seen };
}

function isFeaturedCityNeighborhoodKey(key: string | null): boolean {
  return key != null && FEATURED_CITIES.some((c) => c.key === key);
}

function buildMarketplaceHref(searchQuery: string, targetMode: "buy" | "rent") {
  const path = targetMode === "buy" ? "/buy" : "/";
  const trimmed = searchQuery.trim();
  if (!trimmed) return path;
  const params = new URLSearchParams();
  params.set("q", trimmed);
  params.set("type", targetMode === "buy" ? "sale" : "rent");
  return `${path}?${params.toString()}`;
}

function neighborhoodKey(location: string): string {
  const l = location.toLowerCase();
  const known = [
    "makati cbd",
    "makati",
    "bgc",
    "alabang",
    "forbes park",
    "tagaytay",
    "ortigas",
    "pasig",
    "quezon city",
    "mandaluyong",
    "san juan",
  ];
  const hit = known.find((k) => l.includes(k));
  if (!hit) return location.split(",")[0]?.trim() || location;
  return hit
    .split(" ")
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

function parsePesoToNumber(price: string): number {
  const raw = price.trim();
  const cleaned = raw.replace(/[₱,\s]/g, "");
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([MK])?$/i);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return 0;
    const suffix = (m[2] ?? "").toUpperCase();
    if (suffix === "M") return n * 1_000_000;
    if (suffix === "K") return n * 1_000;
    return n;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/** Buy vs rent search: uses sale price in buy mode and monthly rent in rent mode. */
function effectiveListingPriceForMode(p: DbProperty, mode: "buy" | "rent" | "all"): number {
  if (mode === "rent") return parsePesoToNumber(p.rent_price ?? "");
  if (mode === "buy") return parsePesoToNumber(p.price);
  // all: prefer rent price when present, otherwise sale price
  const rent = parsePesoToNumber(p.rent_price ?? "");
  if (rent > 0) return rent;
  return parsePesoToNumber(p.price);
}

function formatPeso(n: number): string {
  if (!Number.isFinite(n)) return "₱0";
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  return `₱${Math.round(n).toLocaleString()}`;
}

const HOMEPAGE_FILTER_MAX_PRICE = 350_000_000;

/** Compact P-prefixed labels for the homepage filter slider (e.g. P500K, P2.5M, P350M). */
function formatHomepageFilterPrice(n: number): string {
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

/** Hide admin/test accounts from homepage directory lists (top agents, city agents). */
function isExcludedFromPublicAgentDirectory(a: MarketplaceAgent): boolean {
  if (a.name.trim().toLowerCase() === "ron admin") return true;
  if (a.email.toLowerCase().includes("ron.business101")) return true;
  return false;
}

type AgentRowWithProfile = {
  name?: string | null;
  email?: string | null;
  profiles?: { role?: string | null } | { role?: string | null }[] | null;
};

function shouldIncludeAgentDirectoryRow(row: unknown): boolean {
  const r = row as AgentRowWithProfile;
  const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  if (prof?.role === "admin" || prof?.role === "ops_admin") return false;
  if ((r.name ?? "").trim().toLowerCase() === "ron admin") return false;
  const em = (r.email ?? "").toLowerCase();
  if (em.includes("ron.business101")) return false;
  return true;
}

type AgentHomeExtra = {
  yearsExperience: number | null;
  languagesSpoken: string | null;
  serviceAreaPills: string[];
  followersCount?: number | null;
};

function parseServiceAreasForPills(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Homepage “Specializes in …” line: prefer service areas, then specialty chips, then registration default. */
function specializePillsForHomeCard(
  serviceAreas: string | null | undefined,
  specialties: string | null | undefined,
): string[] {
  const fromAreas = parseServiceAreasForPills(serviceAreas).slice(0, 2);
  if (fromAreas.length > 0) return fromAreas;
  const fromSpecs = parseServiceAreasForPills(specialties).slice(0, 2);
  if (fromSpecs.length > 0) return fromSpecs;
  return parseServiceAreasForPills(DEFAULT_AGENT_SPECIALTIES_COMMAS).slice(0, 2);
}

/** 10.0 scale for score beside name (matches agent directory card). */
function scoreDecimalOnTenHome(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const n = Number(score);
  const onTen = n > 10 ? n / 10 : n;
  if (onTen <= 0) return null;
  return onTen.toFixed(1);
}

function HomeTopAgentCard({
  agent,
  extra,
}: {
  agent: MarketplaceAgent;
  extra?: AgentHomeExtra;
}) {
  const scoreRight = scoreDecimalOnTenHome(agent.score);
  const rawYears = extra?.yearsExperience;
  const experienceLine =
    rawYears != null && Number.isFinite(rawYears) && rawYears >= 0 && rawYears > 0
      ? `${rawYears} ${rawYears === 1 ? "year" : "years"} experience`
      : "New agent";
  const locations = (extra?.serviceAreaPills ?? []).filter(Boolean).slice(0, 2);
  const followersN =
    typeof extra?.followersCount === "number" && Number.isFinite(extra.followersCount) && extra.followersCount >= 0
      ? extra.followersCount
      : null;

  return (
    <div className="group flex min-h-[328px] w-full min-w-[180px] max-w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-md transition-all duration-200 ease-in-out will-change-transform hover:-translate-y-1 hover:scale-[1.02] hover:border-[#2C2C2C]/15 hover:shadow-xl lg:w-[300px]">
      <div className="flex min-h-0 flex-1 flex-col items-center">
        <div className="w-full rounded-2xl bg-[#FAF8F4] px-3 py-4 text-center ring-1 ring-black/5">
          <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-white ring-2 ring-[#D4A843]/25 shadow-sm">
            <AgentAvatarFill name={agent.name} imageUrl={agent.image} sizes="80px" textClassName="text-lg" />
          </div>
          <p className="mt-2 line-clamp-1 text-sm font-semibold text-[#2C2C2C]">{agent.name}</p>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs tabular-nums text-[#2C2C2C]/55">
            <span>{scoreRight ? `⭐ ${scoreRight}` : "⭐ —"}</span>
            {agent.verified ? (
              <span className="inline-flex h-5 items-center justify-center rounded-full bg-[#6B9E6E] px-2 text-[10px] font-semibold text-white">
                Verified
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 w-full space-y-1.5 px-1 text-center">
          <p className="text-[11px] font-semibold text-[#2C2C2C]/55">
            {followersN == null ? "— followers" : `${followersN} ${followersN === 1 ? "follower" : "followers"}`}
          </p>
          <p className="line-clamp-1 text-[11px] font-semibold text-[#2C2C2C]/55">{experienceLine}</p>
          <p className="line-clamp-2 min-h-[2rem] text-[11px] font-semibold leading-snug text-[#2C2C2C]/55">
            {locations.length ? `Specializes in ${locations.join(", ")}` : "Specializes in —"}
          </p>
        </div>
      </div>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className="mt-3 inline-flex w-full shrink-0 items-center justify-center rounded-full border-2 border-[#6B9E6E] bg-white px-4 py-2 text-sm font-semibold text-[#6B9E6E] transition-colors hover:bg-[#6B9E6E]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2"
      >
        View Profile
      </Link>
    </div>
  );
}

/** Fixed hero showcase cards (always Unsplash; links to agent directory). */
const HERO_FLOATING_CARDS = [
  {
    id: "hero-1",
    name: "BGC Luxury Condo",
    location: "BGC, Taguig",
    image_url: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=533&fit=crop&q=80",
  },
  {
    id: "hero-2",
    name: "Makati Penthouse",
    location: "Makati CBD, Makati",
    image_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=533&fit=crop&q=80",
  },
  {
    id: "hero-3",
    name: "Ortigas Modern Home",
    location: "Ortigas Center, Pasig",
    image_url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=533&fit=crop&q=80",
  },
] as const;

function HeroFloatingCardImage({ src, priority, eager }: { src: string; priority: boolean; eager: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]/60 transition-opacity duration-500",
          loaded && "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <Image
        src={src}
        alt=""
        fill
        className={cn(
          "z-[2] object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
        sizes="(max-width: 768px) 100vw, 292px"
        priority={priority}
        loading={eager ? "eager" : "lazy"}
        onLoadingComplete={() => setLoaded(true)}
      />
    </>
  );
}

function FeaturedLocationStripImage({ src, priority, eager }: { src: string; priority: boolean; eager: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]/60 transition-opacity duration-500",
          loaded && "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <Image
        src={src}
        alt=""
        fill
        className={cn(
          "z-[2] object-cover transition-[opacity,transform] duration-500 group-hover:scale-105",
          loaded ? "opacity-100" : "opacity-0",
        )}
        sizes="(min-width: 1024px) 160px, 130px"
        priority={priority}
        loading={eager ? "eager" : "lazy"}
        onLoadingComplete={() => setLoaded(true)}
      />
    </>
  );
}

function FeaturedListingHeroImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!src) {
    return <div className="absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]/60" aria-hidden />;
  }
  const cloud = isCloudinaryDeliveryUrl(src);
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]/60 transition-opacity duration-500",
          loaded && "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized={cloud}
        className={cn("z-[2] object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        sizes="(max-width: 1024px) 100vw, 672px"
        loading="lazy"
        onLoadingComplete={() => setLoaded(true)}
      />
    </>
  );
}

function HeroFloatingPropertyCards() {
  const configs = [
    {
      top: "top-0",
      width: "w-[248px]",
      rotate: "rotate-[5deg]",
      z: "z-10",
      scale: "",
    },
    {
      top: "top-[108px]",
      width: "w-[292px]",
      rotate: "rotate-0",
      z: "z-20",
      scale: "scale-[1.04]",
    },
    {
      top: "top-[238px]",
      width: "w-[248px]",
      rotate: "-rotate-[5deg]",
      z: "z-10",
      scale: "",
    },
  ] as const;

  return (
    <div className="relative mx-auto h-[400px] w-full max-w-[340px]">
      {HERO_FLOATING_CARDS.map((card, idx) => {
        const cfg = configs[idx]!;
        const locShort = card.location.split(",")[0]?.trim() || card.location;
        return (
          <Link
            key={card.id}
            href="/agents"
            className={cn(
              "absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/95 bg-white shadow-[0_18px_40px_-12px_rgba(44,44,44,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-10px_rgba(44,44,44,0.4)]",
              cfg.top,
              cfg.width,
              cfg.rotate,
              cfg.z,
              cfg.scale,
            )}
          >
            <div className="relative aspect-video w-full">
              <HeroFloatingCardImage src={card.image_url} priority={idx < 3} eager={idx < 3} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[#D4A843] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#2C2C2C] shadow-sm">
                Verified
              </span>
            </div>
            <div className="flex items-center gap-2 border-t border-[#2C2C2C]/8 bg-[#FAF8F4] px-3 py-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
              <span className="line-clamp-2 text-left text-xs font-semibold leading-snug text-[#2C2C2C]">
                {locShort}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

type HomePropertyKind = "any" | "condo" | "house" | "townhouse" | "lot";
type TransactionFilter = "any" | "for_sale" | "for_rent";
type FurnishingFilter = "any" | "furnished" | "semi" | "unfurnished";
type AmenityFilterKey =
  | "parking"
  | "pool"
  | "gym"
  | "aircon"
  | "balcony"
  | "elevator"
  | "pet";

type FiltersState = {
  minPrice: number;
  maxPrice: number;
  beds: "any" | 1 | 2 | 3 | 4;
  baths: "any" | 1 | 2 | 3 | 4;
  /** @deprecated Legacy dropdown; chips use {@link FiltersState.homePropertyKind}. Kept for chip label mapping. */
  propertyType: "any" | "House" | "Condo" | "Villa" | "Land" | "Studio" | "Presale";
  homePropertyKind: HomePropertyKind;
  transactionType: TransactionFilter;
  furnishing: FurnishingFilter;
  floorAreaMin: string;
  floorAreaMax: string;
  /** `null` = any featured location; label must match {@link FEATURED_LOCATIONS} entry. */
  locationLabel: string | null;
  amenities: AmenityFilterKey[];
  amenityExtra: { nearSchools: boolean; familyFriendly: boolean };
};

function inferredType(p: DbProperty): FiltersState["propertyType"] {
  if (p.is_presale) return "Presale";
  const loc = `${p.name ?? ""} ${p.location}`.toLowerCase();
  if (p.beds === 0) return "Studio";
  if (loc.includes("penthouse") || loc.includes("condo") || loc.includes("loft") || loc.includes("studio")) return "Condo";
  if (loc.includes("villa") || loc.includes("estate")) return "Villa";
  if (loc.includes("land")) return "Land";
  return "House";
}

const AMENITY_KEYWORD: Record<Exclude<AmenityFilterKey, "pet">, RegExp> = {
  parking: /\b(parking|car\s*park|parking\s*slot)\b/i,
  pool: /\b(pool|swimming)\b/i,
  gym: /\b(gym|fitness)\b/i,
  aircon: /\b(aircon|air[\s-]?con|a\/c|air\s*conditioning)\b/i,
  balcony: /\b(balcony|veranda)\b/i,
  elevator: /\b(elevator|lift)\b/i,
};

function propertyMarketingText(p: DbProperty): string {
  return `${p.name ?? ""} ${p.location} ${p.description ?? ""}`;
}

function parseSqmApprox(raw: string | null | undefined): number | null {
  if (raw == null || typeof raw !== "string") return null;
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function matchesHomePropertyKind(p: DbProperty, kind: HomePropertyKind): boolean {
  if (kind === "any") return true;
  const raw = (p.property_type ?? "").trim().toLowerCase();
  const inf = inferredType(p);
  if (kind === "condo") {
    if (raw.includes("condo") || raw.includes("apartment") || raw.includes("studio")) return true;
    return inf === "Condo" || inf === "Studio" || Boolean(p.is_presale);
  }
  if (kind === "house") {
    if (raw.includes("house") && !raw.includes("townhouse")) return true;
    return inf === "House" || inf === "Villa";
  }
  if (kind === "townhouse") {
    return raw.includes("townhouse") || raw.includes("town house");
  }
  if (kind === "lot") {
    if (raw.includes("lot") || raw.includes("land")) return true;
    return inf === "Land";
  }
  return true;
}

function matchesTransactionFilter(p: DbProperty, tx: TransactionFilter): boolean {
  if (tx === "any") return true;
  const lt = String(p.listing_type ?? "sale");
  const st = p.status;
  if (tx === "for_sale") {
    return (lt === "sale" || lt === "both") && (st === "for_sale" || st === "both");
  }
  if (tx === "for_rent") {
    return (lt === "rent" || lt === "both") && (st === "for_rent" || st === "both");
  }
  return true;
}

function matchesFurnishingFilter(p: DbProperty, f: FurnishingFilter): boolean {
  if (f === "any") return true;
  const text = propertyMarketingText(p);
  if (f === "furnished") {
    return /\bf(?:ully)?\s*furnished\b/i.test(text) || /\bfurnished\b/i.test(text);
  }
  if (f === "semi") return /\bsemi[\s-]?furnished\b/i.test(text);
  if (f === "unfurnished") {
    return /\bunfurnished\b/i.test(text) || /\bbare\b/i.test(text) || /\bun[\s-]?furnished\b/i.test(text);
  }
  return true;
}

function matchesFloorAreaFilter(p: DbProperty, minS: string, maxS: string): boolean {
  const val = parseSqmApprox(p.sqft);
  if (val == null) {
    if (minS.trim() || maxS.trim()) return false;
    return true;
  }
  const minN = minS.trim() ? Number(minS.replace(/,/g, "")) : null;
  const maxN = maxS.trim() ? Number(maxS.replace(/,/g, "")) : null;
  if (minN != null && Number.isFinite(minN) && val < minN) return false;
  if (maxN != null && Number.isFinite(maxN) && val > maxN) return false;
  return true;
}

function propertyMatchesFeaturedLocationByLabel(p: DbProperty, label: string): boolean {
  const entry = FEATURED_LOCATIONS.find((x) => x.label === label);
  if (!entry) return false;
  if ("neighborhood" in entry.match) {
    const v = entry.match.neighborhood ?? "";
    return (p.neighborhood ?? "").trim() === v || p.location.toLowerCase().includes(v.toLowerCase());
  }
  const city = entry.match.city ?? "";
  return (
    propertyCanonicalCity(p).toLowerCase() === city.toLowerCase() ||
    (p.city ?? "").trim().toLowerCase() === city.toLowerCase() ||
    p.location.toLowerCase().includes(city.toLowerCase())
  );
}

function matchesAmenitySelection(p: DbProperty, keys: AmenityFilterKey[], extra: FiltersState["amenityExtra"]): boolean {
  if (extra.nearSchools && !p.near_schools) return false;
  if (extra.familyFriendly && !p.family_friendly) return false;
  if (keys.length === 0) return true;
  const text = propertyMarketingText(p);
  for (const k of keys) {
    if (k === "pet") {
      if (!p.pet_friendly && !/\bpet[\s-]?friendly\b/i.test(text)) return false;
    } else if (!AMENITY_KEYWORD[k].test(text)) return false;
  }
  return true;
}

function formatPesoInputLong(n: number): string {
  if (!Number.isFinite(n)) return "₱ 0";
  return `₱ ${Math.round(n).toLocaleString("en-PH")}`;
}

export type { PropertyEngagement } from "@/hooks/use-property-engagement";

const WELCOME_BANNER_DISMISSED_KEY = "welcome_banner_dismissed";

/** Condensed FAQ for the homepage (foreign buyers & general). Full list lives on `/faq`. */
const HOMEPAGE_FAQ_ITEMS = [
  {
    question: "Can foreigners buy property in the Philippines?",
    answer:
      "Foreign nationals cannot own land in the Philippines but can own condominium units as long as foreign ownership in the building does not exceed 40 percent. They can also own structures built on leased land.",
  },
  {
    question: "What taxes apply when buying property in the Philippines?",
    answer:
      "Buyers typically pay Documentary Stamp Tax of 1.5 percent, Transfer Tax of 0.5 to 0.75 percent, Registration Fee of approximately 0.25 percent, and notarial fees. Sellers pay Capital Gains Tax of 6 percent.",
  },
  {
    question: "What is the difference between a condo and a house and lot?",
    answer:
      "A condominium unit is individual ownership of a unit within a shared building. A house and lot is ownership of both the structure and the land it sits on. Foreigners can own condos but not land.",
  },
  {
    question: "How does BahayGo verify agents?",
    answer:
      "All agents on BahayGo submit their PRC license number, a selfie with their ID, and go through admin approval before being listed. You can identify verified agents by the Verified badge on their profile.",
  },
  {
    question: "Can I rent instead of buy as a foreigner?",
    answer:
      "Yes. Foreigners can freely rent property in the Philippines with no restrictions. Long term leases of up to 50 years renewable for another 25 years are available.",
  },
] as const;

function HomepageFaqSection({
  openFaqIndex,
  setOpenFaqIndex,
  className,
}: {
  openFaqIndex: number | null;
  setOpenFaqIndex: React.Dispatch<React.SetStateAction<number | null>>;
  className?: string;
}) {
  return (
    <section
      className={cn("mx-auto max-w-3xl px-4 pb-16", className)}
      aria-labelledby="homepage-faq-heading"
    >
      <h2 id="homepage-faq-heading" className="text-center font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] md:text-3xl">
        Frequently Asked Questions
      </h2>
      <p className="mt-2 text-center text-sm font-medium text-[#2C2C2C]/70">
        Common questions for buying and renting in the Philippines.
      </p>
      <div className="mt-8">
        {HOMEPAGE_FAQ_ITEMS.map((item, index) => {
          const isOpen = openFaqIndex === index;
          return (
            <div key={item.question} className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
                className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-medium text-[#2C2C2C]"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-[#6B9E6E] transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="pb-4 text-sm leading-relaxed text-[#2C2C2C]/70">{item.answer}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex justify-center">
        <Link
          href="/faq"
          className="inline-flex rounded-full border-2 border-[#6B9E6E] bg-white px-6 py-2.5 text-sm font-semibold text-[#6B9E6E] shadow-sm transition hover:bg-[#6B9E6E]/10"
        >
          View All FAQs
        </Link>
      </div>
    </section>
  );
}

const DynamicHomepageFaq = dynamic(() => Promise.resolve({ default: HomepageFaqSection }), {
  ssr: false,
  loading: () => null,
});

function HomepageTopVerifiedAgentsSection({
  topAgents,
  topAgentsRef,
  scrollRow,
  agentHomeExtrasById,
}: {
  topAgents: MarketplaceAgent[];
  topAgentsRef: React.RefObject<HTMLDivElement | null>;
  scrollRow: (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => void;
  agentHomeExtrasById: Record<string, AgentHomeExtra>;
}) {
  return (
    <section className="mt-12">
      <div>
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#2C2C2C]">Top Verified Agents This Week</h2>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">High scores, fast responses, proven closings</p>
      </div>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-4">
        <div className="flex min-w-0 flex-1 items-stretch gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => scrollRow(topAgentsRef, "prev")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div
            ref={topAgentsRef}
            className="min-w-0 flex-1 overflow-x-auto px-4 pb-2 scrollbar-hide"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex w-max flex-nowrap gap-4 md:gap-4">
              {topAgents.map((a) => (
                <HomeTopAgentCard key={a.id} agent={a} extra={agentHomeExtrasById[a.id]} />
              ))}
              {topAgents.length < 4 ? <MoreAgentsComingSoonCard /> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollRow(topAgentsRef, "next")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="hidden w-full max-w-[320px] shrink-0 lg:block">
          <AgentScoreTutorialCard />
        </div>
      </div>
      <div className="mt-4 lg:hidden">
        <AgentScoreTutorialCard compact />
      </div>
    </section>
  );
}

const DynamicHomepageTopAgents = dynamic(
  () => Promise.resolve({ default: HomepageTopVerifiedAgentsSection }),
  { ssr: false, loading: () => null },
);

export function BahayGoHomeMarketplace({ listingMode }: { listingMode: "buy" | "rent" | "all" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [welcomeBannerVisible, setWelcomeBannerVisible] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [viewerVerifiedListingAgent, setViewerVerifiedListingAgent] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setViewerVerifiedListingAgent(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from("agents")
      .select("status, verification_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { status?: string | null; verification_status?: string | null } | null;
        setViewerVerifiedListingAgent(
          Boolean(row?.status === "approved" && row?.verification_status === "verified"),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(WELCOME_BANNER_DISMISSED_KEY) === "true") return;
    } catch {
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("welcome") !== "true" || !user) return;
    setWelcomeBannerVisible(true);
    router.replace("/");
  }, [user, router]);

  const mode = listingMode;
  const listingTypeFilter: "sale" | "rent" | null = mode === "buy" ? "sale" : mode === "rent" ? "rent" : null;
  const [search, setSearch] = useState("");
  const [listingViewMode, setListingViewMode] = useState<"browse" | "results">("browse");

  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [featuredHomeProperty, setFeaturedHomeProperty] = useState<DbProperty | null>(null);
  const [featuredHomeIsAdminFeatured, setFeaturedHomeIsAdminFeatured] = useState(false);
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [agentHomeExtrasById, setAgentHomeExtrasById] = useState<Record<string, AgentHomeExtra>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<
    | { type: "neighborhood" | "city"; value: string; label: string }
    | null
  >(null);
  const [selectedPropertyType, setSelectedPropertyType] = useState<string | null>(null);
  const [featuredLocationCounts, setFeaturedLocationCounts] = useState<Record<string, number>>({});
  const [propertyTypeCounts, setPropertyTypeCounts] = useState<{ property_type: string; count: number }[]>([]);
  const [locationCuratedRows, setLocationCuratedRows] = useState<
    { key: string; title: string; subtitle: string; items: DbProperty[]; featured?: boolean }[]
  >([]);
  const [locationCuratedLoading, setLocationCuratedLoading] = useState(false);
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filters, setFilters] = useState<FiltersState>({
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
  });
  const [cardRoomIdx, setCardRoomIdx] = useState<Record<string, number>>({});
  const [zoomProperty, setZoomProperty] = useState<DbProperty | null>(null);

  const { engagement, likeCountsByPropertyId } = usePropertyEngagementForProperties(properties);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const topAgentsRef = useRef<HTMLDivElement | null>(null);
  const featuredLocationsScrollRef = useRef<HTMLDivElement | null>(null);
  const featuredLocationsSetWidthPxRef = useRef(0);
  const featuredLocationsLoopReadyRef = useRef(false);
  const featuredLocationsJumpGuardRef = useRef(false);
  /** When not false, next commit should sync the marketplace URL from a featured-location card click. */
  const pendingFeaturedLocationUrlSyncRef = useRef<string | false>(false);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    const selectQ = `
          id, created_at, name, location, region, city, neighborhood, price, rent_price, listing_type, sqft, beds, baths, image_url, status, listed_by, description, property_type,
          is_presale, developer_name, turnover_date, unit_types, deleted_at, availability_state,
          property_photos (url, sort_order, created_at),
          property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, listing_tier, updated_at, brokers (id, company_name, logo_url), profiles(email, phone)))
        `;
    const expiryOr = publicListingExpiryOrFilter();
    const featuredCityRow = neighborhoodFilter
      ? FEATURED_CITIES.find((c) => c.key === neighborhoodFilter)
      : null;
    const cityOrClause =
      featuredCityRow != null
        ? `city.ilike.%${featuredCityRow.label}%,location.ilike.%${featuredCityRow.label}%`
        : null;

    let mainQuery = supabase
      .from("properties")
      .select(selectQ)
      .or(expiryOr)
      .or(hideTutorialDemoPropertiesOrFilter())
      .is("deleted_at", null)
      .or("availability_state.eq.available,availability_state.is.null");
    if (listingTypeFilter) mainQuery = mainQuery.eq("listing_type", listingTypeFilter);
    if (cityOrClause) mainQuery = mainQuery.or(cityOrClause);
    mainQuery = mainQuery.order("created_at", { ascending: false });

    let featQuery = supabase
      .from("properties")
      .select(selectQ)
      .eq("featured", true)
      .or(expiryOr)
      .or(hideTutorialDemoPropertiesOrFilter())
      .is("deleted_at", null)
      .or("availability_state.eq.available,availability_state.is.null");
    if (listingTypeFilter) featQuery = featQuery.eq("listing_type", listingTypeFilter);
    if (cityOrClause) featQuery = featQuery.or(cityOrClause);
    featQuery = featQuery.limit(1);

    const [mainRes, featRes] = await Promise.all([mainQuery, featQuery.maybeSingle()]);

    if (mainRes.error) {
      setError(mainRes.error.message);
      setProperties([]);
      setFeaturedHomeProperty(null);
      setFeaturedHomeIsAdminFeatured(false);
    } else {
      const list = (mainRes.data ?? []) as unknown as DbProperty[];
      setProperties(list);
      let featured: DbProperty | null = null;
      let isAdminFeatured = false;
      if (!featRes.error && featRes.data) {
        featured = featRes.data as unknown as DbProperty;
        isAdminFeatured = true;
      } else if (list.length > 0) {
        featured = list[0];
      }
      setFeaturedHomeProperty(featured);
      setFeaturedHomeIsAdminFeatured(isAdminFeatured);
    }
    setLoading(false);
  }, [neighborhoodFilter, listingTypeFilter]);

  const loadAgentsDirectory = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("agents")
      .select("*, brokers(*), profiles!inner(email, phone, role)")
      .eq("status", "approved")
      .eq("verified", true)
      .eq("profiles.role", "agent")
      .neq("name", "Ron Admin");
    if (!fetchErr) {
      const filtered = (data ?? []).filter(shouldIncludeAgentDirectoryRow);
      const extras: Record<string, AgentHomeExtra> = {};
      for (const row of filtered) {
        const r = row as {
          id?: string | null;
          years_experience?: number | string | null;
          languages_spoken?: string | null;
          service_areas?: string | null;
          specialties?: string | null;
        };
        const id = String(r.id ?? "");
        if (!id) continue;
        const rawY = r.years_experience;
        const yearsN =
          typeof rawY === "number"
            ? rawY
            : rawY != null && String(rawY).trim() !== ""
              ? Number(rawY)
              : NaN;
        const yearsExperience = Number.isFinite(yearsN) && yearsN >= 0 ? yearsN : null;
        extras[id] = {
          yearsExperience,
          languagesSpoken:
            typeof r.languages_spoken === "string" && r.languages_spoken.trim() ? r.languages_spoken.trim() : null,
          serviceAreaPills: specializePillsForHomeCard(r.service_areas, r.specialties),
        };
      }
      // Preserve async follower counts already fetched for top agents.
      setAgentHomeExtrasById((prev) => {
        const merged: Record<string, AgentHomeExtra> = { ...prev };
        for (const [id, nextExtra] of Object.entries(extras)) {
          merged[id] = {
            ...nextExtra,
            followersCount: prev[id]?.followersCount ?? nextExtra.followersCount,
          };
        }
        return merged;
      });
      setAgents(
        filtered
          .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]))
          .filter((a) => !isExcludedFromPublicAgentDirectory(a)),
      );
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    void loadAgentsDirectory();
  }, [loadAgentsDirectory]);

  const clearGeoFilters = useCallback(() => {
    setSelectedLocation(null);
    setSelectedPropertyType(null);
    setPropertyTypeCounts([]);
  }, []);

  const refreshFeaturedLocationCounts = useCallback(async () => {
    const statusIn = mode === "buy" ? ["for_sale", "both"] : mode === "rent" ? ["for_rent", "both"] : ["for_sale", "for_rent", "both"];
    const rows = await Promise.all(
      FEATURED_LOCATIONS.map(async (loc) => {
        const field = "neighborhood" in loc.match ? "neighborhood" : "city";
        const value = (loc.match as { neighborhood?: string; city?: string })[field] ?? "";
        let q = supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .or(hideTutorialDemoPropertiesOrFilter())
          .or("availability_state.eq.available,availability_state.is.null")
          .in("status", statusIn);
        if (listingTypeFilter) q = q.eq("listing_type", listingTypeFilter);
        q = field === "neighborhood" ? q.eq("neighborhood", value) : q.eq("city", value);
        const { count, error } = await q;
        return { label: loc.label, count: error ? 0 : count ?? 0 };
      }),
    );
    const next: Record<string, number> = {};
    for (const r of rows) next[r.label] = r.count;
    setFeaturedLocationCounts(next);
  }, [listingTypeFilter, mode]);

  const refreshPropertyTypeCounts = useCallback(
    async (sel: { type: "neighborhood" | "city"; value: string; label: string } | null) => {
      if (!sel) {
        setPropertyTypeCounts([]);
        return;
      }
      const statusIn = mode === "buy" ? ["for_sale", "both"] : mode === "rent" ? ["for_rent", "both"] : ["for_sale", "for_rent", "both"];
      let q = supabase
        .from("properties")
        .select("property_type")
        .is("deleted_at", null)
        .or(hideTutorialDemoPropertiesOrFilter())
        .or("availability_state.eq.available,availability_state.is.null")
        .in("status", statusIn);
      if (listingTypeFilter) q = q.eq("listing_type", listingTypeFilter);
      q = sel.type === "neighborhood" ? q.eq("neighborhood", sel.value) : q.eq("city", sel.value);
      const { data, error } = await q;
      if (error) {
        setPropertyTypeCounts([]);
        return;
      }
      const m = new Map<string, number>();
      for (const row of (data ?? []) as { property_type?: string | null }[]) {
        const t = String(row.property_type ?? "").trim();
        if (!t) continue;
        m.set(t, (m.get(t) ?? 0) + 1);
      }
      const list = [...m.entries()]
        .map(([property_type, count]) => ({ property_type, count }))
        .sort((a, b) => b.count - a.count);
      setPropertyTypeCounts(list);
    },
    [listingTypeFilter, mode],
  );

  useEffect(() => {
    void refreshFeaturedLocationCounts();
  }, [refreshFeaturedLocationCounts]);

  useEffect(() => {
    void refreshPropertyTypeCounts(selectedLocation);
  }, [selectedLocation, refreshPropertyTypeCounts]);

  const loadCuratedRowsForLocation = useCallback(async () => {
    if (!selectedLocation) {
      setLocationCuratedRows([]);
      setLocationCuratedLoading(false);
      return;
    }
    setLocationCuratedLoading(true);
    try {
      const configKey = selectedLocation.type === "neighborhood" ? selectedLocation.value : selectedLocation.value;
      const cfgMode = mode === "buy" ? "buy" : "rent";
      const rowCfgs =
        LOCATION_ROW_CONFIG[cfgMode][configKey] ?? DEFAULT_LOCATION_ROWS(cfgMode, selectedLocation.label);
      const statusIn =
        mode === "buy"
          ? (["for_sale", "both"] as const)
          : mode === "rent"
            ? (["for_rent", "both"] as const)
            : (["for_sale", "for_rent", "both"] as const);

      const selectQ = `
          id, created_at, name, location, region, city, neighborhood, price, rent_price, listing_type, sqft, beds, baths, image_url, status, listed_by, description, property_type,
          is_presale, developer_name, turnover_date, unit_types, deleted_at, availability_state, featured,
          property_photos (url, sort_order, created_at),
          property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, listing_tier, updated_at, brokers (id, company_name, logo_url), profiles(email, phone)))
        `;

      const fetchRow = async (cfg: RowConfig) => {
        const limit = cfg.filter.limit ?? 12;
        if (cfg.filter.sortBy === "views_desc") {
          return [] as DbProperty[];
        }

        const softOverfetch = Math.max(limit * 6, 120);

        const statusForRow: readonly string[] = statusIn;

        let q = supabase
          .from("properties")
          .select(selectQ)
          .is("deleted_at", null)
          .or(hideTutorialDemoPropertiesOrFilter())
          .or("availability_state.eq.available,availability_state.is.null")
          .in("status", [...statusForRow]);
        if (listingTypeFilter) q = q.eq("listing_type", listingTypeFilter);

        q =
          selectedLocation.type === "neighborhood"
            ? q.eq("neighborhood", selectedLocation.value)
            : q.eq("city", selectedLocation.value);

        if (selectedPropertyType) {
          q = q.eq("property_type", selectedPropertyType);
        }
        if (cfg.filter.sales_status) {
          q = q.eq("sales_status", cfg.filter.sales_status);
        }
        if (!listingTypeFilter && cfg.filter.listing_type) {
          q = q.eq("listing_type", cfg.filter.listing_type);
        }
        if (cfg.filter.pet_friendly === true) {
          q = q.eq("pet_friendly", true);
        }
        if (cfg.filter.family_friendly === true) {
          q = q.eq("family_friendly", true);
        }
        if (cfg.filter.near_schools === true) {
          q = q.eq("near_schools", true);
        }
        if (cfg.filter.bedrooms !== undefined) {
          q = q.eq("beds", cfg.filter.bedrooms);
        }
        if (cfg.filter.bedrooms_gte !== undefined) {
          q = q.gte("beds", cfg.filter.bedrooms_gte);
        }

        q = q.order("created_at", { ascending: false }).limit(softOverfetch);

        const { data, error } = await q;
        if (error) return [] as DbProperty[];
        let items = (data ?? []) as unknown as DbProperty[];

        if (cfg.filter.min_price != null || cfg.filter.max_price != null) {
          items = items.filter((p) => passesLocationRowPriceFilter(p, cfg.filter, mode));
        }

        const tier = cfg.filter.listingTier;
        if (tier && tier.length > 0) {
          const allowed = new Set(tier);
          items = items.filter((p) => {
            const pas = (p.property_agents ?? []) as { agent?: unknown }[];
            for (const pa of pas) {
              const ag = pa?.agent as { listing_tier?: string | null } | undefined;
              const t = String(ag?.listing_tier ?? "").trim() as "featured" | "broker" | "";
              if (t && allowed.has(t)) return true;
            }
            return false;
          });
        }

        if (cfg.filter.sortBy === "likes_desc") {
          items = [...items].sort(
            (a, b) => (likeCountsByPropertyId[b.id] ?? 0) - (likeCountsByPropertyId[a.id] ?? 0),
          );
        }
        if (cfg.filter.sortBy === "price_asc" || cfg.filter.sortBy === "price_desc") {
          const dir = cfg.filter.sortBy === "price_asc" ? 1 : -1;
          items = [...items].sort((a, b) => {
            const na = listingPriceForMode(a, mode) ?? Number.POSITIVE_INFINITY;
            const nb = listingPriceForMode(b, mode) ?? Number.POSITIVE_INFINITY;
            return dir * (na - nb);
          });
        }

        items = items.slice(0, limit);
        return items;
      };

      const results = await Promise.all(rowCfgs.map(async (cfg) => ({ cfg, items: await fetchRow(cfg) })));
      const seen = new Set<string>();
      const visible = results
        .map((r, idx) => {
          if (idx === 0) {
            for (const p of r.items) seen.add(p.id);
            return r;
          }
          const filtered = r.items.filter((p) => !seen.has(p.id));
          if (filtered.length < 3) return { ...r, items: [] as DbProperty[] };
          for (const p of filtered) seen.add(p.id);
          return { ...r, items: filtered };
        })
        .filter((r) => r.items.length > 0)
        .map((r) => ({
          key: r.cfg.id,
          title: r.cfg.label,
          subtitle: "",
          items: r.items,
          featured: r.cfg.filter.listingTier?.includes("featured") ?? false,
        }));
      setLocationCuratedRows(visible);
    } finally {
      setLocationCuratedLoading(false);
    }
  }, [mode, selectedLocation, selectedPropertyType, likeCountsByPropertyId]);

  useEffect(() => {
    void loadCuratedRowsForLocation();
  }, [loadCuratedRowsForLocation]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadProperties();
        void loadAgentsDirectory();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadProperties, loadAgentsDirectory]);

  const syncMarketplaceUrl = useCallback(
    (qText: string) => {
      const trimmed = qText.trim();
      const locationsSeg = pathname?.startsWith("/locations/")
        ? (pathname.slice("/locations/".length).split("/")[0] ?? "")
        : "";
      const locationsPath =
        pathname?.startsWith("/locations/") && resolveFeaturedCitySlugToKey(locationsSeg) != null
          ? pathname
          : null;
      const path = locationsPath ?? (mode === "buy" ? "/buy" : "/");
      if (!trimmed) {
        router.replace(path, { scroll: false });
        return;
      }
      const params = new URLSearchParams();
      params.set("q", trimmed);
      params.set("type", mode === "buy" ? "sale" : "rent");
      router.replace(`${path}?${params.toString()}`, { scroll: false });
    },
    [mode, router, pathname],
  );

  useEffect(() => {
    if (pendingFeaturedLocationUrlSyncRef.current === false) return;
    const q = pendingFeaturedLocationUrlSyncRef.current;
    pendingFeaturedLocationUrlSyncRef.current = false;
    syncMarketplaceUrl(q);
  }, [neighborhoodFilter, search, syncMarketplaceUrl]);

  const applyLocationSearch = useCallback(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setNeighborhoodFilter(null);
      setListingViewMode("browse");
      syncMarketplaceUrl("");
      return;
    }
    const nk = resolveFeaturedKeyFromQuery(trimmed);
    setNeighborhoodFilter(nk);
    setListingViewMode(nk ? "browse" : "results");
    syncMarketplaceUrl(trimmed);
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [search, syncMarketplaceUrl]);

  useEffect(() => {
    const type = searchParams.get("type");
    if (mode === "buy" && type === "rent") {
      const p = new URLSearchParams(searchParams.toString());
      p.set("type", "rent");
      router.replace(`/?${p.toString()}`, { scroll: false });
      return;
    }
    if (mode === "rent" && type === "sale") {
      const p = new URLSearchParams(searchParams.toString());
      p.set("type", "sale");
      router.replace(`/buy?${p.toString()}`, { scroll: false });
      return;
    }

    const sp = new URLSearchParams(searchParams.toString());
    if (!sp.has("q")) {
      if (pathname?.startsWith("/locations/")) {
        const seg = decodeURIComponent(pathname.slice("/locations/".length).split("/")[0] ?? "");
        const keyFromPath = resolveFeaturedCitySlugToKey(seg);
        if (keyFromPath) {
          const city = FEATURED_CITIES.find((c) => c.key === keyFromPath);
          if (city) {
            setSearch(city.label);
            setNeighborhoodFilter(keyFromPath);
            setListingViewMode("browse");
            return;
          }
        }
      }
      setSearch("");
      setNeighborhoodFilter(null);
      setListingViewMode("browse");
      return;
    }
    const raw = sp.get("q") ?? "";
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    setSearch(decoded);
    const featuredKey = decoded.trim() ? resolveFeaturedKeyFromQuery(decoded) : null;
    setNeighborhoodFilter(featuredKey);
    if (decoded.trim()) setListingViewMode(featuredKey ? "browse" : "results");
  }, [searchParams, mode, router, pathname]);

  const directoryAgentIds = useMemo(() => agents.map((a) => a.id), [agents]);
  const mergeLiveAvailability = useAgentLiveAvailabilityFromPropertyRows(properties, directoryAgentIds);

  const allConnectedAgentsByPropertyId = useMemo(() => {
    const m = new Map<string, MarketplaceAgent[]>();
    for (const p of properties) {
      const nested = (p.property_agents ?? [])
        .map((x) => (x as { agent?: unknown }).agent)
        .filter(Boolean)
        .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]))
        .map(mergeLiveAvailability);
      const dedup = new Map(nested.map((a) => [a.id, a]));
      m.set(p.id, [...dedup.values()]);
    }
    return m;
  }, [properties, mergeLiveAvailability]);

  const baseModeProperties = useMemo(() => {
    const base = properties.filter((p) => {
      if (listingTypeFilter) {
        return p.listing_type === listingTypeFilter;
      }
      return true;
    });
    if (neighborhoodFilter) {
      const city = FEATURED_CITIES.find((c) => c.key === neighborhoodFilter);
      if (city) return base.filter((p) => city.match(propertyCanonicalCity(p)));
      return base.filter((p) => neighborhoodKey(p.location) === neighborhoodFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => p.location.toLowerCase().includes(q));
  }, [listingTypeFilter, neighborhoodFilter, properties, search]);

  const filteredAllRows = useMemo(() => {
    return baseModeProperties.filter((p) => {
      const price = effectiveListingPriceForMode(p, mode);
      if (price < filters.minPrice || price > filters.maxPrice) return false;
      if (filters.beds !== "any") {
        if (filters.beds === 4) {
          if (p.beds < 4) return false;
        } else if (p.beds !== filters.beds) return false;
      }
      if (filters.baths !== "any") {
        if (filters.baths === 4) {
          if (p.baths < 4) return false;
        } else if (p.baths !== filters.baths) return false;
      }
      if (!matchesHomePropertyKind(p, filters.homePropertyKind)) return false;
      if (!matchesTransactionFilter(p, filters.transactionType)) return false;
      if (!matchesFurnishingFilter(p, filters.furnishing)) return false;
      if (!matchesFloorAreaFilter(p, filters.floorAreaMin, filters.floorAreaMax)) return false;
      if (filters.locationLabel && !propertyMatchesFeaturedLocationByLabel(p, filters.locationLabel)) return false;
      if (!matchesAmenitySelection(p, filters.amenities, filters.amenityExtra)) return false;
      return true;
    });
  }, [baseModeProperties, filters, mode]);

  const sortedAllRows = useMemo(() => {
    const list = [...filteredAllRows];
    list.sort((a, b) => {
      if (sortMode === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortMode === "most_beds") return (b.beds ?? 0) - (a.beds ?? 0);
      const pa = effectiveListingPriceForMode(a, mode);
      const pb = effectiveListingPriceForMode(b, mode);
      if (sortMode === "price_low") return pa - pb;
      if (sortMode === "price_high") return pb - pa;
      return 0;
    });
    return list;
  }, [filteredAllRows, sortMode, mode]);

  const geoFilterActive = selectedLocation != null || selectedPropertyType != null;

  const propertyTrustScoreById = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of properties) {
      const agents = allConnectedAgentsByPropertyId.get(p.id) ?? [];
      const avg = agents.length ? agents.reduce((s, a) => s + (a.score ?? 0), 0) / agents.length : 0;
      m.set(p.id, avg);
    }
    return m;
  }, [properties, allConnectedAgentsByPropertyId]);

  const featuredPicks = useMemo(() => {
    const list = [...sortedAllRows];
    list.sort((a, b) => (propertyTrustScoreById.get(b.id) ?? 0) - (propertyTrustScoreById.get(a.id) ?? 0));
    return list.slice(0, 12);
  }, [sortedAllRows, propertyTrustScoreById]);

  const presaleDevelopments = useMemo(
    () => sortedAllRows.filter((p) => p.is_presale),
    [sortedAllRows],
  );

  /** Non-presale for-sale listings (maps to listing_type sale / status for_sale). */
  const forSaleListings = useMemo(
    () =>
      [...sortedAllRows]
        .filter((p) => !p.is_presale)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sortedAllRows],
  );

  const newlyListedRentals = useMemo(() => {
    const list = [...sortedAllRows];
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [sortedAllRows]);

  const defaultHomepageList = useMemo(() => {
    const list = [...baseModeProperties];
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [baseModeProperties]);

  const metroManilaSet = useMemo(() => {
    return new Set(
      [
        "manila",
        "makati",
        "taguig",
        "pasig",
        "mandaluyong",
        "quezon city",
        "pasay",
        "paranaque",
        "parañaque",
        "las piñas",
        "las pinas",
        "muntinlupa",
        "san juan",
        "caloocan",
      ].map((x) => x.toLowerCase()),
    );
  }, []);

  const defaultHomepageRows = useMemo(() => {
    const byType = (t: string) => (p: DbProperty) => String(p.property_type ?? "").trim().toLowerCase() === t.toLowerCase();
    const byBeds = (n: number) => (p: DbProperty) => p.beds === n;
    const byBedsGte = (n: number) => (p: DbProperty) => p.beds >= n;
    const priceN = (p: DbProperty) => (mode === "buy" ? parsePriceToNumber(p.price) : parsePriceToNumber(p.rent_price));
    const within = (min?: number, max?: number) => (p: DbProperty) => {
      const n = priceN(p);
      if (n == null) return false;
      if (min != null && n < min) return false;
      if (max != null && n > max) return false;
      return true;
    };

    const trending = [...defaultHomepageList].sort(
      (a, b) => (likeCountsByPropertyId[b.id] ?? 0) - (likeCountsByPropertyId[a.id] ?? 0),
    );

    const metroManilaNewest = defaultHomepageList.filter((p) => {
      const city = String(p.city ?? "").trim().toLowerCase();
      if (city && metroManilaSet.has(city)) return true;
      const loc = String(p.location ?? "").toLowerCase();
      return (
        loc.includes("manila") ||
        loc.includes("makati") ||
        loc.includes("taguig") ||
        loc.includes("pasig") ||
        loc.includes("mandaluyong") ||
        loc.includes("quezon") ||
        loc.includes("pasay") ||
        loc.includes("parañaque") ||
        loc.includes("paranaque") ||
        loc.includes("las piñas") ||
        loc.includes("las pinas") ||
        loc.includes("muntinlupa") ||
        loc.includes("san juan")
      );
    });

    const shown = (items: DbProperty[], n = 12) => items.slice(0, n);

    if (mode === "buy") {
      return [
        { key: "buy-featured", title: "Featured Picks (for sale)", subtitle: "Recommended for you", items: shown(featuredPicks, 8), featured: true },
        { key: "buy-new", title: "Newly Listed for Sale", subtitle: "Newest listings first", items: shown(defaultHomepageList) },
        { key: "buy-trending", title: "Trending listings for sale", subtitle: "Most liked right now", items: shown(trending) },
        { key: "buy-houses", title: "Single Family Homes for Sale", subtitle: "Houses on the market", items: shown(defaultHomepageList.filter(byType("House"))) },
        { key: "buy-condos", title: "Condos for Sale", subtitle: "Condo inventory, newest first", items: shown(defaultHomepageList.filter(byType("Condo"))) },
        { key: "buy-presale", title: "Presale condos", subtitle: "New projects & pre-selling inventory", items: shown(defaultHomepageList.filter((p) => p.sales_status === "Presale")) },
        { key: "buy-rfo", title: "Ready for Occupancy condos", subtitle: "Move-in ready listings", items: shown(defaultHomepageList.filter((p) => p.sales_status === "RFO")) },
        { key: "buy-resale", title: "Resale condos", subtitle: "Existing unit resales", items: shown(defaultHomepageList.filter((p) => p.sales_status === "Resale")) },
        { key: "buy-affordable", title: "Affordable condos (under ₱5M)", subtitle: "Budget-friendly finds", items: shown(defaultHomepageList.filter(within(undefined, 5_000_000)).filter(byType("Condo"))) },
        { key: "buy-luxury", title: "Luxury homes (₱20M+)", subtitle: "Premium inventory", items: shown(defaultHomepageList.filter(within(20_000_000))) },
        { key: "buy-townhouses", title: "Townhouses for Sale", subtitle: "Townhouse listings", items: shown(defaultHomepageList.filter(byType("Townhouse"))) },
        { key: "buy-lots", title: "Lots for Sale", subtitle: "Land & lots", items: shown(defaultHomepageList.filter((p) => byType("Lot")(p) || byType("Land")(p))) },
        { key: "buy-studios", title: "Studios for Sale", subtitle: "Studio units", items: shown(defaultHomepageList.filter(byBeds(0))) },
        { key: "buy-bed1", title: "1-bedroom for Sale", subtitle: "1BR units", items: shown(defaultHomepageList.filter(byBeds(1))) },
        { key: "buy-bed2", title: "2-bedroom for Sale", subtitle: "2BR units", items: shown(defaultHomepageList.filter(byBeds(2))) },
        { key: "buy-bed3p", title: "3+ bedroom for Sale", subtitle: "Bigger homes", items: shown(defaultHomepageList.filter(byBedsGte(3))) },
        { key: "buy-pet", title: "Pet-friendly homes for sale", subtitle: "Agent-marked pet-friendly", items: shown(defaultHomepageList.filter((p) => p.pet_friendly)) },
        { key: "buy-family", title: "Family-friendly homes for sale", subtitle: "Agent-marked family-friendly", items: shown(defaultHomepageList.filter((p) => p.family_friendly)) },
        { key: "buy-schools", title: "Near schools (for sale)", subtitle: "Agent-marked near schools", items: shown(defaultHomepageList.filter((p) => p.near_schools)) },
        { key: "buy-mm", title: "Newest in Metro Manila for sale", subtitle: "Newest listings in Metro Manila", items: shown(metroManilaNewest) },
      ];
    }

    return [
      { key: "rent-featured", title: "Featured Picks (rentals)", subtitle: "Recommended for you", items: shown(featuredPicks, 8), featured: true },
      { key: "rent-new", title: "Newly Listed Rentals", subtitle: "Newest rentals first", items: shown(newlyListedRentals) },
      { key: "rent-trending", title: "Trending Rentals", subtitle: "Most liked right now", items: shown(trending) },
      { key: "rent-houses", title: "Single Family Homes for Rent", subtitle: "Houses for rent", items: shown(defaultHomepageList.filter(byType("House"))) },
      { key: "rent-condos", title: "Condos for Rent", subtitle: "Condo rentals", items: shown(defaultHomepageList.filter(byType("Condo"))) },
      { key: "rent-pet", title: "Pet-friendly rentals", subtitle: "Agent-marked pet-friendly", items: shown(defaultHomepageList.filter((p) => p.pet_friendly)) },
      { key: "rent-family", title: "Family-friendly rentals", subtitle: "Agent-marked family-friendly", items: shown(defaultHomepageList.filter((p) => p.family_friendly)) },
      { key: "rent-schools", title: "Near schools (rentals)", subtitle: "Agent-marked near schools", items: shown(defaultHomepageList.filter((p) => p.near_schools)) },
      { key: "rent-affordable", title: "Affordable rentals (under ₱25,000/mo)", subtitle: "Great value picks", items: shown(defaultHomepageList.filter(within(undefined, 25_000))) },
      { key: "rent-luxury", title: "Luxury rentals (₱60,000+/mo)", subtitle: "Premium rentals", items: shown(defaultHomepageList.filter(within(60_000))) },
      { key: "rent-townhouses", title: "Townhouses for Rent", subtitle: "Townhouse rentals", items: shown(defaultHomepageList.filter(byType("Townhouse"))) },
      { key: "rent-apartments", title: "Apartments for Rent", subtitle: "Apartment rentals", items: shown(defaultHomepageList.filter(byType("Apartment"))) },
      { key: "rent-studios", title: "Studios for Rent", subtitle: "Studio rentals", items: shown(defaultHomepageList.filter(byBeds(0))) },
      { key: "rent-bed1", title: "1-bedroom rentals", subtitle: "1BR rentals", items: shown(defaultHomepageList.filter(byBeds(1))) },
      { key: "rent-bed2", title: "2-bedroom rentals", subtitle: "2BR rentals", items: shown(defaultHomepageList.filter(byBeds(2))) },
      { key: "rent-bed3p", title: "3+ bedroom rentals", subtitle: "Bigger rentals", items: shown(defaultHomepageList.filter(byBedsGte(3))) },
      { key: "rent-mm", title: "Newest in Metro Manila", subtitle: "Newest rentals in Metro Manila", items: shown(metroManilaNewest) },
    ];
  }, [baseModeProperties, defaultHomepageList, featuredPicks, likeCountsByPropertyId, metroManilaSet, mode, newlyListedRentals]);

  const bgcListings = useMemo(() => {
    return sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("bgc") || l.includes("taguig");
    });
  }, [sortedAllRows]);

  const makatiListings = useMemo(() => {
    return sortedAllRows.filter((p) => p.location.toLowerCase().includes("makati"));
  }, [sortedAllRows]);

  const luxury50m = useMemo(() => sortedAllRows.filter((p) => parsePesoToNumber(p.price) > 50_000_000), [sortedAllRows]);

  const nearSchoolsParks = useMemo(() => {
    const list = sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("forbes") || l.includes("quezon") || l.includes("san juan") || l.includes("makati");
    });
    return list;
  }, [sortedAllRows]);

  const pickMockSubset = (seed: string) => {
    return sortedAllRows.filter((p) => {
      let h = 0;
      const s = `${seed}-${p.id}`;
      for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 101;
      return h % 3 === 0;
    });
  };

  const petFriendly = useMemo(() => pickMockSubset("pet"), [sortedAllRows]);
  const gated = useMemo(() => pickMockSubset("gated"), [sortedAllRows]);
  const openHouse = useMemo(() => pickMockSubset("openhouse"), [sortedAllRows]);
  const deals = useMemo(() => pickMockSubset("deals"), [sortedAllRows]);

  const rentPetFriendly = useMemo(() => pickMockSubset("rent-pet"), [sortedAllRows]);
  const furnished = useMemo(() => pickMockSubset("furnished"), [sortedAllRows]);
  const nearBD = useMemo(() => {
    return sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("bgc") || l.includes("makati") || l.includes("ortigas");
    });
  }, [sortedAllRows]);
  const studiosCondos = useMemo(() => sortedAllRows.filter((p) => p.beds <= 1), [sortedAllRows]);
  const shortTerm = useMemo(() => pickMockSubset("shortterm"), [sortedAllRows]);
  const familyRent = useMemo(() => sortedAllRows.filter((p) => p.beds >= 3), [sortedAllRows]);

  const topAgents = useMemo(
    () =>
      [...agents]
        .map(mergeLiveAvailability)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    [agents, mergeLiveAvailability],
  );

  const topAgentsKey = useMemo(() => topAgents.map((a) => a.id).join(","), [topAgents]);

  useEffect(() => {
    if (!topAgents.length) return;
    let cancelled = false;
    void (async () => {
      const ids = topAgents.map((a) => a.id).filter(Boolean);
      const rows = await Promise.all(
        ids.map(async (agentId) => {
          const { count, error: cErr } = await supabase
            .from("agent_followers")
            .select("id", { count: "exact", head: true })
            .eq("agent_id", agentId);
          return { agentId, count: cErr ? null : count ?? 0 };
        }),
      );
      if (cancelled) return;
      setAgentHomeExtrasById((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          const existing = next[r.agentId] ?? { yearsExperience: null, languagesSpoken: null, serviceAreaPills: [] };
          next[r.agentId] = { ...existing, followersCount: r.count };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [topAgentsKey]);

  const cityFilterMeta = useMemo(
    () =>
      neighborhoodFilter ? FEATURED_CITIES.find((c) => c.key === neighborhoodFilter) ?? null : null,
    [neighborhoodFilter],
  );

  const browseRowTitleSuffix = cityFilterMeta ? ` in ${cityFilterMeta.label}` : undefined;

  const agentsForCityFilter = useMemo(() => {
    if (!cityFilterMeta) return [];
    return agents
      .map(mergeLiveAvailability)
      .filter((a) => {
        const t = a.serviceAreasText?.trim();
        if (!t) return false;
        return cityFilterMeta.matchServiceArea(t);
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [agents, cityFilterMeta, mergeLiveAvailability]);
  const featuredPhotos = useMemo(
    () => (featuredHomeProperty ? roomUrlsFor(featuredHomeProperty) : []),
    [featuredHomeProperty],
  );

  const featuredHomeHeroSrc = useMemo(() => {
    if (!featuredHomeProperty) return "";
    const raw = String(featuredPhotos[0] ?? featuredHomeProperty.image_url ?? "").trim();
    if (!raw) return "";
    return isCloudinaryDeliveryUrl(raw) ? cloudinaryPropertyPhotoHeroUrl(raw) : raw;
  }, [featuredHomeProperty, featuredPhotos]);

  const scrollRow = (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => {
    const el = ref.current;
    if (!el) return;
    const step = Math.max(300, Math.round(el.clientWidth * 0.75));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const scrollFeaturedLocations = useCallback((dir: "prev" | "next") => {
    const el = featuredLocationsScrollRef.current;
    if (!el) return;
    const track = el.firstElementChild as HTMLElement | null;
    let step: number;
    if (track && track.children.length > 1) {
      const a = track.children[0] as HTMLElement;
      const b = track.children[1] as HTMLElement;
      step = Math.max(1, b.offsetLeft - a.offsetLeft);
    } else {
      step = Math.max(300, Math.round(el.clientWidth * 0.85));
    }
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    const scrollEl = featuredLocationsScrollRef.current;
    if (!scrollEl) return;
    const track = scrollEl.firstElementChild as HTMLElement | null;
    if (!track) return;

    const onScroll = () => {
      if (featuredLocationsJumpGuardRef.current) return;
      const w = featuredLocationsSetWidthPxRef.current;
      if (w <= 0) return;
      const { scrollLeft } = scrollEl;
      if (scrollLeft >= 2 * w - 2) {
        featuredLocationsJumpGuardRef.current = true;
        scrollEl.scrollTo({ left: scrollLeft - w, behavior: "auto" });
        requestAnimationFrame(() => {
          featuredLocationsJumpGuardRef.current = false;
        });
      } else if (scrollLeft <= 2) {
        featuredLocationsJumpGuardRef.current = true;
        scrollEl.scrollTo({ left: scrollLeft + w, behavior: "auto" });
        requestAnimationFrame(() => {
          featuredLocationsJumpGuardRef.current = false;
        });
      }
    };

    const apply = () => {
      const total = track.scrollWidth;
      if (total <= 0) return;
      const setW = total / FEATURED_LOCATIONS_LOOP_COPIES;
      if (setW <= 0) return;
      featuredLocationsSetWidthPxRef.current = setW;
      if (!featuredLocationsLoopReadyRef.current) {
        scrollEl.scrollLeft = setW;
        featuredLocationsLoopReadyRef.current = true;
        return;
      }
      let guard = 0;
      while (scrollEl.scrollLeft >= 2 * setW - 1 && guard < 12) {
        scrollEl.scrollTo({ left: scrollEl.scrollLeft - setW, behavior: "auto" });
        guard += 1;
      }
      guard = 0;
      while (scrollEl.scrollLeft <= 1 && guard < 12) {
        scrollEl.scrollTo({ left: scrollEl.scrollLeft + setW, behavior: "auto" });
        guard += 1;
      }
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    apply();
    const ro = new ResizeObserver(() => {
      apply();
    });
    ro.observe(track);
    ro.observe(scrollEl);
    return () => {
      ro.disconnect();
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, [featuredLocationCounts]);

  const hasActiveSearchOrFilters = useMemo(() => {
    if (search.trim().length > 0 || neighborhoodFilter !== null) return true;
    if (filters.minPrice !== 0 || filters.maxPrice !== HOMEPAGE_FILTER_MAX_PRICE) return true;
    if (filters.beds !== "any" || filters.baths !== "any") return true;
    if (filters.homePropertyKind !== "any") return true;
    if (filters.transactionType !== "any") return true;
    if (filters.furnishing !== "any") return true;
    if (filters.floorAreaMin.trim() || filters.floorAreaMax.trim()) return true;
    if (filters.locationLabel) return true;
    if (filters.amenities.length > 0) return true;
    if (filters.amenityExtra.nearSchools || filters.amenityExtra.familyFriendly) return true;
    if (sortMode !== "newest") return true;
    return false;
  }, [search, neighborhoodFilter, filters, sortMode]);

  const clearFiltersAndBrowse = () => {
    setListingViewMode("browse");
    setSearch("");
    setNeighborhoodFilter(null);
    setFilters({
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
    });
    setAmenitiesExpanded(false);
    setSortMode("newest");
    router.replace(mode === "buy" ? "/buy" : "/", { scroll: false });
  };

  const onSearchSubmit = () => {
    applyLocationSearch();
  };

  const selectCityFilter = (key: string) => {
    if (neighborhoodFilter === key) {
      pendingFeaturedLocationUrlSyncRef.current = "";
      setNeighborhoodFilter(null);
      setSearch("");
    } else {
      const city = FEATURED_CITIES.find((c) => c.key === key);
      const label = city?.label ?? key;
      pendingFeaturedLocationUrlSyncRef.current = label;
      setNeighborhoodFilter(key);
      setSearch(label);
    }
    setListingViewMode("browse");
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const heroSearchCard = (
    <>
      <div className="flex justify-center lg:justify-start">
        <div className="inline-flex gap-2 rounded-full bg-[#EBE6DC]/90 p-1 ring-1 ring-[#D4A843]/35 backdrop-blur-sm">
          {mode === "rent" ? (
            <>
              <button
                type="button"
                onClick={() => router.replace(buildMarketplaceHref(search, "buy"), { scroll: false })}
                className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
              >
                Buy
              </button>
              <span className="rounded-full bg-gradient-to-b from-[#8faf91] to-[#6B9E6E] px-5 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[#D4A843]/50">
                Rent
              </span>
            </>
          ) : (
            <>
              <span className="rounded-full bg-gradient-to-b from-[#8faf91] to-[#6B9E6E] px-5 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[#D4A843]/50">
                Buy
              </span>
              <button
                type="button"
                onClick={() => router.replace(buildMarketplaceHref(search, "rent"), { scroll: false })}
                className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
              >
                Rent
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <div className="relative z-20 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <PhLocationInput
            value={search}
            onChange={(v) => {
              setNeighborhoodFilter(null);
              setSearch(v);
            }}
            onSubmitSearch={applyLocationSearch}
            placeholder="Search by location or neighborhood"
            aria-label="Search listings by location"
            className="w-full min-w-0 flex-1"
            inputClassName="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
          />
          <button
            type="button"
            onClick={onSearchSubmit}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#D4A843] px-6 py-3 text-sm font-semibold text-[#2C2C2C] shadow-md transition hover:bg-[#c49a38] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 sm:w-auto"
          >
            <Search className="h-4 w-4" aria-hidden />
            Search
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#2C2C2C]/80 lg:justify-start">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[#6B9E6E]">✓</span> PRC Licensed Agents Only
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[#6B9E6E]">✓</span> 0 Scams Guarantee
        </span>
      </div>
      <p className="mt-3 text-center text-[11px] font-semibold tracking-wide text-[#2C2C2C]/45 lg:text-left">
        1,200+ Listings · 847 Verified Agents · 0 Scams
      </p>
    </>
  );

  const dismissWelcomeBanner = () => {
    try {
      localStorage.setItem(WELCOME_BANNER_DISMISSED_KEY, "true");
    } catch {
      /* ignore */
    }
    setWelcomeBannerVisible(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />

      {welcomeBannerVisible && user ? (
        <div
          className="flex items-center justify-between border-b border-[#6B9E6E]/20 bg-[#6B9E6E]/10 px-4 py-3"
          role="region"
          aria-label="Welcome"
        >
          <p className="pr-4 text-sm text-[#2C2C2C]">
            👋 Welcome to BahayGo! Complete your profile to get the most out of the platform.
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/settings"
              className="text-sm font-medium text-[#6B9E6E] hover:underline"
            >
              Complete Profile →
            </Link>
            <button
              type="button"
              onClick={dismissWelcomeBanner}
              className="rounded-lg p-1 text-[#2C2C2C]/55 hover:bg-[#6B9E6E]/20 hover:text-[#2C2C2C]"
              aria-label="Dismiss welcome message"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <section className="relative border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-14">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="min-w-0">
              <div className="text-center lg:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B9E6E]">
                  Verified Agents · Real Listings · 100% Filipino
                </p>
                <h1 className="mt-4 font-serif text-2xl font-semibold leading-tight tracking-tight text-[#2C2C2C] sm:text-3xl">
                  FIND YOUR HOME IN THE PHILIPPINES
                </h1>
                <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/65">
                  Verified Agents, Real Listings, 100% Filipino
                </p>
              </div>

              <div className="hidden lg:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6B9E6E]">
                  Verified Agents · Real Listings · 100% Filipino
                </p>
                <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.08] tracking-tight text-[#2C2C2C]">
                  Find Your Home in the Philippines
                </h1>
                <p className="mt-4 text-lg font-medium text-[#2C2C2C]/70">
                  Browse verified listings across Metro Manila, Cebu, and beyond
                </p>
              </div>

              <div className="mt-6 lg:mt-8">{heroSearchCard}</div>

            </div>

            <div className="relative hidden min-h-[440px] lg:block">
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#FAF8F4] via-[#FFF9F0] to-[#F5EFE4]" />
              <div className="pointer-events-none absolute left-[12%] top-[22%] h-4 w-4 rotate-45 bg-[#D4A843]/25" />
              <div className="pointer-events-none absolute right-[18%] top-[38%] h-3 w-3 rotate-45 bg-[#D4A843]/35" />
              <div className="pointer-events-none absolute bottom-[28%] left-[20%] h-2.5 w-2.5 rotate-45 bg-[#6B9E6E]/25" />

              <div className="relative mx-auto flex h-[440px] w-full max-w-[380px] items-center justify-center">
                <HeroFloatingPropertyCards />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="featured-locations"
        className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4] py-8 sm:py-10"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 text-center sm:text-left">
              <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">
                Featured Locations
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                Tap a city to filter listings
              </p>
            </div>
            {geoFilterActive ? (
              <button
                type="button"
                onClick={clearGeoFilters}
                className="mx-auto mt-2 inline-flex w-fit items-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50 sm:mx-0 sm:mt-0"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="relative -mx-4 mt-6">
            <button
              type="button"
              onClick={() => scrollFeaturedLocations("prev")}
              className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
            </button>
            <button
              type="button"
              onClick={() => scrollFeaturedLocations("next")}
              className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
            </button>
            <div
              ref={featuredLocationsScrollRef}
              className="min-w-0 overflow-x-auto overflow-y-hidden px-1 pb-2 scrollbar-hide md:px-10"
              style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
            >
              <div className="flex w-max flex-nowrap justify-start gap-3 sm:gap-4">
                {Array.from({ length: FEATURED_LOCATIONS_LOOP_COPIES }, (_, copyIdx) =>
                  FEATURED_LOCATIONS.map((c, flIdx) => {
                    const count = featuredLocationCounts[c.label] ?? 0;
                    const matchType = "neighborhood" in c.match ? ("neighborhood" as const) : ("city" as const);
                    const matchValue = (c.match as { neighborhood?: string; city?: string })[matchType] ?? "";
                    const active = selectedLocation?.type === matchType && selectedLocation?.value === matchValue;
                    return (
                      <button
                        key={`fl-${copyIdx}-${c.label}`}
                        type="button"
                        tabIndex={copyIdx === 1 ? undefined : -1}
                        onClick={() => {
                          if (active) {
                            clearGeoFilters();
                            return;
                          }
                          setSelectedLocation({ type: matchType, value: matchValue, label: c.label });
                          setSelectedPropertyType(null);
                        }}
                        className={`group relative flex w-[130px] shrink-0 flex-col overflow-hidden rounded-2xl border text-left shadow-md transition hover:scale-[1.02] lg:w-[160px] ${
                          active
                            ? "border-[#6B9E6E] ring-2 ring-[#6B9E6E]/35"
                            : "border-[#2C2C2C]/10 hover:border-[#6B9E6E]/40"
                        }`}
                        style={{
                          opacity: selectedLocation && !active ? 0.4 : 1,
                          transition: "opacity 200ms ease",
                        }}
                      >
                        <div className="relative h-[110px] w-full shrink-0 overflow-hidden lg:h-[130px]">
                          <FeaturedLocationStripImage
                            src={c.imageUrl}
                            priority={copyIdx === 0 && flIdx < 2}
                            eager={copyIdx === 0 && flIdx < 2}
                          />
                          <div className="absolute inset-0 z-[3] bg-gradient-to-t from-[#1a1a1a]/95 via-[#2C2C2C]/35 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 z-[5] p-2 lg:p-2.5">
                            <p className="text-xs font-semibold text-white drop-shadow-sm lg:text-base">
                              {c.label}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold text-white/90 lg:text-[11px]">
                              {count} {count === 1 ? "listing" : "listings"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  }),
                ).flat()}
              </div>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {selectedLocation && propertyTypeCounts.length >= 2 ? (
              <motion.div
                key="property-type-subfilter"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                className="mt-5"
              >
                <p className="text-[13px] font-semibold text-[#2C2C2C]/55">Property type</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPropertyType(null)}
                    className={cn(
                      "h-9 rounded-full px-3 text-xs font-semibold ring-1 ring-black/10 transition",
                      selectedPropertyType == null ? "bg-[#6B9E6E] text-white" : "bg-[#FAF8F4] text-[#2C2C2C]/70",
                    )}
                  >
                    All
                  </button>
                  {propertyTypeCounts.map((r) => {
                    const active = selectedPropertyType === r.property_type;
                    return (
                      <button
                        key={`pt-${r.property_type}`}
                        type="button"
                        onClick={() => setSelectedPropertyType((cur) => (cur === r.property_type ? null : r.property_type))}
                        className={cn(
                          "h-9 rounded-full px-3 text-xs font-semibold ring-1 ring-black/10 transition",
                          active ? "bg-[#6B9E6E] text-white" : "bg-[#FAF8F4] text-[#2C2C2C]/70",
                        )}
                      >
                        {r.property_type} ({r.count})
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </section>

      <hr className="mx-auto w-3/4 border-t border-[#2C2C2C]/10" />

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-5 md:pb-16">
        {/* Loading / error */}
        {loading ? (
          <div className="mt-8 grid min-h-[400px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`listing-skeleton-${i}`}
                className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md"
              >
                <div className="relative h-44 w-full animate-pulse bg-neutral-200/90 lg:h-52" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200/90" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200/90" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!loading && error ? (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load listings</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {/* PROPERTY LISTING SECTION (controlled by Buy/Rent toggle) */}
            <section id="listings">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {activeFilterChips(filters, sortMode, {
                    clearPrice: () => setFilters((s) => ({ ...s, minPrice: 0, maxPrice: HOMEPAGE_FILTER_MAX_PRICE })),
                    clearBeds: () => setFilters((s) => ({ ...s, beds: "any" })),
                    clearBaths: () => setFilters((s) => ({ ...s, baths: "any" })),
                    clearKind: () => setFilters((s) => ({ ...s, homePropertyKind: "any", propertyType: "any" })),
                    clearTransaction: () => setFilters((s) => ({ ...s, transactionType: "any" })),
                    clearFurnishing: () => setFilters((s) => ({ ...s, furnishing: "any" })),
                    clearFloor: () => setFilters((s) => ({ ...s, floorAreaMin: "", floorAreaMax: "" })),
                    clearLocation: () => setFilters((s) => ({ ...s, locationLabel: null })),
                    clearAmenities: () =>
                      setFilters((s) => ({
                        ...s,
                        amenities: [],
                        amenityExtra: { nearSchools: false, familyFriendly: false },
                      })),
                    clearSort: () => setSortMode("newest"),
                  }).map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50"
                    >
                      {chip.label}
                      <span className="text-[#2C2C2C]/35">×</span>
                    </button>
                  ))}
                  {countActiveFilters(filters, sortMode) > 0 ? (
                    <button
                      type="button"
                      onClick={() => clearFiltersAndBrowse()}
                      className="text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C]"
                    >
                      Clear All
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className={cn(
                      "relative inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-neutral-50 sm:w-auto",
                      filtersOpen
                        ? "border border-black/10 text-[#2C2C2C]/80"
                        : "border-2 border-[#6B9E6E] text-[#6B9E6E]",
                    )}
                  >
                    <Filter className="h-4 w-4" />
                    {filtersOpen ? "Hide Filters" : "Filters"}
                    {countActiveFilters(filters, sortMode) > 0 ? (
                      <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-[#6B9E6E]" aria-hidden />
                    ) : null}
                  </button>

                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50 focus-visible:outline-none sm:w-auto"
                    aria-label="Sort"
                  >
                    <option value="newest">Newest</option>
                    <option value="price_low">Price Low-High</option>
                    <option value="price_high">Price High-Low</option>
                    <option value="most_beds">Most Beds</option>
                  </select>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {filtersOpen ? (
                  <motion.div
                    key="filters"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="mt-3 rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm sm:p-4"
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
                        Price range{" "}
                        <span className="font-bold text-[#2C2C2C]/80">
                          {formatPesoInputLong(filters.minPrice)} – {formatPesoInputLong(filters.maxPrice)}
                        </span>
                      </p>
                      <div className="mt-2 max-w-2xl">
                        <HomepageFilterDualPriceSlider
                          minPrice={filters.minPrice}
                          maxPrice={filters.maxPrice}
                          onChange={(next) => setFilters((s) => ({ ...s, ...next }))}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
                        Property type
                      </p>
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
                                setFilters((s) => ({
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
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
                        Transaction type
                      </p>
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
                              onClick={() => setFilters((s) => ({ ...s, transactionType: v }))}
                              className={transactionPillClass(on)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-3">
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
                                setFilters((s) => ({
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
                                setFilters((s) => ({
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
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2 md:gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Furnishing</p>
                        <select
                          value={filters.furnishing}
                          onChange={(e) =>
                            setFilters((s) => ({ ...s, furnishing: e.target.value as FurnishingFilter }))
                          }
                          className="mt-2 w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
                          aria-label="Furnishing"
                        >
                          <option value="any">Any</option>
                          <option value="furnished">Furnished</option>
                          <option value="semi">Semi-furnished</option>
                          <option value="unfurnished">Unfurnished</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
                          Floor area (sqm)
                        </p>
                        <div className="mt-2 flex gap-2">
                          <input
                            value={filters.floorAreaMin}
                            onChange={(e) =>
                              setFilters((s) => ({ ...s, floorAreaMin: e.target.value.replace(/[^\d]/g, "") }))
                            }
                            placeholder="Min"
                            className="w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85 placeholder:text-[#2C2C2C]/35"
                            inputMode="numeric"
                            aria-label="Minimum floor area"
                          />
                          <input
                            value={filters.floorAreaMax}
                            onChange={(e) =>
                              setFilters((s) => ({ ...s, floorAreaMax: e.target.value.replace(/[^\d]/g, "") }))
                            }
                            placeholder="Max"
                            className="w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85 placeholder:text-[#2C2C2C]/35"
                            inputMode="numeric"
                            aria-label="Maximum floor area"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2C2C2C]/45">Location</p>
                      <select
                        value={filters.locationLabel ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFilters((s) => ({ ...s, locationLabel: v ? v : null }));
                        }}
                        className="mt-2 w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
                        aria-label="Filter by location"
                      >
                        <option value="">Any location</option>
                        {FEATURED_LOCATIONS.map((loc) => (
                          <option key={loc.label} value={loc.label}>
                            {loc.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4">
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
                                  setFilters((s) => ({
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
                        <ArrowDown
                          className={cn("h-3.5 w-3.5 transition", amenitiesExpanded && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                      {amenitiesExpanded ? (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[#2C2C2C]/8 pt-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#2C2C2C]/75">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-black/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                              checked={filters.amenityExtra.nearSchools}
                              onChange={(e) =>
                                setFilters((s) => ({
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
                                setFilters((s) => ({
                                  ...s,
                                  amenityExtra: { ...s.amenityExtra, familyFriendly: e.target.checked },
                                }))
                              }
                            />
                            Family friendly
                          </label>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#2C2C2C]/10 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFilters({
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
                          });
                          setAmenitiesExpanded(false);
                          setSortMode("newest");
                        }}
                        className="text-xs font-semibold text-[#6B9E6E] hover:underline"
                      >
                        Clear all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasActiveSearchOrFilters) {
                            setListingViewMode(
                              isFeaturedCityNeighborhoodKey(neighborhoodFilter) ? "browse" : "results",
                            );
                          }
                          setFiltersOpen(false);
                          requestAnimationFrame(() => {
                            document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          });
                        }}
                        className="inline-flex min-w-[6.75rem] items-center justify-center rounded-full bg-[#6B9E6E] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#5d8a60]"
                      >
                        Apply filters
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                {selectedLocation ? (
                  <motion.div
                    key="location-curated-rows"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    {locationCuratedLoading ? (
                      <div className="mt-2 grid min-h-[260px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={`loc-row-skel-${i}`}
                            className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md"
                          >
                            <div className="relative h-44 w-full animate-pulse bg-[#FAF8F4]/60 lg:h-52" />
                            <div className="space-y-2 p-3">
                              <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200/90" />
                              <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200/90" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : locationCuratedRows.length === 0 ? (
                      <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/30">
                          <MapPin className="h-10 w-10 text-[#6B9E6E]" aria-hidden />
                        </div>
                        <p className="mt-6 text-xl font-semibold leading-snug text-[#2C2C2C]">
                          No listings in {selectedLocation.label} yet
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
                          Check back soon — agents are adding new listings every week.
                        </p>
                        <button
                          type="button"
                          onClick={clearGeoFilters}
                          className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#6C8C70]"
                        >
                          Clear filter
                        </button>
                      </div>
                    ) : (
                      <PropertyRows
                        rows={locationCuratedRows}
                        showMore={showMoreCategories}
                        onToggleShowMore={() => setShowMoreCategories((v) => !v)}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        engagement={engagement}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                        listingsOnboardingHref={user ? "/register/agent" : "/auth/signup"}
                      />
                    )}
                  </motion.div>
                ) : listingViewMode === "results" ? (
                  <motion.div
                    key="listing-results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-lg font-semibold text-[#2C2C2C]">
                        {sortedAllRows.length} {sortedAllRows.length === 1 ? "property" : "properties"} match your search
                      </p>
                      <button
                        type="button"
                        onClick={() => clearFiltersAndBrowse()}
                        className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50"
                      >
                        Clear Filters
                      </button>
                    </div>
                    {sortedAllRows.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="mt-12 flex flex-col items-center justify-center px-4 text-center"
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/30">
                          <Home className="h-10 w-10 text-[#6B9E6E]" aria-hidden />
                        </div>
                        <p className="mt-6 max-w-md text-xl font-semibold leading-snug text-[#2C2C2C]">
                          No listings found in that area yet. Be the first to list here.
                        </p>
                        <Link
                          href={user ? "/register/agent" : "/auth/signup"}
                          className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#6C8C70]"
                        >
                          Register as an agent
                        </Link>
                      </motion.div>
                    ) : (
                      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {sortedAllRows.map((p, i) => (
                          <NewlyListedCard
                            key={`result-${p.id}`}
                            property={p}
                            roomUrls={roomUrlsFor(p)}
                            roomIdx={cardRoomIdx[p.id] ?? 0}
                            onRoomPrev={() =>
                              setCardRoomIdx((s) => ({
                                ...s,
                                [p.id]:
                                  (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                                  Math.max(1, roomUrlsFor(p).length),
                              }))
                            }
                            onRoomNext={() =>
                              setCardRoomIdx((s) => ({
                                ...s,
                                [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                              }))
                            }
                            engagement={engagement}
                            connectedAgents={allConnectedAgentsByPropertyId.get(p.id) ?? []}
                            onOpenPropertyZoom={() => setZoomProperty(p)}
                            grid
                            viewerUserId={user?.id ?? null}
                            verifiedListingAgent={viewerVerifiedListingAgent}
                            listingImageLoadEager={i < 4}
                            listingImagePriority={i < 4}
                          />
                        ))}
                        {Array.from({ length: Math.max(0, 4 - sortedAllRows.length) }).map((_, i) => (
                          <ListingsComingSoonPlaceholderCard
                            key={`grid-placeholder-${i}`}
                            cardWidthClass="w-full"
                            href={user ? "/register/agent" : "/auth/signup"}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`browse-${mode}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    {!neighborhoodFilter ? (
                      <PropertyRows
                        rows={defaultHomepageRows}
                        showMore={showMoreCategories}
                        onToggleShowMore={() => setShowMoreCategories((v) => !v)}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        engagement={engagement}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                        listingsOnboardingHref={user ? "/register/agent" : "/auth/signup"}
                        rowTitleSuffix={browseRowTitleSuffix}
                      />
                    ) : mode === "buy" ? (
                      <PropertyRows
                        rows={[
                          {
                            key: "buy-for-sale",
                            title: "For Sale",
                            subtitle: "Sale listings (non-presale), newest first",
                            items: forSaleListings,
                          },
                          {
                            key: "buy-presale",
                            title: "🏗️ Presale Developments",
                            subtitle: "New projects & pre-selling inventory",
                            items: presaleDevelopments,
                          },
                        ]}
                        showMore={false}
                        onToggleShowMore={() => {}}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        engagement={engagement}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                        listingsOnboardingHref={user ? "/register/agent" : "/auth/signup"}
                        rowTitleSuffix={browseRowTitleSuffix}
                      />
                    ) : (
                      <PropertyRows
                        rows={[
                          {
                            key: "rent-new",
                            title: "Newly Listed Rentals",
                            subtitle: "Newest rentals first",
                            items: newlyListedRentals,
                          },
                        ]}
                        showMore={false}
                        onToggleShowMore={() => {}}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        engagement={engagement}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                        listingsOnboardingHref={user ? "/register/agent" : "/auth/signup"}
                        rowTitleSuffix={browseRowTitleSuffix}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {neighborhoodFilter && cityFilterMeta ? (
                <div className="mt-12 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <h2 className="font-serif text-xl font-semibold tracking-tight text-[#2C2C2C] sm:text-2xl">
                    Top Agents in {cityFilterMeta.label}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                    Verified agents who serve this area
                  </p>
                  {agentsForCityFilter.length === 0 ? (
                    <p className="mt-6 text-center text-sm font-semibold text-[#2C2C2C]/45">
                      No agents list this city in their service areas yet.
                    </p>
                  ) : (
                    <div className="mt-6 flex flex-wrap justify-center gap-4 md:justify-start">
                      {agentsForCityFilter.map((a) => (
                        <AgentDirectoryCard
                          key={`city-agent-${a.id}`}
                          agent={a}
                          className="w-full sm:w-[300px]"
                          scoreBesideName
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            {/* 7. WHY FISHNET TRUST SECTION */}
            <section className="mt-6 lg:mt-12">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <Trust
                    icon={<Shield className="h-5 w-5 text-[#6B9E6E]" />}
                    title="All Agents Verified"
                    body="Every agent on BahayGo has a verified PRC license"
                  />
                  <Trust
                    icon={<BadgeCheck className="h-5 w-5 text-[#6B9E6E]" />}
                    title="Licensed Brokers Only"
                    body="All brokerages are registered and monitored"
                  />
                  <Trust
                    icon={<Lock className="h-5 w-5 text-[#6B9E6E]" />}
                    title="Anti-Scam Protection"
                    body="Zero tolerance policy. Report and remove instantly"
                  />
                </div>
              </div>
            </section>

            <hr className="mx-auto mt-6 w-3/4 border-t border-[#2C2C2C]/10 lg:mt-12" />

            {/* 8. FEATURED PROPERTY */}
            {featuredHomeProperty ? (
              <section className="mt-6 lg:mt-12">
                <div className="mx-auto max-w-2xl">
                  <Link
                    href={`/properties/${encodeURIComponent(featuredHomeProperty.id)}`}
                    className="block overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative h-48 w-full bg-black/5 lg:h-64">
                      <FeaturedListingHeroImage
                        src={featuredHomeHeroSrc}
                        alt={featuredHomeProperty.name ?? featuredHomeProperty.location}
                      />
                      {featuredHomeIsAdminFeatured ? (
                        <span className="absolute left-3 top-3 z-10 rounded-full bg-[#D4A843] px-3 py-1 text-xs font-medium text-white">
                          FEATURED
                        </span>
                      ) : null}
                    </div>
                    <div className="p-5 md:p-6">
                      <h2 className="text-2xl font-semibold tracking-tight text-[#2C2C2C] md:text-3xl">
                        {featuredHomeProperty.name ?? featuredHomeProperty.location}
                      </h2>
                      {featuredHomeProperty.status === "both" ||
                      featuredHomeProperty.listing_type === "both" ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xl font-semibold text-[#D4A843] md:text-2xl">
                            Sale {formatPropertyPriceDisplay(featuredHomeProperty.price, "for_sale")}
                          </p>
                          <p className="text-lg font-semibold text-[#2C2C2C]/90 md:text-xl">
                            Rent{" "}
                            {formatPropertyPriceDisplay(
                              featuredHomeProperty.rent_price,
                              "for_rent",
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xl font-semibold text-[#D4A843] md:text-2xl">
                          {formatPropertyPriceDisplay(
                            featuredHomeProperty.price,
                            featuredHomeProperty.status,
                          )}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-1 text-xs font-semibold text-[#2C2C2C]/80">
                          {featuredHomeProperty.beds ? `${featuredHomeProperty.beds} beds` : "Studio"}
                        </span>
                        <span className="rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-1 text-xs font-semibold text-[#2C2C2C]/80">
                          {featuredHomeProperty.baths} baths
                        </span>
                        <span className="rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-1 text-xs font-semibold text-[#2C2C2C]/80">
                          {featuredHomeProperty.sqft} sqft
                        </span>
                      </div>
                      <p className="mt-4 flex items-start gap-2 text-sm font-semibold text-[#2C2C2C]/75">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                        <span>{featuredHomeProperty.location}</span>
                      </p>
                      <span className="mt-5 inline-flex rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white shadow-sm">
                        Learn More
                      </span>
                    </div>
                  </Link>
                </div>
              </section>
            ) : null}

            {/* 6. TOP VERIFIED AGENTS THIS WEEK (deferred client load) */}
            <hr className="mx-auto mt-6 w-3/4 border-t border-[#2C2C2C]/10 lg:mt-12" />
            <div className="mt-6 lg:mt-12">
              <DynamicHomepageTopAgents
                topAgents={topAgents}
                topAgentsRef={topAgentsRef}
                scrollRow={scrollRow}
                agentHomeExtrasById={agentHomeExtrasById}
              />
            </div>

            <hr className="mx-auto mt-6 w-3/4 border-t border-[#2C2C2C]/10" />
          </>
        ) : null}
      </main>

      <DynamicHomepageFaq
        openFaqIndex={openFaqIndex}
        setOpenFaqIndex={setOpenFaqIndex}
        className="mt-6"
      />

      <AnimatePresence>
        {zoomProperty ? (
          <PropertyZoomModal
            property={zoomProperty}
            agents={allConnectedAgentsByPropertyId.get(zoomProperty.id) ?? []}
            onClose={() => setZoomProperty(null)}
            engagement={engagement}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CategorySection({
  title,
  subtitle,
  sectionRef,
  expanded,
  onToggleExpanded,
  items,
  cardRoomIdx,
  setCardRoomIdx,
  engagement,
  connectedAgentsByPropertyId,
  scrollRow,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
  listingOnboardingHref,
}: {
  title: string;
  subtitle: string;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  expanded: boolean;
  onToggleExpanded: () => void;
  items: DbProperty[];
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  engagement: PropertyEngagement;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  scrollRow: (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => void;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
  listingOnboardingHref: string;
}) {
  const visible = expanded ? items : items.slice(0, 12);
  const categoryCardWidthClass = "w-[220px] shrink-0 sm:w-[232px] lg:w-[240px]";

  return (
    <>
      <div>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      <div className="-mx-4 mt-4 flex items-stretch gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pl-2"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={sectionRef}
          className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide"
        >
          <div className="flex w-max flex-nowrap gap-3">
            {visible.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <ListingsComingSoonPlaceholderCard
                    key={`${title}-empty-${i}`}
                    cardWidthClass={categoryCardWidthClass}
                    href={listingOnboardingHref}
                  />
                ))
              : visible.map((p) => (
                  <NewlyListedCard
                    key={`${title}-${p.id}`}
                    property={p}
                    roomUrls={roomUrlsFor(p)}
                    roomIdx={cardRoomIdx[p.id] ?? 0}
                    onRoomPrev={() =>
                      setCardRoomIdx((s) => ({
                        ...s,
                        [p.id]:
                          (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                          Math.max(1, roomUrlsFor(p).length),
                      }))
                    }
                    onRoomNext={() =>
                      setCardRoomIdx((s) => ({
                        ...s,
                        [p.id]:
                          ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                      }))
                    }
                    engagement={engagement}
                    connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                    onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
                    grid
                    compact
                    verifiedListingAgent={viewerVerifiedListingAgent}
                  />
                ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 pr-2 shadow-sm hover:bg-neutral-50 md:flex md:pr-2"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {items.length > 12 ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50"
          >
            {expanded ? "Show less" : "Show more"}
            <ArrowDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      ) : null}
    </>
  );
}

function Trust({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-semibold text-[#2C2C2C]">{title}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">{body}</p>
    </div>
  );
}

/** Brokerage line on homepage listing cards (uses `brokers` join on agent). */
function listingCardBrokerageSubtitle(agent: MarketplaceAgent): string {
  if (agent.brokerId) {
    const n = (agent.brokerName || agent.company).trim();
    if (n) return n;
  }
  return "Independent Agent";
}

export function NewlyListedCard({
  property,
  roomUrls,
  roomIdx,
  onRoomPrev,
  onRoomNext,
  engagement,
  connectedAgents,
  onOpenPropertyZoom,
  grid,
  gridCardClassName,
  cardWidthClass,
  viewerUserId,
  compact,
  verifiedListingAgent,
  listingImageLoadEager,
  listingImagePriority = false,
}: {
  property: DbProperty;
  roomUrls: string[];
  roomIdx: number;
  onRoomPrev: () => void;
  onRoomNext: () => void;
  engagement: PropertyEngagement;
  connectedAgents: MarketplaceAgent[];
  onOpenPropertyZoom: () => void;
  grid?: boolean;
  /** When `grid` is true: widths for horizontal category rows (mobile peek + desktop columns). */
  gridCardClassName?: string;
  cardWidthClass?: string;
  viewerUserId?: string | null;
  /** Smaller image + type for 5-across carousels */
  compact?: boolean;
  /** Logged-in viewer is approved + verified agent (homepage co-list CTA). */
  verifiedListingAgent?: boolean;
  /** First listing thumbnail in browse/search results uses eager loading. */
  listingImageLoadEager?: boolean;
  /** Small set of above-the-fold cards: `next/image` priority + eager fetch. */
  listingImagePriority?: boolean;
}) {
  const listedLabel = listingListedLabel(property.created_at);
  const listingRemoved = propertyEngagementLooksUnavailable(property);
  const overlayMeta = availabilityCardOverlayClasses(property.availability_state);
  const overlayLabel = availabilityCardOverlayLabel(property.availability_state, property.deleted_at);
  const isDualListing =
    !property.is_presale && (property.status === "both" || property.listing_type === "both");
  const statusLabel = property.is_presale
    ? "Presale"
    : property.status === "for_rent"
      ? "For Rent"
      : property.status === "both"
        ? "Sale & Rent"
        : "For Sale";
  const img = String(roomUrls[roomIdx] ?? roomUrls[0] ?? property.image_url ?? "").trim();
  const imgIsCloudinaryDelivery = isCloudinaryDeliveryUrl(img);

  const { profile } = useAuth();
  const router = useRouter();
  const agentEngagementLocked = profile?.role === "agent";
  const [coListOpen, setCoListOpen] = useState(false);
  const [coListError, setCoListError] = useState<string | null>(null);
  const [coListSubmitting, setCoListSubmitting] = useState(false);
  const [listingImgLoaded, setListingImgLoaded] = useState(false);

  useEffect(() => {
    setListingImgLoaded(!img);
  }, [img]);

  const firstAgent = connectedAgents[0] ?? null;
  const moreAgentCount = Math.max(0, connectedAgents.length - 1);

  const showYourListingBadge =
    !!viewerUserId &&
    connectedAgents.some((a) => a.userId === viewerUserId);

  const showEng = engagement.showEngagementCounts(property.id);
  const isLiked = engagement.isLiked(property.id);
  const isPinned = engagement.isPinned(property.id);
  const showEngagementRow = showEng || agentEngagementLocked;

  const titleLine = property.name?.trim() || property.location;
  const canRequestCoList =
    profile?.role === "agent" &&
    !!verifiedListingAgent &&
    !!viewerUserId &&
    !!property.listed_by &&
    viewerUserId !== property.listed_by;
  return (
    <div
      className={cn(
        "flex min-h-[412px] flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md lg:min-h-[448px]",
        grid
          ? gridCardClassName ?? "w-[220px] shrink-0 sm:w-[232px] lg:w-[240px]"
          : cn(cardWidthClass ?? "w-[240px]", "shrink-0"),
        listingRemoved && "pointer-events-none opacity-50",
      )}
    >
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-neutral-900 lg:h-52">
        <div
          className={cn(
            "absolute inset-0 z-[1] animate-pulse bg-[#FAF8F4]/60 transition-opacity duration-500",
            listingImgLoaded && "pointer-events-none opacity-0",
          )}
          aria-hidden
        />
        {img ? (
          <Image
            src={img}
            alt={property.name ?? property.location}
            fill
            // Cloudinary URLs already embed `c_fill,w_*` via `cloudinaryPropertyPhotoDisplayUrl`.
            // Supabase (and other) URLs run through the Next optimizer so we do not download full-resolution originals for ~240px cards.
            unoptimized={imgIsCloudinaryDelivery}
            quality={75}
            className={cn(
              "z-[2] object-cover transition-opacity duration-500",
              listingImgLoaded ? "opacity-100" : "opacity-0",
              listingRemoved && "grayscale",
            )}
            sizes={LISTING_IMAGE_SIZES}
            priority={listingImagePriority}
            loading={listingImageLoadEager || listingImagePriority ? "eager" : "lazy"}
            onLoadingComplete={() => setListingImgLoaded(true)}
          />
        ) : null}
        <button
          type="button"
          onClick={listingRemoved ? undefined : onOpenPropertyZoom}
          disabled={listingRemoved}
          className={cn(
            "absolute inset-0 z-[6] bg-transparent",
            listingRemoved ? "cursor-default" : "cursor-pointer",
          )}
          aria-label="Open property details"
        />

        {listingRemoved ? (
          <div
            className={`pointer-events-none absolute inset-0 z-[25] flex items-center justify-center px-2 ${overlayMeta.overlayTintClass}`}
          >
            <span
              className={`rounded-full px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide ${overlayMeta.badgeClass}`}
            >
              {overlayLabel}
            </span>
          </div>
        ) : null}

        {roomUrls.length > 1 ? (
          <>
            <button
              type="button"
              disabled={listingRemoved}
              onClick={(e) => {
                e.stopPropagation();
                onRoomPrev();
              }}
              className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
              aria-label="Previous room photo"
            >
              <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
            </button>
            <button
              type="button"
              disabled={listingRemoved}
              onClick={(e) => {
                e.stopPropagation();
                onRoomNext();
              }}
              className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
              aria-label="Next room photo"
            >
              <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
            </button>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-black/25 to-transparent" />

        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1">
          {isDualListing ? (
            <>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-gray-800 shadow-sm backdrop-blur-sm">
                For Sale
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-gray-800 shadow-sm backdrop-blur-sm">
                For Rent
              </span>
            </>
          ) : (
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-gray-800 shadow-sm backdrop-blur-sm">
              {statusLabel}
            </span>
          )}
        </div>

        {showEngagementRow ? (
          <div
            className="absolute right-3 top-3 z-20 flex items-center gap-1"
            title={agentEngagementLocked ? "Only clients can like and pin properties" : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!agentEngagementLocked && !listingRemoved) void engagement.toggleLike(property.id);
              }}
              disabled={agentEngagementLocked || listingRemoved}
              className={cn(
                "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                property.is_presale
                  ? cn("border bg-white", isLiked ? "border-red-200" : "border-gray-200")
                  : isLiked
                    ? "border border-red-200 bg-white"
                    : "border border-gray-200 bg-white/80",
                (agentEngagementLocked || listingRemoved) && "pointer-events-none opacity-40",
              )}
              aria-label={`${engagement.likeCount(property.id)} likes`}
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isLiked ? "fill-red-500 text-red-500" : "fill-none text-red-400",
                )}
              />
              {showEng || agentEngagementLocked || property.is_presale ? (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isLiked ? "text-red-500" : "text-red-400",
                  )}
                >
                  {engagement.likeCount(property.id)}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!agentEngagementLocked && !listingRemoved) void engagement.togglePin(property.id);
              }}
              disabled={agentEngagementLocked || listingRemoved}
              className={cn(
                "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                property.is_presale
                  ? cn("border bg-white", isPinned ? "border-[#D4A843]/40" : "border-gray-200")
                  : isPinned
                    ? "border border-[#D4A843]/40 bg-white"
                    : "border border-gray-200 bg-white/80",
                (agentEngagementLocked || listingRemoved) && "pointer-events-none opacity-40",
              )}
              aria-label={`${engagement.saveCount(property.id)} saved`}
            >
              <Pin
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isPinned ? "fill-[#D4A843] text-[#D4A843]" : "fill-none text-[#D4A843]",
                )}
              />
              {showEng || agentEngagementLocked || property.is_presale ? (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isPinned ? "text-[#D4A843]" : "text-[#D4A843]",
                  )}
                >
                  {engagement.saveCount(property.id)}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        <div className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-5rem)] flex-col items-start gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-[#2C2C2C] shadow-sm ring-1 ring-black/5">
            {listedLabel}
          </span>
          {showYourListingBadge ? (
            <Link
              href="/dashboard/agent"
              className="pointer-events-auto rounded-full bg-[#D4A843]/95 px-2 py-0.5 text-xs font-semibold text-[#2C2C2C] shadow-sm ring-1 ring-[#8a6d32]/30 hover:bg-[#D4A843]"
              onClick={(e) => e.stopPropagation()}
            >
              This is your listing
            </Link>
          ) : null}
        </div>
      </div>

      <div
        className={`flex flex-col gap-0 border-t border-[#2C2C2C]/10 bg-white ${compact ? "px-3 py-2" : "px-3 py-3 sm:px-4"}`}
      >
        <div className={`min-h-[28px] shrink-0 overflow-hidden ${isDualListing ? "" : "h-[28px]"}`}>
          {isDualListing ? (
            <div className="space-y-0.5">
              <p
                className={`truncate font-semibold tracking-tight text-[#D4A843] ${compact ? "text-sm" : "text-base sm:text-lg"}`}
              >
                Sale {formatPropertyPriceDisplay(property.price, "for_sale")}
              </p>
              <p
                className={`truncate font-semibold tracking-tight text-[#2C2C2C]/90 ${compact ? "text-xs" : "text-sm sm:text-base"}`}
              >
                Rent {formatPropertyPriceDisplay(property.rent_price, "for_rent")}
              </p>
            </div>
          ) : (
            <p
              className={`truncate font-semibold tracking-tight text-[#D4A843] ${compact ? "text-base" : "text-lg sm:text-xl"}`}
            >
              {formatPropertyPriceDisplay(property.price, property.status)}
            </p>
          )}
        </div>
        <div className="h-[48px] shrink-0 overflow-hidden">
          <p
            className={`line-clamp-2 text-[#2C2C2C] ${compact ? "text-sm font-semibold" : "text-base font-semibold"}`}
          >
            {titleLine}
          </p>
        </div>
        <div className="h-[24px] shrink-0 overflow-hidden">
          <p className={`truncate text-[#6B6B6B] ${compact ? "text-[11px]" : "text-xs"}`}>
            {property.beds ? `${property.beds} beds` : "Studio"} · {property.baths} baths · {property.sqft} sqft
          </p>
        </div>
        <div className="h-[24px] shrink-0 overflow-hidden">
          <p
            className={`flex items-start gap-1 text-[#6B6B6B] ${compact ? "text-[11px]" : "text-xs"}`}
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E8E8E]" aria-hidden />
            <span className="min-w-0 flex-1 truncate leading-snug">{property.location}</span>
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex min-h-[56px] max-h-[76px] shrink-0 flex-col justify-start overflow-hidden bg-white px-3 py-1.5">
        {connectedAgents.length === 0 ? (
          <div className="flex min-h-[40px] flex-1 items-center justify-center">
            <p className="text-center text-xs text-gray-400">No agent assigned</p>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-stretch justify-start gap-0">
            {firstAgent ? (
              <div className="shrink-0">
                <Link
                  href={`/agents/${encodeURIComponent(firstAgent.id)}`}
                  title={firstAgent.name}
                  onClick={(e) => e.stopPropagation()}
                  className="group flex min-w-0 cursor-pointer items-start gap-2 rounded-lg transition-colors duration-150 ease-out hover:bg-[#6B9E6E15] hover:underline"
                >
                  <div className="relative aspect-square h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                    <AgentAvatarFill name={firstAgent.name} imageUrl={firstAgent.image} sizes="28px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex w-full items-center justify-between gap-1">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-[#2C2C2C]/85">
                          {firstAgent.name}
                        </span>
                        <BadgeCheck className="h-3 w-3 shrink-0 text-[#D4A843]" aria-label="Verified" />
                      </div>
                      {firstAgent.score > 0 ? (
                        <span className="ml-1 flex shrink-0 items-center gap-0.5 text-xs text-gray-400">
                          ★ {Number(firstAgent.score).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[10px] text-gray-400">
                      {listingCardBrokerageSubtitle(firstAgent)}
                    </p>
                  </div>
                </Link>
              </div>
            ) : null}
            {moreAgentCount > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/properties/${encodeURIComponent(property.id)}#agents-section`);
                }}
                className="mt-1 w-full shrink-0 rounded-full border border-[#6B9E6E] px-3 py-1 text-center text-xs text-[#6B9E6E]"
              >
                See {moreAgentCount} more agent{moreAgentCount === 1 ? "" : "s"} →
              </button>
            ) : (
              canRequestCoList ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoListError(null);
                    setCoListOpen(true);
                  }}
                  className="mt-1 w-full shrink-0 rounded-full border border-[#2C2C2C]/15 bg-white py-1.5 text-center text-xs font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4]"
                >
                  Request to co-list
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="mt-1 w-full shrink-0 cursor-default rounded-full border border-gray-100 bg-transparent py-1.5 text-center text-xs text-gray-400 opacity-50 disabled:cursor-default"
                >
                  {verifiedListingAgent ? "Request to co-list" : "No other agents on this listing"}
                </button>
              )
            )}
          </div>
        )}
      </div>
      <CoListRequestModal
        open={coListOpen}
        onClose={() => setCoListOpen(false)}
        propertyTitle={property.name?.trim() || property.location}
        submitting={coListSubmitting}
        error={coListError}
        onSubmit={async (message) => {
          if (!property?.id || !viewerUserId) return;
          setCoListError(null);
          setCoListSubmitting(true);
          const { data: agentRow, error: agentErr } = await supabase
            .from("agents")
            .select("id, status, license_number, verification_status")
            .eq("user_id", viewerUserId)
            .maybeSingle();
          if (agentErr || !agentRow?.id) {
            setCoListSubmitting(false);
            setCoListError(agentErr?.message || "Could not load agent profile.");
            return;
          }
          if (agentRow.status !== "approved" || !String(agentRow.license_number ?? "").trim()) {
            setCoListSubmitting(false);
            setCoListError("Only approved agents can request co-listing.");
            return;
          }
          if (agentRow.verification_status !== "verified") {
            setCoListSubmitting(false);
            setCoListError("Verification required to co-list.");
            return;
          }
          const { error } = await supabase.from("co_agent_requests").insert({
            property_id: property.id,
            agent_id: agentRow.id,
          });
          if (error) {
            setCoListSubmitting(false);
            setCoListError(error.message);
            return;
          }
          void fetch("/api/notify-co-agent-request", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ propertyId: property.id, message: message.trim() ? message.trim() : undefined }),
          }).catch(() => {});
          setCoListSubmitting(false);
          setCoListOpen(false);
          toast.success("Co-list request sent");
        }}
      />
    </div>
  );
}

function filterPillClass(selected: boolean): string {
  return cn(
    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
    selected ? "bg-[#6B9E6E] text-white" : "border border-black/15 bg-white text-[#2C2C2C]/85",
  );
}

function filterBedBathPill(selected: boolean): string {
  return cn(
    "flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold transition",
    selected ? "bg-[#6B9E6E] text-white shadow-sm" : "border border-black/12 bg-[#F3F1EC] text-[#2C2C2C]/78",
  );
}

function homePropertyKindChipClass(selected: boolean): string {
  return cn(
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] font-semibold transition sm:gap-1 sm:px-1.5 sm:py-2 sm:text-[11px]",
    selected
      ? "border-[#6B9E6E] bg-[#6B9E6E]/10 text-[#6B9E6E]"
      : "border-black/10 bg-white text-[#2C2C2C]/65 hover:border-[#6B9E6E]/30",
  );
}

function transactionPillClass(selected: boolean): string {
  return cn(
    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition ring-1",
    selected ? "bg-white text-[#6B9E6E] ring-[#6B9E6E]" : "bg-[#FAF8F4] text-[#2C2C2C]/55 ring-black/10",
  );
}

function HomepageFilterDualPriceSlider({
  minPrice,
  maxPrice,
  onChange,
}: {
  minPrice: number;
  maxPrice: number;
  onChange: (next: { minPrice: number; maxPrice: number }) => void;
}) {
  const maxP = HOMEPAGE_FILTER_MAX_PRICE;
  const step = 1_000_000;
  const [active, setActive] = useState<"min" | "max" | null>(null);

  const rangeBase =
    "pointer-events-none absolute left-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#6B9E6E] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#6B9E6E] [&::-moz-range-thumb]:shadow-md";

  const minPct = (minPrice / maxP) * 100;
  const maxPct = (maxPrice / maxP) * 100;

  return (
    <div className="w-full">
      <div className="relative mx-1 h-5 min-h-[1.25rem]">
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-[#2C2C2C]"
          style={{ left: `${minPct}%` }}
        >
          {formatHomepageFilterPrice(minPrice)}
        </span>
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-[#2C2C2C]"
          style={{ left: `${maxPct}%` }}
        >
          {formatHomepageFilterPrice(maxPrice)}
        </span>
      </div>
      <div className="relative mx-1 mt-0.5 h-7 touch-none" onPointerUp={() => setActive(null)}>
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-200" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#6B9E6E]"
          style={{
            left: `${minPct}%`,
            width: `${Math.max(0, maxPct - minPct)}%`,
          }}
        />
        <input
          type="range"
          min={0}
          max={maxP}
          step={step}
          value={minPrice}
          aria-label="Minimum price"
          onPointerDown={() => setActive("min")}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ minPrice: Math.min(v, maxPrice), maxPrice });
          }}
          className={cn(rangeBase, active === "min" ? "z-[36]" : "z-[30]")}
        />
        <input
          type="range"
          min={0}
          max={maxP}
          step={step}
          value={maxPrice}
          aria-label="Maximum price"
          onPointerDown={() => setActive("max")}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ minPrice, maxPrice: Math.max(v, minPrice) });
          }}
          className={cn(rangeBase, active === "max" ? "z-[36]" : "z-[32]")}
        />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#2C2C2C]/40">
            Min
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={formatPesoInputLong(minPrice)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              const n = digits ? Number(digits) : 0;
              if (!Number.isFinite(n)) return;
              onChange({ minPrice: Math.min(Math.max(0, n), maxPrice), maxPrice });
            }}
            className="w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
            aria-label="Minimum price (pesos)"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#2C2C2C]/40">
            Max
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={formatPesoInputLong(maxPrice)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              const n = digits ? Number(digits) : HOMEPAGE_FILTER_MAX_PRICE;
              if (!Number.isFinite(n)) return;
              onChange({
                minPrice,
                maxPrice: Math.max(Math.min(HOMEPAGE_FILTER_MAX_PRICE, n), minPrice),
              });
            }}
            className="w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
            aria-label="Maximum price (pesos)"
          />
        </div>
      </div>
    </div>
  );
}

function countActiveFilters(filters: FiltersState, sortMode: SortMode): number {
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
  if (sortMode !== "newest") n++;
  return n;
}

function activeFilterChips(
  filters: FiltersState,
  sortMode: SortMode,
  actions: {
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
  },
) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.minPrice !== 0 || filters.maxPrice !== HOMEPAGE_FILTER_MAX_PRICE) {
    chips.push({
      key: "price",
      label: `Price ${formatHomepageFilterPrice(filters.minPrice)}–${formatHomepageFilterPrice(filters.maxPrice)}`,
      onRemove: actions.clearPrice,
    });
  }
  if (filters.beds !== "any") {
    chips.push({ key: "beds", label: `Beds ${filters.beds === 4 ? "4+" : filters.beds}`, onRemove: actions.clearBeds });
  }
  if (filters.baths !== "any") {
    chips.push({ key: "baths", label: `Baths ${filters.baths === 4 ? "4+" : filters.baths}`, onRemove: actions.clearBaths });
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
    chips.push({
      key: "kind",
      label: `Type ${t}`,
      onRemove: actions.clearKind,
    });
  }
  if (filters.transactionType !== "any") {
    chips.push({
      key: "tx",
      label: filters.transactionType === "for_rent" ? "Rent" : "Sale",
      onRemove: actions.clearTransaction,
    });
  }
  if (filters.furnishing !== "any") {
    chips.push({
      key: "furnish",
      label: `Furnishing ${filters.furnishing}`,
      onRemove: actions.clearFurnishing,
    });
  }
  if (filters.floorAreaMin.trim() || filters.floorAreaMax.trim()) {
    chips.push({
      key: "sqm",
      label: `Area ${filters.floorAreaMin || "—"}–${filters.floorAreaMax || "—"} sqm`,
      onRemove: actions.clearFloor,
    });
  }
  if (filters.locationLabel) {
    chips.push({ key: "loc", label: filters.locationLabel, onRemove: actions.clearLocation });
  }
  if (filters.amenities.length > 0 || filters.amenityExtra.nearSchools || filters.amenityExtra.familyFriendly) {
    chips.push({
      key: "amen",
      label: `Amenities (${filters.amenities.length + (filters.amenityExtra.nearSchools ? 1 : 0) + (filters.amenityExtra.familyFriendly ? 1 : 0)})`,
      onRemove: actions.clearAmenities,
    });
  }
  if (sortMode !== "newest") {
    const label =
      sortMode === "price_low"
        ? "Sort Price ↑"
        : sortMode === "price_high"
          ? "Sort Price ↓"
          : sortMode === "most_beds"
            ? "Sort Beds"
            : "Sort";
    chips.push({ key: "sort", label, onRemove: actions.clearSort });
  }
  return chips;
}

function PropertyRows({
  rows,
  showMore,
  onToggleShowMore,
  rowRefs,
  cardRoomIdx,
  setCardRoomIdx,
  engagement,
  connectedAgentsByPropertyId,
  viewerUserId,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
  listingsOnboardingHref,
  rowTitleSuffix,
}: {
  rows: {
    key: string;
    title: string;
    subtitle: string;
    items: DbProperty[];
    featured?: boolean;
    titleHref?: string;
  }[];
  showMore: boolean;
  onToggleShowMore: () => void;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  engagement: PropertyEngagement;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
  listingsOnboardingHref: string;
  /** When set (featured city browse), append to each row title, e.g. " in Makati". */
  rowTitleSuffix?: string;
}) {
  const dedupedRows = useMemo(() => {
    if (rows.length <= 1) return rows;
    const seen = new Set<string>();
    const out: typeof rows = [];
    const MIN_ITEMS_PER_ROW = 3;
    const MIN_ITEMS_SPARSE = 2;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      if (out.length === 0) {
        if (r.items.length === 0) continue;
        out.push(r);
        for (const p of r.items) seen.add(p.id);
        continue;
      }
      const unique = r.items.filter((p) => !seen.has(p.id));
      // If a row doesn’t have enough unique listings (common because many rows are derived
      // from the same base list), allow a controlled amount of overlap so we render
      // multiple rows instead of collapsing the entire homepage into 1 row.
      let nextItems = unique;
      if (nextItems.length < MIN_ITEMS_PER_ROW && r.items.length >= MIN_ITEMS_PER_ROW) {
        const need = MIN_ITEMS_PER_ROW - nextItems.length;
        const overlap = r.items.filter((p) => seen.has(p.id)).slice(0, need);
        nextItems = [...nextItems, ...overlap];
      }

      if (nextItems.length < MIN_ITEMS_SPARSE) continue;
      for (const p of nextItems) seen.add(p.id);
      out.push({ ...r, items: nextItems });
    }
    return out;
  }, [rows]);

  const eagerListingThumbKey = useMemo(() => firstBrowseListingThumbKey(dedupedRows), [dedupedRows]);
  const priorityListingThumbKeys = useMemo(() => listingThumbPriorityKeys(dedupedRows, 10), [dedupedRows]);
  const first = dedupedRows.slice(0, 4);
  const rest = dedupedRows.slice(4);

  const titleWithSuffix = (t: string) => (rowTitleSuffix ? `${t}${rowTitleSuffix}` : t);

  return (
    <div className="space-y-6">
      {first.map((r, i) => (
        <div key={r.key}>
          <RowCarousel
            rowKey={r.key}
            title={titleWithSuffix(r.title)}
            subtitle={r.subtitle}
            items={r.items}
            featured={!!r.featured}
            titleHref={r.titleHref}
            rowRefs={rowRefs}
            cardRoomIdx={cardRoomIdx}
            setCardRoomIdx={setCardRoomIdx}
            engagement={engagement}
            connectedAgentsByPropertyId={connectedAgentsByPropertyId}
            viewerUserId={viewerUserId}
            onOpenPropertyZoom={onOpenPropertyZoom}
            viewerVerifiedListingAgent={viewerVerifiedListingAgent}
            listingsOnboardingHref={listingsOnboardingHref}
            eagerListingThumbKey={eagerListingThumbKey}
            priorityListingThumbKeys={priorityListingThumbKeys}
          />
          {i < first.length - 1 ? (
            <hr className="mx-auto my-3 w-3/4 border-t border-[#2C2C2C]/10" />
          ) : null}
        </div>
      ))}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleShowMore}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2C2C]/75 ring-1 ring-black/10 hover:bg-neutral-50"
        >
          {showMore ? "Show Less ↑" : "Show More Categories ↓"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showMore ? (
          <motion.div
            key="more-cats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden space-y-6"
          >
            {rest.map((r) => (
              <div key={r.key}>
                <RowCarousel
                  rowKey={r.key}
                  title={titleWithSuffix(r.title)}
                  subtitle={r.subtitle}
                  items={r.items}
                  featured={!!r.featured}
                  titleHref={r.titleHref}
                  rowRefs={rowRefs}
                  cardRoomIdx={cardRoomIdx}
                  setCardRoomIdx={setCardRoomIdx}
                  engagement={engagement}
                  connectedAgentsByPropertyId={connectedAgentsByPropertyId}
                  viewerUserId={viewerUserId}
                  onOpenPropertyZoom={onOpenPropertyZoom}
                  viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                  listingsOnboardingHref={listingsOnboardingHref}
                  eagerListingThumbKey={eagerListingThumbKey}
                  priorityListingThumbKeys={priorityListingThumbKeys}
                />
                <hr className="mx-auto my-3 w-3/4 border-t border-[#2C2C2C]/10" />
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ListingsComingSoonPlaceholderCard({
  cardWidthClass,
  href,
}: {
  cardWidthClass: string;
  href: string;
}) {
  return (
    <motion.div
      className="shrink-0"
      animate={{ opacity: [0.88, 1, 0.88] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <Link
        href={href}
        className={cn(
          "flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#6B9E6E] bg-[#FAF8F4] px-3 py-8 text-center shadow-sm transition hover:bg-[#F4F1EA]",
          cardWidthClass,
        )}
      >
        <Home className="mb-3 h-11 w-11 text-[#6B9E6E]" strokeWidth={1.5} aria-hidden />
        <p className="text-sm font-semibold text-[#2C2C2C]">More listings coming soon</p>
        <p className="mt-2 text-xs font-semibold text-[#6B9E6E]">Be the first to list here →</p>
      </Link>
    </motion.div>
  );
}

function AgentScoreTutorialCard({ compact }: { compact?: boolean }) {
  const mariaAvatar =
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face";

  if (compact) {
    return (
      <div className="w-full rounded-xl border border-[#6B9E6E]/40 bg-[#6B9E6E]/15 p-3 shadow-sm">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2C2C2C]/55">
          Score guide
        </p>
        <div className="mt-2 rounded-xl border border-[#2C2C2C]/10 bg-white p-2.5 shadow-sm">
          <div className="flex gap-2.5">
            <div className="relative aspect-square h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
              <Image
                src={mariaAvatar}
                alt=""
                width={40}
                height={40}
                className="object-cover"
                sizes="40px"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold text-[#2C2C2C]">Maria Santos</p>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#D4A843]/18 px-1.5 py-0.5 text-[9px] font-semibold text-[#8a6d32]">
                  <Flame className="h-2.5 w-2.5 text-[#D4A843]" aria-hidden />
                  Verified
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold text-[#2C2C2C]/60">
                Score {formatAgentScore(95)} · 312 closings ·{" "}
                <span className="text-[#6B9E6E]">Fast response</span>
              </p>
            </div>
          </div>
        </div>
        <div className="mt-2.5">
          <h3 className="font-serif text-sm font-semibold text-[#2C2C2C]">How Scores Work</h3>
          <ul className="mt-1.5 space-y-1 text-[11px] font-medium text-[#2C2C2C]/85">
            <li className="flex gap-1.5">
              <Star className="mt-0.5 h-3 w-3 shrink-0 text-[#D4A843]" aria-hidden />
              <span>
                <strong className="text-[#2C2C2C]">9.0–10.0:</strong> Elite
              </span>
            </li>
            <li className="flex gap-1.5">
              <Star className="mt-0.5 h-3 w-3 shrink-0 text-[#D4A843]" aria-hidden />
              <span>
                <strong className="text-[#2C2C2C]">7.0–8.9:</strong> Experienced
              </span>
            </li>
            <li className="flex gap-1.5">
              <Star className="mt-0.5 h-3 w-3 shrink-0 text-[#D4A843]" aria-hidden />
              <span>
                <strong className="text-[#2C2C2C]">5.0–6.9:</strong> Growing
              </span>
            </li>
          </ul>
          <p className="mt-2 text-[10px] font-semibold leading-snug text-[#2C2C2C]/55">
            Based on closings, response time, reviews
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[300px] w-full flex-col rounded-2xl border border-[#6B9E6E]/40 bg-[#6B9E6E]/15 p-5 shadow-sm">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#2C2C2C]/55">
        Score guide
      </p>
      <div className="mt-3 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
            <Image
              src={mariaAvatar}
              alt=""
              width={56}
              height={56}
              className="object-cover"
              sizes="56px"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[#2C2C2C]">Maria Santos</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-0.5 text-[10px] font-semibold text-[#8a6d32]">
                <Flame className="h-3 w-3 text-[#D4A843]" aria-hidden />
                Verified
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/60">
              Score {formatAgentScore(95)} · 312 closings
            </p>
            <p className="mt-1 text-[11px] font-semibold text-[#6B9E6E]">Fast response</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex-1">
        <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">How Scores Work</h3>
        <ul className="mt-3 space-y-2 text-sm font-medium text-[#2C2C2C]/85">
          <li className="flex">
            <Star className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
            <span>
              <strong className="text-[#2C2C2C]">9.0–10.0:</strong> Elite Agent
            </span>
          </li>
          <li className="flex">
            <Star className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
            <span>
              <strong className="text-[#2C2C2C]">7.0–8.9:</strong> Experienced
            </span>
          </li>
          <li className="flex">
            <Star className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
            <span>
              <strong className="text-[#2C2C2C]">5.0–6.9:</strong> Growing
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs font-semibold leading-relaxed text-[#2C2C2C]/60">
          Score based on: closings, response time, client reviews
        </p>
      </div>
    </div>
  );
}

function MoreAgentsComingSoonCard() {
  return (
    <motion.div
      className="w-[180px] shrink-0 lg:w-[300px]"
      animate={{ opacity: [0.88, 1, 0.88] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <Link
        href="/register/agent"
        className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#6B9E6E] bg-[#FAF8F4] px-4 py-8 text-center shadow-sm transition hover:bg-[#F4F1EA] md:min-h-[340px]"
      >
        <UserPlus className="mb-3 h-11 w-11 text-[#6B9E6E]" strokeWidth={1.5} aria-hidden />
        <h3 className="font-serif text-lg font-semibold tracking-tight text-[#2C2C2C]">More Agents Coming Soon</h3>
        <p className="mt-2 text-sm font-semibold text-[#2C2C2C]">Join as a verified agent</p>
      </Link>
    </motion.div>
  );
}

function RowCarousel({
  rowKey,
  title,
  subtitle,
  items,
  featured,
  titleHref,
  rowRefs,
  cardRoomIdx,
  setCardRoomIdx,
  engagement,
  connectedAgentsByPropertyId,
  viewerUserId,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
  listingsOnboardingHref,
  eagerListingThumbKey,
  priorityListingThumbKeys,
}: {
  rowKey: string;
  title: string;
  subtitle: string;
  items: DbProperty[];
  featured: boolean;
  titleHref?: string;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  engagement: PropertyEngagement;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
  listingsOnboardingHref: string;
  eagerListingThumbKey?: string;
  priorityListingThumbKeys?: Set<string>;
}) {
  const scroll = (dir: "prev" | "next") => {
    const el = rowRefs.current[rowKey];
    if (!el) return;
    const step = Math.max(300, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const list = items.slice(0, 12);
  const fillerCount =
    list.length === 0 ? 3 : list.length > 0 && list.length < 5 ? 5 - list.length : 0;
  const featuredClasses = featured ? "rounded-2xl border border-[#D4A843]/30 bg-[#D4A843]/5 px-3 pt-3" : "";
  const cardWidthClass = "w-[220px] shrink-0 sm:w-[232px] lg:w-[240px]";
  const reserveBrowseSectionMinH = title.startsWith("Newly Listed Rentals");
  const isFeaturedPicksRow = title.startsWith("Featured Picks");

  const scrollTrack = (
    <div
      ref={(el) => {
        rowRefs.current[rowKey] = el;
      }}
      className={cn(
        "min-w-0 overflow-x-auto px-1 pb-2 scrollbar-hide",
        isFeaturedPicksRow ? "md:px-10" : "flex-1",
      )}
    >
      <div className="flex w-max flex-nowrap gap-3">
        {list.map((p, idx) => (
          <NewlyListedCard
            key={`${rowKey}-${p.id}`}
            property={p}
            roomUrls={roomUrlsFor(p)}
            roomIdx={cardRoomIdx[p.id] ?? 0}
            onRoomPrev={() =>
              setCardRoomIdx((s) => ({
                ...s,
                [p.id]:
                  (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) % Math.max(1, roomUrlsFor(p).length),
              }))
            }
            onRoomNext={() =>
              setCardRoomIdx((s) => ({
                ...s,
                [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
              }))
            }
            engagement={engagement}
            connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
            onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
            cardWidthClass={cardWidthClass}
            viewerUserId={viewerUserId}
            compact
            verifiedListingAgent={viewerVerifiedListingAgent}
            listingImageLoadEager={
              eagerListingThumbKey === `${rowKey}-${p.id}` || (featured && idx < 4)
            }
            listingImagePriority={
              (priorityListingThumbKeys?.has(`${rowKey}-${p.id}`) ?? false) || (featured && idx < 6)
            }
          />
        ))}
        {Array.from({ length: fillerCount }).map((_, i) => (
          <ListingsComingSoonPlaceholderCard
            key={`ph-${rowKey}-${i}`}
            cardWidthClass={cardWidthClass}
            href={listingsOnboardingHref}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn(featuredClasses, reserveBrowseSectionMinH && "min-h-[400px]")}>
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {featured ? <Star className="h-4 w-4 shrink-0 text-[#D4A843]" /> : null}
          {titleHref ? (
            <Link
              href={titleHref}
              className="min-w-0 font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] hover:underline sm:text-3xl"
            >
              {title}
            </Link>
          ) : (
            <h2 className="min-w-0 font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] sm:text-3xl">
              {title}
            </h2>
          )}
        </div>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      {isFeaturedPicksRow ? (
        <div className="relative -mx-4">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          <button
            type="button"
            onClick={() => scroll("next")}
            className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow-md md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
          </button>
          {scrollTrack}
        </div>
      ) : (
        <div className="-mx-4 flex items-stretch gap-1 md:gap-2">
          <button
            type="button"
            onClick={() => scroll("prev")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pl-2"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {scrollTrack}
          <button
            type="button"
            onClick={() => scroll("next")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pr-2"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

