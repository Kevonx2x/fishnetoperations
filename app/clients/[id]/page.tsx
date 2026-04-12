"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Heart, Home, Lock, MapPin, Pin, Pencil } from "lucide-react";
import { ViewingAgentPickerModal } from "@/components/marketplace/viewing-agent-picker-modal";
import { ViewingRequestModal } from "@/components/marketplace/viewing-request-modal";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePinnedPropertyIds, usePropertyLikes } from "@/hooks/use-property-engagement";
import type { ProfileRole } from "@/lib/auth-roles";
import { listingListedLabel } from "@/lib/listing-listed-time";
import {
  formatBudgetRangePhp,
  isClientProfilePrefsComplete,
  isNonFilipinoCountry,
  lookingToLabel,
  preferredLocationsLabel,
  type ClientPreferenceFields,
} from "@/lib/client-profile-preferences";
import { ClientMyDocumentsSidePanel } from "@/components/clients/client-my-documents-side-panel";
import { MobileClientDashboard } from "@/components/client/mobile-client-dashboard";
import { parseClientDocRequestParams } from "@/components/settings/client-documents-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ReportProfileButton } from "@/components/report-profile-button";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import {
  filterFeedItemsByListingMode,
  filterLikeRowsByMode,
  oneProperty,
  pickPropertyImage,
  useClientActivityFeed,
  type LikeJoinRow,
  type ListingMode,
} from "@/hooks/use-client-activity-feed";
import {
  AllFeedTab,
  BadgesTab,
  DocumentsTab,
} from "@/components/client/mobile-client-dashboard";

type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string;
  status: string;
  listing_status: string | null;
  created_at: string;
  listed_by: string | null;
  /** Agents linked via property_agents (+ listed_by fallback when join is empty). */
  connectedAgents: MarketplaceAgent[];
};

function listingAgentUserId(property: PropertyRow, agents: MarketplaceAgent[]): string | null {
  if (property.listed_by) {
    const match = agents.find((a) => a.userId === property.listed_by);
    if (match) return property.listed_by;
  }
  return agents[0]?.userId ?? null;
}

function connectedAgentsFromPropertyAgentsRaw(
  raw: { property_agents?: { agent?: unknown; agents?: unknown }[] | null },
): MarketplaceAgent[] {
  const nested = raw.property_agents ?? [];
  const mapped = nested
    .map((row) => {
      const r = row as { agent?: unknown; agents?: unknown } | null | undefined;
      const a = r?.agent ?? r?.agents;
      if (a && typeof a === "object" && !Array.isArray(a)) return a;
      if (Array.isArray(a) && a[0]) return a[0];
      return null;
    })
    .filter(Boolean)
    .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]));
  const seen = new Set<string>();
  return mapped.filter((a) => {
    if (!a.id || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function pinnedRelativeLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "Pinned recently";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  if (totalHours < 1) return "Pinned just now";
  if (totalHours < 24) return `Pinned ${totalHours} hours ago`;
  const totalDays = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (totalDays <= 6) return `Pinned ${totalDays} days ago`;
  if (totalDays < 30) {
    const weeks = Math.floor(totalDays / 7);
    return `Pinned ${weeks} weeks ago`;
  }
  const months = Math.floor(totalDays / 30);
  return `Pinned ${months} months ago`;
}

function visaExpiryDisplay(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(`${iso.trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return `Expires: ${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
}

type WishFilter = "all" | "sale" | "rent" | "sold";

const FILTERS: { id: WishFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sale", label: "For Sale" },
  { id: "rent", label: "For Rent" },
  { id: "sold", label: "Sold/Rented" },
];

const UUID_RE =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function isSoldOrOffMarket(p: PropertyRow): boolean {
  const ls = (p.listing_status ?? "").toLowerCase();
  return ls === "sold" || ls === "off_market";
}

function passesWishFilter(p: PropertyRow, f: WishFilter): boolean {
  if (f === "all") return true;
  if (f === "sale") return p.status === "for_sale" && !isSoldOrOffMarket(p);
  if (f === "rent") return p.status === "for_rent" && !isSoldOrOffMarket(p);
  if (f === "sold") return isSoldOrOffMarket(p);
  return true;
}

function passesOwnListingMode(p: PropertyRow, mode: ListingMode): boolean {
  if (isSoldOrOffMarket(p)) return false;
  return mode === "rent" ? p.status === "for_rent" : p.status === "for_sale";
}

function propertyRowFromLikeJoin(
  r: LikeJoinRow,
  wishlist: PropertyRow[],
): PropertyRow | null {
  const h = oneProperty(r.properties);
  if (!h?.id) return null;
  const pageP = wishlist.find((x) => x.id === h.id);
  if (pageP) return pageP;
  return {
    id: h.id,
    name: h.name,
    location: h.location,
    price: h.price,
    beds: 0,
    baths: 0,
    sqft: "",
    image_url: pickPropertyImage(h),
    status: String(h.status ?? ""),
    listing_status: null,
    created_at: "",
    listed_by: null,
    connectedAgents: [],
  };
}

type OwnMainTab = "all" | "pins" | "likes" | "badges" | "documents";

const OWN_MAIN_TABS: { id: OwnMainTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pins", label: "Pins" },
  { id: "likes", label: "Likes" },
  { id: "badges", label: "Badges" },
  { id: "documents", label: "Documents" },
];

function overlayLabel(p: PropertyRow): "SOLD" | "OFF MARKET" | null {
  const ls = (p.listing_status ?? "").toLowerCase();
  if (ls === "sold") return "SOLD";
  if (ls === "off_market") return "OFF MARKET";
  return null;
}

function ClientPublicProfilePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = typeof params.id === "string" ? params.id : "";
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [profileLoading, setProfileLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [clientProfile, setClientProfile] = useState<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    role: ProfileRole;
  } | null>(null);
  const [clientPrefs, setClientPrefs] = useState<
    | (ClientPreferenceFields & {
        preferred_locations: unknown;
        visa_type: string | null;
        visa_expiry: string | null;
        occupant_count: number | null;
        has_pets: boolean | null;
        move_in_timeline: string | null;
        agent_notes: string | null;
      })
    | null
  >(null);
  const [moveInFromRequests, setMoveInFromRequests] = useState<string | null>(null);
  const [viewerAgent, setViewerAgent] = useState<{
    listing_tier: string;
    verified: boolean;
    status: string;
  } | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [savedTotal, setSavedTotal] = useState(0);
  const [filter, setFilter] = useState<WishFilter>("all");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pinnedAtByPropertyId, setPinnedAtByPropertyId] = useState<Record<string, string>>({});
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [selectedViewingAgentUserId, setSelectedViewingAgentUserId] = useState<string | null>(null);
  const [selectedViewingProperty, setSelectedViewingProperty] = useState<PropertyRow | null>(null);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [freeAgentWishlistPreview, setFreeAgentWishlistPreview] = useState(false);
  const [documentsPanelOpen, setDocumentsPanelOpen] = useState(false);
  const [ownMainTab, setOwnMainTab] = useState<OwnMainTab>("all");
  const [ownListingMode, setOwnListingMode] = useState<ListingMode>("rent");
  const [ownDocViewBusy, setOwnDocViewBusy] = useState<string | null>(null);

  const clientId = rawId;
  const isOwn = Boolean(user?.id && user.id === clientId);
  const isAdmin = profile?.role === "admin";
  const isMobile = useIsMobile();

  const likes = usePropertyLikes();
  const pins = usePinnedPropertyIds();

  const ownActivityFeed = useClientActivityFeed(isOwn ? clientId : undefined);
  const {
    loading: ownFeedLoading,
    badges: ownBadges,
    likeRows: ownLikeRows,
    feedGrouped: ownFeedGrouped,
    feedAgentMeta: ownFeedAgentMeta,
    propertyStatusById: ownPropertyStatusById,
    ownDocs: ownOwnDocs,
    sharedDocs: ownSharedDocs,
  } = ownActivityFeed;

  const ownFeedGroupedFiltered = useMemo(() => {
    return ownFeedGrouped
      .map((g) => ({
        ...g,
        items: filterFeedItemsByListingMode(g.items, ownListingMode, ownPropertyStatusById),
      }))
      .filter((g) => g.items.length > 0);
  }, [ownFeedGrouped, ownListingMode, ownPropertyStatusById]);

  const ownLikeRowsFiltered = useMemo(
    () => filterLikeRowsByMode(ownLikeRows, ownListingMode),
    [ownLikeRows, ownListingMode],
  );

  const ownPinsSorted = useMemo(() => {
    const list = properties.filter((p) => passesOwnListingMode(p, ownListingMode));
    list.sort((a, b) => {
      const pa = pinnedAtByPropertyId[a.id];
      const pb = pinnedAtByPropertyId[b.id];
      const ta = pa ? new Date(pa).getTime() : 0;
      const tb = pb ? new Date(pb).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [properties, ownListingMode, pinnedAtByPropertyId]);

  const openOwnDesktopDocument = useCallback(async (file_url: string) => {
    setOwnDocViewBusy(file_url);
    try {
      const res = await fetch("/api/client/get-document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ file_url }),
      });
      const json = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) {
        return;
      }
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOwnDocViewBusy(null);
    }
  }, []);

  const canSeeWishlist = useMemo(() => {
    if (isOwn || isAdmin) return true;
    if (!viewerAgent?.verified || viewerAgent.status !== "approved") return false;
    const t = viewerAgent.listing_tier;
    if (t === "pro" || t === "featured" || t === "broker") return true;
    return freeAgentWishlistPreview;
  }, [isOwn, isAdmin, viewerAgent, freeAgentWishlistPreview]);

  const showClientPrefsCard = useMemo(() => {
    if (isOwn || !clientProfile) return false;
    if (isAdmin) return true;
    const ag = viewerAgent;
    return Boolean(
      ag &&
        ag.verified &&
        ag.status === "approved" &&
        ["pro", "featured", "broker"].includes(ag.listing_tier),
    );
  }, [isOwn, isAdmin, clientProfile, viewerAgent]);

  const prefsComplete = useMemo(
    () => (clientPrefs ? isClientProfilePrefsComplete(clientPrefs) : false),
    [clientPrefs],
  );

  /** When viewing own profile as client, viewing requests require complete profile prefs. */
  const viewingPrefsBlocked = useMemo(() => {
    if (!isOwn || profile?.role !== "client" || clientPrefs === null) return false;
    return !isClientProfilePrefsComplete(clientPrefs as ClientPreferenceFields);
  }, [isOwn, profile?.role, clientPrefs]);

  const moveInDisplay = useMemo(() => {
    if (!moveInFromRequests) return "—";
    const d = new Date(`${moveInFromRequests}T12:00:00`);
    return Number.isNaN(d.getTime())
      ? moveInFromRequests
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [moveInFromRequests]);

  useEffect(() => {
    if (!isOwn) return;
    const p = parseClientDocRequestParams(searchParams);
    if (p.requestAgentId && p.requestedTypes && p.requestedTypes.length > 0) {
      setDocumentsPanelOpen(true);
    }
  }, [isOwn, searchParams]);

  useEffect(() => {
    if (!UUID_RE.test(clientId)) {
      setClientProfile(null);
      setClientPrefs(null);
      setProfileLoading(false);
      setWishlistLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setProfileLoading(true);
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, created_at, role, budget_min, budget_max, looking_to, preferred_property_type, country_of_origin, preferred_locations, visa_type, visa_expiry, occupant_count, has_pets, move_in_timeline, agent_notes",
        )
        .eq("id", clientId)
        .maybeSingle();

      if (cancelled) return;

      if (pe || !p || (p as { role: string }).role !== "client") {
        setClientProfile(null);
        setClientPrefs(null);
        setProfileLoading(false);
        setWishlistLoading(false);
        return;
      }

      const row = p as {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        created_at: string;
        role: string;
        budget_min: number | null;
        budget_max: number | null;
        looking_to: string | null;
        preferred_property_type: string | null;
        country_of_origin: string | null;
        preferred_locations: unknown;
        visa_type: string | null;
        visa_expiry: string | null;
        occupant_count: number | null;
        has_pets: boolean | null;
        move_in_timeline: string | null;
        agent_notes: string | null;
      };

      setClientProfile({
        id: row.id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        created_at: row.created_at,
        role: row.role as ProfileRole,
      });
      setClientPrefs({
        budget_min: row.budget_min,
        budget_max: row.budget_max,
        looking_to: row.looking_to,
        preferred_property_type: row.preferred_property_type,
        country_of_origin: row.country_of_origin,
        preferred_locations: row.preferred_locations,
        visa_type: row.visa_type,
        visa_expiry: row.visa_expiry,
        occupant_count: row.occupant_count,
        has_pets: row.has_pets,
        move_in_timeline: row.move_in_timeline,
        agent_notes: row.agent_notes,
      });
      setProfileLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, supabase]);

  useEffect(() => {
    if (!UUID_RE.test(clientId) || !clientProfile || !showClientPrefsCard) {
      setMoveInFromRequests(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      let q = supabase
        .from("viewing_requests")
        .select("preferred_move_in_date")
        .eq("client_user_id", clientId)
        .not("preferred_move_in_date", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!isAdmin && user?.id) {
        q = q.eq("agent_user_id", user.id);
      }
      const { data } = await q.maybeSingle();
      if (cancelled) return;
      const raw = (data as { preferred_move_in_date?: string } | null)?.preferred_move_in_date;
      setMoveInFromRequests(raw ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, clientProfile, showClientPrefsCard, isAdmin, user?.id, supabase]);

  useEffect(() => {
    if (!UUID_RE.test(clientId) || !clientProfile || authLoading) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setWishlistLoading(true);
      try {
        const uid = user?.id;
        let ag: {
          listing_tier: string;
          verified: boolean;
          status: string;
        } | null = null;

        if (uid && uid !== clientId) {
          const { data: agRow } = await supabase
            .from("agents")
            .select("listing_tier, verified, status")
            .eq("user_id", uid)
            .maybeSingle();
          if (agRow) {
            ag = {
              listing_tier: String((agRow as { listing_tier: string }).listing_tier),
              verified: Boolean((agRow as { verified?: boolean }).verified),
              status: String((agRow as { status?: string }).status ?? ""),
            };
          }
        }
        if (cancelled) return;
        setViewerAgent(ag);

        const own = uid === clientId;
        const admin = profile?.role === "admin";
        const tierOk =
          ag &&
          ag.verified &&
          ag.status === "approved" &&
          ["pro", "featured", "broker"].includes(ag.listing_tier);

        const freeAgentViewer =
          Boolean(uid && uid !== clientId) &&
          !own &&
          !admin &&
          Boolean(ag && ag.verified && ag.status === "approved" && !tierOk);

        const allowWishlist = own || admin || tierOk || freeAgentViewer;

        if (!allowWishlist) {
          setFreeAgentWishlistPreview(false);
          setProperties([]);
          setLikeCounts({});
          setSaveCounts({});
          setSavedTotal(0);
          setPinnedAtByPropertyId({});
          return;
        }

        const { data: saves } = await supabase
          .from("saved_properties")
          .select("property_id, created_at")
          .eq("user_id", clientId);
        let pinMap: Record<string, string> = {};
        for (const r of saves ?? []) {
          const row = r as { property_id: string; created_at: string };
          pinMap[row.property_id] = row.created_at;
        }
        if (cancelled) return;

        let ids = Object.keys(pinMap);

        if (freeAgentViewer) {
          const { data: agentRow } = await supabase
            .from("agents")
            .select("id")
            .eq("user_id", uid)
            .maybeSingle();
          const agentRecordId = (agentRow as { id?: string } | null)?.id;
          if (!agentRecordId) {
            setFreeAgentWishlistPreview(false);
            setProperties([]);
            setLikeCounts({});
            setSaveCounts({});
            setSavedTotal(0);
            setPinnedAtByPropertyId({});
            return;
          }
          const { data: ownedProps } = await supabase
            .from("properties")
            .select("id")
            .eq("listed_by", uid);
          const mine = new Set(
            (ownedProps ?? []).map((r) => (r as { id: string }).id),
          );
          const { data: paLinks } = await supabase
            .from("property_agents")
            .select("property_id")
            .eq("agent_id", agentRecordId);
          for (const r of paLinks ?? []) {
            mine.add((r as { property_id: string }).property_id);
          }
          ids = ids.filter((pid) => mine.has(pid));
          pinMap = Object.fromEntries(
            Object.entries(pinMap).filter(([pid]) => mine.has(pid)),
          );
          if (ids.length === 0) {
            setFreeAgentWishlistPreview(false);
            setProperties([]);
            setLikeCounts({});
            setSaveCounts({});
            setSavedTotal(0);
            setPinnedAtByPropertyId({});
            return;
          }
          setFreeAgentWishlistPreview(true);
        } else {
          setFreeAgentWishlistPreview(false);
        }

        if (cancelled) return;
        setPinnedAtByPropertyId(pinMap);

        if (cancelled) return;
        setSavedTotal(ids.length);

        if (ids.length === 0) {
          setProperties([]);
          setLikeCounts({});
          setSaveCounts({});
          return;
        }

        const { data: props, error: propsErr } = await supabase
          .from("properties")
          .select(
            `
            id, name, location, price, beds, baths, sqft, image_url, status, listing_status, created_at, listed_by,
            property_agents (
              agent:agents (
                id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at,
                verified, status,
                brokers (id, company_name, logo_url),
                profiles(email, phone)
              )
            )
          `,
          )
          .in("id", ids)
          .or(publicListingExpiryOrFilter());

        if (cancelled) return;

        if (propsErr) {
          console.error(propsErr);
          setProperties([]);
          setLikeCounts({});
          setSaveCounts({});
          return;
        }

        let list: PropertyRow[] = (props ?? []).map((raw) => {
          const r = raw as Record<string, unknown>;
          return {
            id: String(r.id),
            name: (r.name as string | null) ?? null,
            location: String(r.location ?? ""),
            price: String(r.price ?? ""),
            beds: Number(r.beds) || 0,
            baths: Number(r.baths) || 0,
            sqft: String(r.sqft ?? ""),
            image_url: String(r.image_url ?? ""),
            status: String(r.status ?? ""),
            listing_status: (r.listing_status as string | null) ?? null,
            created_at: String(r.created_at ?? ""),
            listed_by: (r.listed_by as string | null) ?? null,
            connectedAgents: connectedAgentsFromPropertyAgentsRaw(
              raw as { property_agents?: { agent?: unknown }[] },
            ),
          };
        });

        const missingListedBy = list.filter((p) => !p.listed_by).map((p) => p.id);
        if (missingListedBy.length > 0) {
          const { data: paRows, error: paErr } = await supabase
            .from("property_agents")
            .select("property_id, agent_id")
            .in("property_id", missingListedBy);
          if (!paErr && paRows?.length) {
            const agentIds = [
              ...new Set(
                (paRows as { agent_id: string }[]).map((r) => r.agent_id),
              ),
            ];
            const { data: ags } = await supabase
              .from("agents")
              .select("id, user_id")
              .in("id", agentIds);
            const userByAgentId = new Map(
              (ags ?? []).map((a) => {
                const row = a as { id: string; user_id: string | null };
                return [row.id, row.user_id] as const;
              }),
            );
            const firstUserByProperty = new Map<string, string>();
            for (const pa of paRows as { property_id: string; agent_id: string }[]) {
              const listerUid = userByAgentId.get(pa.agent_id);
              if (listerUid && !firstUserByProperty.has(pa.property_id)) {
                firstUserByProperty.set(pa.property_id, listerUid);
              }
            }
            list = list.map((p) => ({
              ...p,
              listed_by: p.listed_by ?? firstUserByProperty.get(p.id) ?? null,
            }));
          }
        }

        const listedByNeedingAgent = [
          ...new Set(
            list
              .filter((p) => p.connectedAgents.length === 0 && p.listed_by)
              .map((p) => p.listed_by!),
          ),
        ];
        if (listedByNeedingAgent.length > 0) {
          const { data: agentRows } = await supabase
            .from("agents")
            .select(
              `
              id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at,
              verified, status,
              brokers (id, company_name, logo_url),
              profiles(email, phone)
            `,
            )
            .in("user_id", listedByNeedingAgent);
          const byUserId = new Map<string, MarketplaceAgent>();
          for (const row of agentRows ?? []) {
            const a = mapRowToMarketplaceAgent(
              row as Parameters<typeof mapRowToMarketplaceAgent>[0],
            );
            byUserId.set(a.userId, a);
          }
          list = list.map((p) => {
            if (p.connectedAgents.length > 0 || !p.listed_by) return p;
            const one = byUserId.get(p.listed_by);
            if (!one) return p;
            return { ...p, connectedAgents: [one] };
          });
        }

        const { data: paWithAgents, error: paBatchErr } = await supabase
          .from("property_agents")
          .select(
            `
            property_id,
            agent:agents (
              id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at,
              verified, status,
              brokers (id, company_name, logo_url),
              profiles(email, phone)
            )
          `,
          )
          .in("property_id", ids);

        if (paBatchErr) {
          console.error("[ClientWishlist] property_agents batch query failed", paBatchErr);
        } else {
          const byProperty = new Map<string, MarketplaceAgent[]>();
          for (const row of paWithAgents ?? []) {
            const r = row as { property_id: string; agent?: unknown };
            if (!r.agent) continue;
            const a = mapRowToMarketplaceAgent(
              r.agent as Parameters<typeof mapRowToMarketplaceAgent>[0],
            );
            if (!a.id) continue;
            const cur = byProperty.get(r.property_id) ?? [];
            if (!cur.some((x) => x.id === a.id)) cur.push(a);
            byProperty.set(r.property_id, cur);
          }
          list = list.map((p) => {
            const batch = byProperty.get(p.id);
            if (batch && batch.length > 0) return { ...p, connectedAgents: batch };
            return p;
          });
        }

        setProperties(list);

        const { data: counts } = await supabase.rpc("property_like_counts_for", {
          property_ids: ids,
        });
        if (cancelled) return;

        const map: Record<string, number> = {};
        for (const c of counts ?? []) {
          const r = c as { property_id: string; like_count: number };
          map[r.property_id] = Number(r.like_count);
        }
        setLikeCounts(map);

        const { data: saveRows } = await supabase.rpc("property_save_counts_for", {
          property_ids: ids,
        });
        if (cancelled) return;
        const sm: Record<string, number> = {};
        for (const row of saveRows ?? []) {
          const r = row as { property_id: string; save_count: number };
          sm[r.property_id] = Number(r.save_count);
        }
        setSaveCounts(sm);
      } finally {
        if (!cancelled) setWishlistLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, clientProfile, supabase, user?.id, profile?.role, authLoading]);

  const filtered = useMemo(
    () => properties.filter((p) => passesWishFilter(p, filter)),
    [properties, filter],
  );

  const sortedFiltered = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const pa = pinnedAtByPropertyId[a.id];
      const pb = pinnedAtByPropertyId[b.id];
      const ta = pa ? new Date(pa).getTime() : 0;
      const tb = pb ? new Date(pb).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [filtered, pinnedAtByPropertyId]);

  const removeFromWishlist = useCallback(
    async (propertyId: string) => {
      if (!user?.id || user.id !== clientId) return;
      setRemovingId(propertyId);
      try {
        await supabase
          .from("saved_properties")
          .delete()
          .eq("user_id", user.id)
          .eq("property_id", propertyId);
        setProperties((prev) => prev.filter((p) => p.id !== propertyId));
        setSavedTotal((c) => Math.max(0, c - 1));
        setPinnedAtByPropertyId((prev) => {
          const next = { ...prev };
          delete next[propertyId];
          return next;
        });
      } finally {
        setRemovingId(null);
      }
    },
    [clientId, supabase, user?.id],
  );

  const openViewingForProperty = useCallback(
    (p: PropertyRow) => {
      if (authLoading) return;
      if (!user) {
        setSignInPromptOpen(true);
        return;
      }
      const connectedAgents = p.connectedAgents ?? [];
      if (connectedAgents.length === 0) return;
      if (connectedAgents.length === 1) {
        setSelectedViewingProperty(p);
        setSelectedViewingAgentUserId(connectedAgents[0].userId);
        setShowViewingModal(true);
        return;
      }
      setSelectedViewingProperty(p);
      setSelectedViewingAgentUserId(null);
      setShowAgentPicker(true);
    },
    [authLoading, user],
  );

  const pageLoading = profileLoading || authLoading || wishlistLoading;

  if (!profileLoading && !clientProfile) {
    notFound();
  }

  if (
    clientProfile &&
    isOwn &&
    profile?.role === "client" &&
    isMobile
  ) {
    return <MobileClientDashboard />;
  }

  const displayName = clientProfile?.full_name?.trim() || "Member";
  const memberSince = clientProfile?.created_at
    ? new Date(clientProfile.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";

  const renderWishlistFacebookCard = (
    p: PropertyRow,
    opts: { variant: "pinned" | "liked"; activityIso: string | null },
  ) => {
    if (!clientProfile) return null;
    const overlay = overlayLabel(p);
    const likeTotal = likeCounts[p.id] ?? 0;
    const pinSaveN = saveCounts[p.id] ?? 0;
    const isHeartLiked = likes.has(p.id);
    const isPinSaved = pins.has(p.id);
    const pinnedIso = pinnedAtByPropertyId[p.id];
    const activityIso = opts.activityIso ?? pinnedIso ?? null;
    const activityLine = activityIso ? pinnedRelativeLabel(activityIso) : "Recently";
    const listedLine = listingListedLabel(p.created_at);
    const title = p.name?.trim() || p.location || "Listing";
    const statusLabel = p.status === "for_rent" ? "For Rent" : "For Sale";
    const agents = p.connectedAgents ?? [];
    const hasAgents = agents.length > 0;
    const showPinRemove = isOwn && Boolean(pinnedIso);

    return (
      <article
        key={`${opts.variant}-${p.id}-${activityIso ?? ""}`}
        className="overflow-hidden rounded-2xl border border-[#2C2C2C]/8 bg-white shadow-sm"
      >
        <div className="flex items-start gap-3 px-4 pt-4">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-black/10">
            {clientProfile.avatar_url?.trim() ? (
              <SupabasePublicImage
                src={clientProfile.avatar_url}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-sm font-bold text-white">
                {agentAvatarInitials(displayName)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#2C2C2C]">{displayName}</p>
            <p className="text-xs font-medium text-[#2C2C2C]/50">{activityLine}</p>
            <p className="text-xs font-medium text-[#2C2C2C]/50">{listedLine}</p>
          </div>
        </div>

        <div className="relative mt-3 w-full overflow-hidden">
          <Link
            href={`/properties/${encodeURIComponent(p.id)}`}
            className="relative block aspect-video w-full bg-[#2C2C2C]/5"
          >
            <Image
              src={p.image_url}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 70vw"
              className={`object-cover ${overlay ? "brightness-[0.55]" : ""}`}
            />
          </Link>
          {overlay ? (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/35">
              <span className="rounded-lg border-2 border-white/90 bg-black/40 px-6 py-2 font-serif text-xl font-bold tracking-widest text-white">
                {overlay}
              </span>
            </div>
          ) : null}
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
            {opts.variant === "pinned" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-md ring-1 ring-black/10">
                <Pin className="h-3.5 w-3.5 shrink-0 text-[#D4A843]" aria-hidden />
                Pinned
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-md ring-1 ring-black/10">
                <Heart className="h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500" aria-hidden />
                Liked
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-md ${
                p.status === "for_rent" ? "bg-[#D4A843] text-[#2C2C2C]" : "bg-[#6B9E6E]"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="absolute right-3 top-3 z-10 flex items-start gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void likes.toggle(p.id);
              }}
              className={cn(
                "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                isHeartLiked ? "border border-red-200 bg-white" : "border border-gray-200 bg-white/80",
              )}
              aria-label={likeTotal > 0 ? `${likeTotal} likes` : "Like"}
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isHeartLiked ? "fill-red-500 text-red-500" : "text-red-400",
                )}
                aria-hidden
              />
              {likeTotal > 0 ? (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isHeartLiked ? "text-red-500" : "text-red-400",
                  )}
                >
                  {likeTotal}
                </span>
              ) : null}
            </button>
            {showPinRemove ? (
              <button
                type="button"
                disabled={removingId === p.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void removeFromWishlist(p.id);
                }}
                className={cn(
                  "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4] disabled:opacity-50",
                  isPinSaved ? "border border-[#D4A843]/40 bg-white" : "border border-gray-200 bg-white/80",
                )}
                title="Remove from wishlist"
                aria-label={
                  pinSaveN > 0 ? `${pinSaveN} saves — remove from wishlist` : "Unpin from wishlist"
                }
              >
                <Pin
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isPinSaved ? "fill-[#D4A843] text-[#D4A843]" : "text-[#D4A843]",
                    removingId === p.id ? "opacity-35" : "",
                  )}
                  aria-hidden
                />
                {pinSaveN > 0 ? (
                  <span className="text-xs font-medium tabular-nums text-[#D4A843]">{pinSaveN}</span>
                ) : null}
              </button>
            ) : isOwn ? null : (
              <span
                className={cn(
                  "pointer-events-none inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm",
                  isPinSaved ? "border border-[#D4A843]/40 bg-white" : "border border-gray-200 bg-white/80",
                )}
                aria-label={pinSaveN > 0 ? `${pinSaveN} saves` : "Saves"}
              >
                <Pin
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isPinSaved ? "fill-[#D4A843] text-[#D4A843]" : "text-[#D4A843]",
                  )}
                  aria-hidden
                />
                {pinSaveN > 0 ? (
                  <span className="text-xs font-medium tabular-nums text-[#D4A843]">{pinSaveN}</span>
                ) : null}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1 px-4 pb-3 pt-3">
          <p className="font-serif text-2xl font-bold text-[#D4A843]">
            {formatPropertyPriceDisplay(
              p.price,
              p.status as "for_sale" | "for_rent" | "sold" | "rented",
            )}
          </p>
          <p className="font-serif text-lg font-bold text-[#2C2C2C]">{title}</p>
          <p className="flex items-start gap-1.5 text-sm text-[#2C2C2C]/55">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
            <span>{p.location}</span>
          </p>
          <p className="text-sm text-[#6B6B6B]">
            {p.sqft} sqft · {p.beds} beds · {p.baths} baths
          </p>
        </div>

        <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href={`/properties/${encodeURIComponent(p.id)}`}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#6B9E6E] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5d8a60] sm:w-auto"
          >
            View Property
          </Link>
          <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto">
            <button
              type="button"
              onClick={() => openViewingForProperty(p)}
              disabled={authLoading || !hasAgents || viewingPrefsBlocked}
              title={
                user && !hasAgents
                  ? "No agent available"
                  : viewingPrefsBlocked
                    ? "Complete your profile preferences to request a viewing."
                    : undefined
              }
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-[#6B9E6E] bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#6B9E6E]/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Calendar className="h-3.5 w-3.5 text-[#6B9E6E]" aria-hidden />
              Request Viewing
            </button>
            {!hasAgents ? (
              <p className="max-w-md text-xs leading-snug text-[#2C2C2C]/65">
                No listing agent is assigned to this property yet, so viewing requests are unavailable.
              </p>
            ) : viewingPrefsBlocked ? (
              <p className="max-w-md text-xs leading-snug text-[#2C2C2C]">
                Complete your profile preferences to request a viewing.{" "}
                <Link
                  href="/settings?tab=profile"
                  className="font-semibold text-[#6B9E6E] underline underline-offset-2"
                >
                  Open settings
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <MaddenTopNav />
      {pageLoading || !clientProfile ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
          Loading…
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
            <aside className="lg:sticky lg:top-24 lg:w-[30%] lg:shrink-0 lg:self-start">
              <div className="flex flex-col items-center rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center shadow-sm">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-[#2C2C2C]/10 bg-[#FAF8F4]">
                  {clientProfile.avatar_url?.trim() ? (
                    <SupabasePublicImage
                      src={clientProfile.avatar_url}
                      alt=""
                      width={112}
                      height={112}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-2xl font-bold text-white">
                      {agentAvatarInitials(displayName)}
                    </span>
                  )}
                </div>
                <h1 className="mt-4 font-serif text-2xl font-semibold text-[#2C2C2C]">
                  {displayName}
                </h1>
                <p className="mt-1 text-sm text-[#2C2C2C]/55">Member since {memberSince}</p>
                <p className="mt-4 text-sm font-semibold text-[#2C2C2C]">
                  <span className="text-[#6B9E6E]">{savedTotal}</span> properties saved
                </p>
                <p className="mt-1 text-xs text-[#2C2C2C]/45">0 properties viewed · coming soon</p>
                {isOwn && clientPrefs ? (
                  <div className="mt-6 w-full space-y-3 text-left">
                    <div className="rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">
                          My Preferences
                        </h3>
                        <Link
                          href="/settings?tab=profile"
                          className="rounded-lg p-1.5 text-[#6B9E6E] transition hover:bg-[#6B9E6E]/15"
                          aria-label="Edit preferences in settings"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Link>
                      </div>
                      <div className="mt-3 rounded-lg border border-[#6B9E6E]/30 bg-white/80 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B9E6E]">
                          Location & visa
                        </p>
                        <p className="mt-1 font-serif text-lg font-bold text-[#2C2C2C]">
                          {clientPrefs.country_of_origin?.trim() || "—"}
                        </p>
                        {isNonFilipinoCountry(clientPrefs.country_of_origin) ? (
                          <div className="mt-2 space-y-1 border-t border-[#2C2C2C]/10 pt-2 text-sm">
                            {clientPrefs.visa_type?.trim() ? (
                              <p className="font-semibold text-[#2C2C2C]">
                                Visa: {clientPrefs.visa_type.trim()}
                              </p>
                            ) : (
                              <p className="text-[#2C2C2C]/55">Visa not specified</p>
                            )}
                            {clientPrefs.visa_expiry?.trim() ? (
                              <p className="font-medium text-[#D4A843]">
                                {visaExpiryDisplay(clientPrefs.visa_expiry)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                            Budget
                          </dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            {clientPrefs.budget_min != null || clientPrefs.budget_max != null
                              ? formatBudgetRangePhp(clientPrefs.budget_min, clientPrefs.budget_max)
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                            Looking to
                          </dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            {lookingToLabel(clientPrefs.looking_to)}
                          </dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                            Property type
                          </dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            {clientPrefs.preferred_property_type?.trim() || "—"}
                          </dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                            Preferred areas
                          </dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            {preferredLocationsLabel(clientPrefs.preferred_locations)}
                          </dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                            Occupants
                          </dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            {clientPrefs.occupant_count != null
                              ? String(clientPrefs.occupant_count)
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                            Pets
                          </dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            {clientPrefs.has_pets === true
                              ? "Yes"
                              : clientPrefs.has_pets === false
                                ? "No"
                                : "—"}
                          </dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                            Move-in timeline
                          </dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            {clientPrefs.move_in_timeline?.trim() || "—"}
                          </dd>
                        </div>
                        {clientPrefs.agent_notes?.trim() ? (
                          <div className="flex flex-col gap-0.5">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                              Notes for agents
                            </dt>
                            <dd className="text-sm font-medium leading-snug text-[#2C2C2C]">
                              {clientPrefs.agent_notes.trim()}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <p
                      className={`text-center text-xs font-medium leading-snug ${
                        prefsComplete ? "text-[#6B9E6E]" : "text-[#D4A843]"
                      }`}
                    >
                      {prefsComplete
                        ? "✓ Profile preferences complete"
                        : "⚠️ Complete your preferences so agents can serve you better"}
                    </p>
                    <Link
                      href="/settings?tab=profile"
                      className="flex w-full items-center justify-center rounded-full bg-[#6B9E6E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60]"
                    >
                      Edit Profile Preferences
                    </Link>
                  </div>
                ) : null}
                {!isOwn ? <ReportProfileButton reportedUserId={clientId} /> : null}
              </div>
              {showClientPrefsCard && clientPrefs ? (
                <div className="mt-6 w-full rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-5 text-left shadow-sm">
                  <h3 className="font-serif text-base font-semibold text-[#2C2C2C]">
                    Client Preferences <span className="text-[#D4A843]">🔒</span>{" "}
                    <span className="text-sm font-normal text-[#2C2C2C]/70">Pro Feature</span>
                  </h3>
                  <div className="mt-4 rounded-lg border border-[#6B9E6E]/30 bg-white/80 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B9E6E]">
                      Location & visa
                    </p>
                    <p className="mt-1 font-serif text-lg font-bold text-[#2C2C2C]">
                      {clientPrefs.country_of_origin?.trim() || "—"}
                    </p>
                    {isNonFilipinoCountry(clientPrefs.country_of_origin) ? (
                      <div className="mt-2 space-y-1 border-t border-[#2C2C2C]/10 pt-2 text-sm">
                        {clientPrefs.visa_type?.trim() ? (
                          <p className="font-semibold text-[#2C2C2C]">
                            Visa: {clientPrefs.visa_type.trim()}
                          </p>
                        ) : (
                          <p className="text-[#2C2C2C]/55">Visa not specified</p>
                        )}
                        {clientPrefs.visa_expiry?.trim() ? (
                          <p className="font-medium text-[#D4A843]">
                            {visaExpiryDisplay(clientPrefs.visa_expiry)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <dl className="mt-4 space-y-2.5 text-sm">
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="shrink-0 text-[#2C2C2C]/55">Budget</dt>
                      <dd className="font-medium text-[#2C2C2C]">
                        {formatBudgetRangePhp(clientPrefs.budget_min, clientPrefs.budget_max)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="shrink-0 text-[#2C2C2C]/55">Looking to</dt>
                      <dd className="font-medium text-[#2C2C2C]">
                        {lookingToLabel(clientPrefs.looking_to)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="shrink-0 text-[#2C2C2C]/55">Property type</dt>
                      <dd className="font-medium text-[#2C2C2C]">
                        {clientPrefs.preferred_property_type?.trim() || "—"}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="shrink-0 text-[#2C2C2C]/55">Preferred areas</dt>
                      <dd className="font-medium text-[#2C2C2C]">
                        {preferredLocationsLabel(clientPrefs.preferred_locations)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <dt className="shrink-0 text-[#2C2C2C]/55">Move-in timeline</dt>
                      <dd className="font-medium text-[#2C2C2C]">{moveInDisplay}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </aside>

            <main className="min-w-0 flex-1 lg:w-[70%]">
              {isOwn ? (
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDocumentsPanelOpen(true)}
                    className="flex cursor-pointer items-center gap-1 text-sm font-medium text-[#6B9E6E]"
                  >
                    Documents <span aria-hidden>→</span>
                  </button>
                </div>
              ) : null}
              <h2 className="font-serif text-3xl font-semibold text-[#2C2C2C]">
                {isOwn
                  ? ownMainTab === "all"
                    ? "Activity"
                    : ownMainTab === "pins"
                      ? "My Home Wishlist"
                      : ownMainTab === "likes"
                        ? "Liked properties"
                        : ownMainTab === "badges"
                          ? "Badges"
                          : "Documents"
                  : "My Home Wishlist"}
              </h2>

              {!isOwn && !canSeeWishlist ? (
                <div className="mt-8 rounded-2xl border border-[#D4A843]/40 bg-gradient-to-br from-[#FAF8F4] to-white p-8 text-center shadow-sm">
                  <Lock className="mx-auto h-10 w-10 text-[#D4A843]" aria-hidden />
                  <p className="mt-4 font-serif text-lg font-bold text-[#2C2C2C]">
                    🔒 Pro Feature
                  </p>
                  <p className="mt-2 text-base font-semibold text-[#2C2C2C]">
                    Upgrade to Pro to see client property interests
                  </p>
                  <p className="mt-2 text-sm text-[#2C2C2C]/60">
                    Verified Pro or Featured agents can view wishlists to understand what buyers
                    love.
                  </p>
                  <Link
                    href="/dashboard/agent"
                    className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5d8a60]"
                  >
                    Open agent dashboard
                  </Link>
                </div>
              ) : isOwn ? (
                <>
                  <div className="mt-6 flex flex-wrap gap-2 border-b border-[#2C2C2C]/10 pb-px">
                    {OWN_MAIN_TABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setOwnMainTab(t.id)}
                        className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                          ownMainTab === t.id
                            ? "border-b-2 border-[#6B9E6E] text-[#6B9E6E]"
                            : "text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {(ownMainTab === "all" || ownMainTab === "pins" || ownMainTab === "likes") && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setOwnListingMode("rent")}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          ownListingMode === "rent"
                            ? "border-[#6B9E6E] bg-[#6B9E6E] text-white"
                            : "border-[#2C2C2C]/20 bg-white text-[#2C2C2C]/70",
                        )}
                      >
                        For Rent
                      </button>
                      <button
                        type="button"
                        onClick={() => setOwnListingMode("sale")}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          ownListingMode === "sale"
                            ? "border-[#6B9E6E] bg-[#6B9E6E] text-white"
                            : "border-[#2C2C2C]/20 bg-white text-[#2C2C2C]/70",
                        )}
                      >
                        For Sale
                      </button>
                    </div>
                  )}

                  {ownMainTab === "all" ? (
                    ownFeedLoading ? (
                      <div className="mt-8 space-y-4">
                        <div className="h-44 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-44 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-32 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                      </div>
                    ) : (
                      <div className="mt-8">
                        <AllFeedTab
                          grouped={ownFeedGroupedFiltered}
                          feedAgentMeta={ownFeedAgentMeta}
                          likes={likes}
                          pins={pins}
                          onViewBadges={() => setOwnMainTab("badges")}
                        />
                      </div>
                    )
                  ) : null}

                  {ownMainTab === "pins" ? (
                    wishlistLoading ? (
                      <div className="mt-8 space-y-4">
                        <div className="h-72 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-72 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                      </div>
                    ) : properties.length === 0 ? (
                      <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-[#FAF8F4]/50 py-16 text-center">
                        <Home className="h-14 w-14 text-[#6B9E6E]/50" strokeWidth={1.25} />
                        <p className="mt-4 font-medium text-[#2C2C2C]/70">
                          No saved properties yet. Start browsing!
                        </p>
                        <Link
                          href="/"
                          className="mt-4 text-sm font-semibold text-[#6B9E6E] underline underline-offset-2"
                        >
                          Browse listings
                        </Link>
                      </div>
                    ) : ownPinsSorted.length === 0 ? (
                      <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-[#2C2C2C]/8 bg-white px-4 py-12 text-center shadow-sm">
                        <Home className="mx-auto h-12 w-12 text-[#6B9E6E]/60" strokeWidth={1.25} />
                        <p className="mt-4 font-medium text-[#2C2C2C]/75">
                          No pinned listings in this category yet.
                        </p>
                        <button
                          type="button"
                          onClick={() => setOwnListingMode(ownListingMode === "rent" ? "sale" : "rent")}
                          className="mt-4 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-bold text-white hover:bg-[#5c8a5f]"
                        >
                          Switch to {ownListingMode === "rent" ? "For Sale" : "For Rent"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-8 flex flex-col gap-4">
                        {ownPinsSorted.map((p) =>
                          renderWishlistFacebookCard(p, {
                            variant: "pinned",
                            activityIso: pinnedAtByPropertyId[p.id] ?? null,
                          }),
                        )}
                      </div>
                    )
                  ) : null}

                  {ownMainTab === "likes" ? (
                    ownFeedLoading ? (
                      <div className="mt-8 space-y-4">
                        <div className="h-72 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-72 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                      </div>
                    ) : ownLikeRowsFiltered.length === 0 ? (
                      <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-[#FAF8F4]/50 py-16 text-center">
                        <Heart className="h-14 w-14 text-[#6B9E6E]/50" strokeWidth={1.25} />
                        <p className="mt-4 font-medium text-[#2C2C2C]/70">
                          No liked properties in this category yet.
                        </p>
                        <Link
                          href="/"
                          className="mt-4 text-sm font-semibold text-[#6B9E6E] underline underline-offset-2"
                        >
                          Browse listings
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-8 flex flex-col gap-4">
                        {ownLikeRowsFiltered.map((r) => {
                          const full = propertyRowFromLikeJoin(r, properties);
                          if (!full) return null;
                          return renderWishlistFacebookCard(full, {
                            variant: "liked",
                            activityIso: r.created_at,
                          });
                        })}
                      </div>
                    )
                  ) : null}

                  {ownMainTab === "badges" ? (
                    ownFeedLoading ? (
                      <div className="mt-8 grid grid-cols-2 gap-3">
                        <div className="h-40 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-40 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-40 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-40 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                      </div>
                    ) : (
                      <div className="mt-8 max-w-4xl">
                        <BadgesTab badges={ownBadges} />
                      </div>
                    )
                  ) : null}

                  {ownMainTab === "documents" ? (
                    ownFeedLoading ? (
                      <div className="mt-8 space-y-3">
                        <div className="h-24 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                        <div className="h-24 animate-pulse rounded-2xl bg-[#E8E6E1]" />
                      </div>
                    ) : (
                      <div className="mt-8 max-w-4xl">
                        <DocumentsTab
                          ownDocs={ownOwnDocs}
                          sharedDocs={ownSharedDocs}
                          viewBusyUrl={ownDocViewBusy}
                          onViewOwn={openOwnDesktopDocument}
                        />
                      </div>
                    )
                  ) : null}
                </>
              ) : (
                <>
                  {!isOwn && freeAgentWishlistPreview && canSeeWishlist ? (
                    <div className="mt-6 rounded-xl border border-[#D4A843]/45 bg-gradient-to-r from-[#FAF8F4] to-white p-4 shadow-sm">
                      <p className="text-sm font-semibold leading-snug text-[#2C2C2C]">
                        This client pinned your listing! Upgrade to Pro to see their full wishlist
                        and preferences.
                      </p>
                      <Link
                        href="/dashboard/agent"
                        className="mt-3 inline-flex text-sm font-bold text-[#6B9E6E] underline underline-offset-2 hover:text-[#5d8a60]"
                      >
                        Upgrade in dashboard
                      </Link>
                    </div>
                  ) : null}
                  <div className="mt-6 flex flex-wrap gap-2 border-b border-[#2C2C2C]/10 pb-px">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                          filter === f.id
                            ? "border-b-2 border-[#6B9E6E] text-[#6B9E6E]"
                            : "text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {properties.length === 0 ? (
                    <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-[#FAF8F4]/50 py-16 text-center">
                      <Home className="h-14 w-14 text-[#6B9E6E]/50" strokeWidth={1.25} />
                      <p className="mt-4 font-medium text-[#2C2C2C]/70">
                        No saved properties yet. Start browsing!
                      </p>
                      <Link
                        href="/"
                        className="mt-4 text-sm font-semibold text-[#6B9E6E] underline underline-offset-2"
                      >
                        Browse listings
                      </Link>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="mt-12 rounded-2xl border border-[#2C2C2C]/8 bg-white px-4 py-12 text-center shadow-sm">
                      <p className="font-serif text-lg font-bold text-[#2C2C2C]">
                        No listings match this tab
                      </p>
                      <button
                        type="button"
                        onClick={() => setFilter("all")}
                        className="mt-4 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-bold text-white hover:bg-[#5c8a5f]"
                      >
                        View all
                      </button>
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-col gap-4">
                      {sortedFiltered.map((p) =>
                        renderWishlistFacebookCard(p, {
                          variant: "pinned",
                          activityIso: pinnedAtByPropertyId[p.id] ?? null,
                        }),
                      )}
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      )}
      <ViewingAgentPickerModal
        open={showAgentPicker}
        onOpenChange={setShowAgentPicker}
        agents={selectedViewingProperty?.connectedAgents ?? []}
        onSelect={(a) => {
          setSelectedViewingAgentUserId(a.userId);
          setShowAgentPicker(false);
          setShowViewingModal(true);
        }}
      />
      <ViewingRequestModal
        open={showViewingModal}
        onOpenChange={(open) => {
          setShowViewingModal(open);
          if (!open) {
            setSelectedViewingProperty(null);
            setSelectedViewingAgentUserId(null);
          }
        }}
        propertyId={selectedViewingProperty?.id ?? null}
        propertyTitle={
          selectedViewingProperty?.name?.trim() ||
          selectedViewingProperty?.location ||
          "Property"
        }
        agentUserId={
          selectedViewingAgentUserId ??
          (selectedViewingProperty
            ? listingAgentUserId(
                selectedViewingProperty,
                selectedViewingProperty.connectedAgents,
              )
            : null)
        }
      />
      <SignInViewingPromptModal open={signInPromptOpen} onOpenChange={setSignInPromptOpen} />
      {isOwn ? (
        <ClientMyDocumentsSidePanel
          open={documentsPanelOpen}
          onClose={() => setDocumentsPanelOpen(false)}
          userId={clientId}
          supabase={supabase}
          searchParams={searchParams}
        />
      ) : null}
    </div>
  );
}

export default function ClientPublicProfilePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientPublicProfilePageInner />
    </Suspense>
  );
}
