import { findRentHomepageSpotlightUptownParkSuite } from "@/lib/homepage-spotlight-pin";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty } from "@/lib/marketplace-property";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { hideTutorialDemoPropertiesOrFilter } from "@/lib/tutorial-demo-property-filter";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retryOnTransientFetchError } from "@/lib/transient-fetch-retry";
import { supabase } from "@/lib/supabase";

const HOMEPAGE_PROPERTY_SELECT = `
  id, created_at, name, location, region, city, neighborhood, price, rent_price, listing_type, sqft, beds, baths, image_url, status, listed_by, description, property_type,
  is_presale, developer_name, turnover_date, unit_types, deleted_at, availability_state,
  duplicate_of_property_id, flagged_for_admin_review,
  property_photos (url, sort_order, created_at),
  property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, listing_tier, updated_at, agencies (id, company_name, logo_url), profiles(email, phone)))
`;

/** Featured city keys used for neighborhood filter queries. */
const FEATURED_CITY_QUERY: Record<string, string> = {
  BGC: "BGC",
  Makati: "Makati",
  "Cebu City": "Cebu City",
  Davao: "Davao",
  Ortigas: "Ortigas",
  Tagaytay: "Tagaytay",
  Pasig: "Pasig",
  Mandaluyong: "Mandaluyong",
  "Quezon City": "Quezon City",
  Alabang: "Alabang",
  Pasay: "Pasay",
  Paranaque: "Parañaque",
  "Las Pinas": "Las Piñas",
  Antipolo: "Antipolo",
  Batangas: "Batangas",
  Iloilo: "Iloilo",
  Bacolod: "Bacolod",
};

const FEATURED_LOCATION_ROWS = [
  { label: "BGC", match: { neighborhood: "BGC" } },
  { label: "Makati", match: { city: "Makati" } },
  { label: "Ortigas", match: { neighborhood: "Ortigas Center" } },
  { label: "Cebu City", match: { city: "Cebu City" } },
  { label: "Davao", match: { city: "Davao" } },
  { label: "Tagaytay", match: { city: "Tagaytay" } },
  { label: "Bacolod", match: { city: "Bacolod" } },
] as const;

export type HomepagePropertiesResult = {
  list: DbProperty[];
  featured: DbProperty | null;
  isAdminFeatured: boolean;
};

export type HomepageAgentsResult = {
  agents: MarketplaceAgent[];
};

function isExcludedFromPublicAgentDirectory(a: MarketplaceAgent): boolean {
  if (a.name.trim().toLowerCase() === "ron admin") return true;
  if (a.email.toLowerCase().includes("ron.business101")) return true;
  return false;
}

function shouldIncludeAgentDirectoryRow(row: unknown): boolean {
  const r = row as {
    name?: string | null;
    email?: string | null;
    profiles?: { role?: string | null } | { role?: string | null }[] | null;
  };
  const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  if (prof?.role === "admin" || prof?.role === "ops_admin") return false;
  if ((r.name ?? "").trim().toLowerCase() === "ron admin") return false;
  const em = (r.email ?? "").toLowerCase();
  if (em.includes("ron.business101")) return false;
  return true;
}

export async function fetchHomepagePropertiesWithClient(
  client: SupabaseClient,
  args: {
    neighborhoodFilter: string | null;
    listingTypeFilter: "sale" | "rent" | null;
  },
): Promise<HomepagePropertiesResult> {
  const { neighborhoodFilter, listingTypeFilter } = args;

  return retryOnTransientFetchError(async () => {
    const expiryOr = publicListingExpiryOrFilter();
    const featuredCityLabel =
      neighborhoodFilter != null ? FEATURED_CITY_QUERY[neighborhoodFilter] : null;
    const cityOrClause =
      featuredCityLabel != null
        ? `city.ilike.%${featuredCityLabel}%,location.ilike.%${featuredCityLabel}%`
        : null;

    let mainQuery = client
      .from("properties")
      .select(HOMEPAGE_PROPERTY_SELECT)
      .or(expiryOr)
      .or(hideTutorialDemoPropertiesOrFilter())
      .is("deleted_at", null)
      .or("availability_state.eq.available,availability_state.is.null");
    if (listingTypeFilter) mainQuery = mainQuery.eq("listing_type", listingTypeFilter);
    if (cityOrClause) mainQuery = mainQuery.or(cityOrClause);
    mainQuery = mainQuery.order("created_at", { ascending: false });

    let featQuery = client
      .from("properties")
      .select(HOMEPAGE_PROPERTY_SELECT)
      .eq("featured", true)
      .or(expiryOr)
      .or(hideTutorialDemoPropertiesOrFilter())
      .is("deleted_at", null)
      .or("availability_state.eq.available,availability_state.is.null");
    if (listingTypeFilter) featQuery = featQuery.eq("listing_type", listingTypeFilter);
    if (cityOrClause) featQuery = featQuery.or(cityOrClause);
    featQuery = featQuery.limit(1);

    let rentSpotlightQuery = client
      .from("properties")
      .select(HOMEPAGE_PROPERTY_SELECT)
      .eq("listing_type", "rent")
      .or(expiryOr)
      .or(hideTutorialDemoPropertiesOrFilter())
      .is("deleted_at", null)
      .or("availability_state.eq.available,availability_state.is.null")
      .or(
        "name.ilike.%uptown%,location.ilike.%uptown%,city.ilike.%taguig%,neighborhood.ilike.%uptown%,neighborhood.ilike.%bgc%",
      )
      .order("created_at", { ascending: false })
      .limit(24);
    if (cityOrClause) rentSpotlightQuery = rentSpotlightQuery.or(cityOrClause);

    const [mainRes, featRes, rentSpotlightRes] = await Promise.all([
      mainQuery,
      featQuery.maybeSingle(),
      listingTypeFilter === "rent" ? rentSpotlightQuery : Promise.resolve({ data: [], error: null }),
    ]);

    if (mainRes.error) throw mainRes.error;

    const list = (mainRes.data ?? []) as unknown as DbProperty[];
    const adminFeatured =
      !featRes.error && featRes.data ? (featRes.data as unknown as DbProperty) : null;
    const rentSpotlightCandidates = (rentSpotlightRes.data ?? []) as unknown as DbProperty[];
    const pinnedRentSpotlight = findRentHomepageSpotlightUptownParkSuite([
      ...rentSpotlightCandidates,
      ...list,
      ...(adminFeatured ? [adminFeatured] : []),
    ]);

    let featured: DbProperty | null = null;
    let isAdminFeatured = false;
    if (pinnedRentSpotlight) {
      featured = pinnedRentSpotlight;
    } else if (adminFeatured) {
      featured = adminFeatured;
      isAdminFeatured = true;
    } else if (list.length > 0) {
      featured = list[0];
    }

    return { list, featured, isAdminFeatured };
  });
}

export async function fetchHomepageProperties(args: {
  neighborhoodFilter: string | null;
  listingTypeFilter: "sale" | "rent" | null;
}): Promise<HomepagePropertiesResult> {
  return fetchHomepagePropertiesWithClient(supabase, args);
}

export async function fetchHomepageAgentsDirectory(): Promise<HomepageAgentsResult> {
  const { data, error: fetchErr } = await supabase
    .from("agents")
    .select("*, agencies(*), profiles!inner(email, phone, role)")
    .eq("status", "approved")
    .eq("verified", true)
    .eq("profiles.role", "agent")
    .neq("name", "Ron Admin");

  if (fetchErr) throw fetchErr;

  const filtered = (data ?? []).filter(shouldIncludeAgentDirectoryRow);
  const agents = filtered
    .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]))
    .filter((a) => !isExcludedFromPublicAgentDirectory(a));

  return { agents };
}

export async function fetchFeaturedLocationCounts(args: {
  mode: "buy" | "rent" | "all";
  listingTypeFilter: "sale" | "rent" | null;
}): Promise<Record<string, number>> {
  const statusIn =
    args.mode === "buy"
      ? ["for_sale", "both"]
      : args.mode === "rent"
        ? ["for_rent", "both"]
        : ["for_sale", "for_rent", "both"];

  const rows = await Promise.all(
    FEATURED_LOCATION_ROWS.map(async (loc) => {
      const field = "neighborhood" in loc.match ? "neighborhood" : "city";
      const value = (loc.match as { neighborhood?: string; city?: string })[field] ?? "";
      let q = supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .or(hideTutorialDemoPropertiesOrFilter())
        .or("availability_state.eq.available,availability_state.is.null")
        .in("status", statusIn);
      if (args.listingTypeFilter) q = q.eq("listing_type", args.listingTypeFilter);
      q = field === "neighborhood" ? q.eq("neighborhood", value) : q.eq("city", value);
      const { count, error } = await q;
      return { label: loc.label, count: error ? 0 : count ?? 0 };
    }),
  );

  const next: Record<string, number> = {};
  for (const r of rows) next[r.label] = r.count;
  return next;
}
