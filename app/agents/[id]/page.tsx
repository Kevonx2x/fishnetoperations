"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Heart,
  Pin,
  LayoutGrid,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  MessageSquare,
  Pencil,
  Plus,
  Star,
  Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { AgentDirectoryCard } from "@/components/marketplace/agent-directory-card";
import { AgentContactOptionsModal } from "@/components/marketplace/agent-contact-options-modal";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";
import { ViewingRequestModal } from "@/components/marketplace/viewing-request-modal";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { useAuth } from "@/contexts/auth-context";
import { formatAgentScore } from "@/lib/format-agent-score";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { cn } from "@/lib/utils";
import { fetchSimilarAgents } from "@/lib/similar-agents";
import { listingListedLabel } from "@/lib/listing-listed-time";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { shouldPulseEngagement, writeSeenEngagementCount } from "@/lib/engagement-seen-storage";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import type { CreateMessagingChannelErrorBody, CreateMessagingChannelResponse } from "@/features/messaging/types";
import { usePropertyEngagementForProperties } from "@/hooks/use-property-engagement";
import { ReportProfileButton } from "@/components/report-profile-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AgentRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  image_url: string | null;
  license_number: string | null;
  score: number;
  closings: number;
  response_time: string | null;
  availability: string | null;
  broker_id: string | null;
  user_id: string;
  verified?: boolean;
  status?: string;
  verification_status?: "pending" | "verified" | "rejected" | "suspended" | null;
  specialties?: string | null;
  service_areas?: string | null;
  brokers?: { id: string; company_name: string; logo_url: string | null } | null;
  profiles?: { email?: string | null; phone?: string | null } | null;
  listing_tier?: string | null;
  updated_at?: string | null;
};

type ListingRow = {
  id: string;
  created_at: string;
  name: string | null;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string;
  status: "for_sale" | "for_rent" | "sold" | "rented";
  listing_status: string | null;
  listed_by: string | null;
  is_presale?: boolean;
  developer_name?: string | null;
  turnover_date?: string | null;
  rented_at?: string | null;
};

type ListingFilter = "active" | "sold" | "rented" | "for_rent" | "for_sale";
type ListingSort = "newest" | "price_high" | "most_saved";

const FILTER_TABS: { id: ListingFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "sold", label: "Sold" },
  { id: "rented", label: "Rented" },
  { id: "for_rent", label: "For Rent" },
  { id: "for_sale", label: "For Sale" },
];

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

function passesListingFilter(p: ListingRow, mode: ListingFilter): boolean {
  const ls = (p.listing_status ?? "active").toLowerCase();
  if (mode === "active") return ls === "active" || ls === "under_offer";
  if (mode === "sold") return ls === "sold";
  if (mode === "rented") return ls === "rented";
  if (mode === "for_rent") return p.status === "for_rent" && ls !== "rented";
  if (mode === "for_sale") return p.status === "for_sale";
  return true;
}

function isRecentlyRentedBadge(p: ListingRow): boolean {
  if ((p.listing_status ?? "").toLowerCase() !== "rented" || !p.rented_at) return false;
  const t = new Date(p.rented_at).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 30 * 24 * 60 * 60 * 1000;
}

function isAgentIdentityVerified(agent: AgentRow): boolean {
  return agent.verification_status === "verified";
}

function AgentBioBlock({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  const text = bio.trim();

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    if (expanded) return;
    setHasOverflow(el.scrollHeight > el.clientHeight);
  }, [expanded, text]);

  const showGradient = !expanded && hasOverflow;
  const showButton = expanded || hasOverflow;

  return (
    <div className="mt-2">
      <div className="relative overflow-hidden">
        <p
          ref={textRef}
          className={`text-center text-sm font-medium leading-relaxed text-[#2C2C2C]/75 whitespace-pre-wrap ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {text}
        </p>
        {showGradient ? (
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-[#FAF8F4]"
            aria-hidden
          />
        ) : null}
      </div>
      {showButton ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 w-full text-center font-medium text-[#6B9E6E]"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

type EngagementEngager = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  email: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_locations: unknown;
  looking_to: string | null;
  likedAt: string | null;
  savedAt: string | null;
};

function engagementLastActivityAt(u: EngagementEngager): Date | null {
  const a = u.likedAt ? new Date(u.likedAt).getTime() : 0;
  const b = u.savedAt ? new Date(u.savedAt).getTime() : 0;
  const m = Math.max(a, b);
  return m > 0 ? new Date(m) : null;
}

function profileHrefForEngagement(
  u: EngagementEngager,
  agentIdByUserId: Record<string, string>,
): string | null {
  if (u.role === "client") return `/clients/${u.id}`;
  if (u.role === "agent") {
    const aid = agentIdByUserId[u.id];
    return aid ? `/agents/${aid}` : null;
  }
  return null;
}

function engagementRoleBadgeLabel(role: string | null | undefined): string {
  if (role === "client") return "Verified Buyer";
  if (role === "agent") return "Agent";
  return "Member";
}

export default function AgentProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [similarAgents, setSimilarAgents] = useState<MarketplaceAgent[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null);

  const [contactPropertyId, setContactPropertyId] = useState<string | null>(null);
  const [contactPropertyTitle, setContactPropertyTitle] = useState("General Inquiry");
  const [viewingPropertyId, setViewingPropertyId] = useState<string | null>(null);
  const [viewingPropertyTitle, setViewingPropertyTitle] = useState("");

  const [listingFilter, setListingFilter] = useState<ListingFilter>("active");
  const [listingSort, setListingSort] = useState<ListingSort>("newest");

  const { engagement } = usePropertyEngagementForProperties(listings);

  const contactModalAgent = useMemo<MarketplaceAgent | null>(() => {
    if (!agent) return null;
    return mapRowToMarketplaceAgent(agent as Parameters<typeof mapRowToMarketplaceAgent>[0]);
  }, [agent]);

  const isOwnProfile = Boolean(user?.id && agent?.user_id && user.id === agent.user_id);
  const [messageBusy, setMessageBusy] = useState(false);

  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followActionLoading, setFollowActionLoading] = useState(false);

  const showClientFollowUi = Boolean(
    user?.id && profile?.role === "client" && !isOwnProfile && agent?.id,
  );

  useEffect(() => {
    if (!agent?.id) return;
    let cancelled = false;
    void (async () => {
      const { count } = await supabase
        .from("agent_followers")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agent.id);
      if (!cancelled) setFollowerCount(typeof count === "number" ? count : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [agent?.id]);

  useEffect(() => {
    if (!agent?.id || !user?.id || profile?.role !== "client") {
      setIsFollowing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("agent_followers")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("client_id", user.id)
        .maybeSingle();
      if (!cancelled) setIsFollowing(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [agent?.id, user?.id, profile?.role]);

  const onToggleFollow = useCallback(async () => {
    if (!agent?.id || !user?.id || profile?.role !== "client") return;
    setFollowActionLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("agent_followers")
          .delete()
          .eq("agent_id", agent.id)
          .eq("client_id", user.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        setIsFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        const { error } = await supabase.from("agent_followers").insert({
          client_id: user.id,
          agent_id: agent.id,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } finally {
      setFollowActionLoading(false);
    }
  }, [agent?.id, user?.id, profile?.role, isFollowing]);

  const [viewerBrokerTier, setViewerBrokerTier] = useState(false);
  useEffect(() => {
    if (!user?.id) {
      setViewerBrokerTier(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from("agents")
      .select("listing_tier")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setViewerBrokerTier((data as { listing_tier?: string | null } | null)?.listing_tier === "broker");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const flipEligible = isOwnProfile || viewerBrokerTier;

  const [engagementMap, setEngagementMap] = useState<
    Record<string, { likers: EngagementEngager[]; pinners: EngagementEngager[] }>
  >({});
  const [engagementLeadAdded, setEngagementLeadAdded] = useState<Record<string, boolean>>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [engagementAgentIdByUserId, setEngagementAgentIdByUserId] = useState<Record<string, string>>({});
  /** Own listing cards: which face is shown; `likes` / `pins` = back side with that list. */
  const [listingFlipById, setListingFlipById] = useState<Record<string, "front" | "likes" | "pins">>({});
  const [markingStatus, setMarkingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("agents")
        .select("*, brokers(*), profiles(email, phone)")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setAgent(null);
      } else {
        setAgent((data ?? null) as unknown as AgentRow | null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!agent?.user_id) return;
    const uid = agent.user_id;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/agent/recalculate-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid }),
        });
        const json = (await res.json()) as { success?: boolean; data?: { score: number } };
        if (cancelled) return;
        if (json.success && json.data && typeof json.data.score === "number") {
          setAgent((prev) => (prev ? { ...prev, score: json.data!.score } : null));
        }
      } catch {
        /* score recalc is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent?.user_id]);

  const agentUserId = agent?.user_id ?? null;
  const agentRecordId = agent?.id ?? null;

  useEffect(() => {
    if (!agentUserId || !agentRecordId) {
      setListings([]);
      return;
    }

    let cancelled = false;
    const selectFields =
      "id, created_at, name, location, price, beds, baths, sqft, image_url, status, listing_status, listed_by, is_presale, developer_name, turnover_date, rented_at";

    void (async () => {
      const [ownedRes, linksRes] = await Promise.all([
        supabase
          .from("properties")
          .select(selectFields)
          .eq("listed_by", agentUserId)
          .or(publicListingExpiryOrFilter()),
        supabase.from("property_agents").select("property_id").eq("agent_id", agentRecordId),
      ]);

      if (cancelled) return;

      const owned = (ownedRes.data ?? []) as unknown as ListingRow[];
      const linkIds = [...new Set((linksRes.data ?? []).map((r) => r.property_id).filter(Boolean))] as string[];

      let linked: ListingRow[] = [];
      if (linkIds.length > 0) {
        const { data: linkedRows } = await supabase
          .from("properties")
          .select(selectFields)
          .in("id", linkIds)
          .or(publicListingExpiryOrFilter());
        if (cancelled) return;
        linked = (linkedRows ?? []) as unknown as ListingRow[];
      }

      const byId = new Map<string, ListingRow>();
      for (const row of [...owned, ...linked]) {
        byId.set(row.id, row);
      }
      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      if (!cancelled) setListings(merged);
    })();

    return () => {
      cancelled = true;
    };
  }, [agentUserId, agentRecordId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agent?.id) {
        setSimilarAgents([]);
        setSimilarLoading(false);
        return;
      }
      setSimilarLoading(true);
      try {
        const list = await fetchSimilarAgents(supabase, {
          id: agent.id,
          broker_id: agent.broker_id,
          score: Number(agent.score),
        });
        if (!cancelled) setSimilarAgents(list);
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent?.id, agent?.broker_id, agent?.score]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  useEffect(() => {
    if (!flipEligible || !listings || listings.length === 0) return;

    const fetchEngagement = async () => {
      const ids = listings.map((l: any) => l.id);
      console.log("Fetching engagement for ids:", ids);

      const [{ data: likes }, { data: pins }] = await Promise.all([
        supabase.from("property_likes").select("property_id, user_id, created_at").in("property_id", ids),
        supabase.from("saved_properties").select("property_id, user_id, created_at").in("property_id", ids),
      ]);

      console.log("likes:", likes, "pins:", pins);

      const allUserIds = [
        ...new Set([
          ...(likes || []).map((l: any) => l.user_id),
          ...(pins || []).map((p: any) => p.user_id),
        ]),
      ];

      console.log("allUserIds:", allUserIds);

      if (allUserIds.length === 0) {
        setEngagementMap({});
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, role, email, budget_min, budget_max, preferred_locations, looking_to",
        )
        .in("id", allUserIds);

      console.log("profiles:", profiles);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      const timeKey = (propertyId: string, userId: string) => `${propertyId}:${userId}`;
      const likeTimeMap = new Map<string, string>();
      for (const row of likes || []) {
        const r = row as { property_id: string; user_id: string; created_at: string };
        likeTimeMap.set(timeKey(r.property_id, r.user_id), r.created_at);
      }
      const pinTimeMap = new Map<string, string>();
      for (const row of pins || []) {
        const r = row as { property_id: string; user_id: string; created_at: string };
        pinTimeMap.set(timeKey(r.property_id, r.user_id), r.created_at);
      }

      const map: Record<string, { likers: EngagementEngager[]; pinners: EngagementEngager[] }> = {};

      for (const id of ids) {
        map[id] = { likers: [], pinners: [] };
      }
      for (const like of likes || []) {
        const raw = profileMap[like.user_id as string];
        if (!raw) continue;
        const pid = like.property_id as string;
        const uid = like.user_id as string;
        const likedAt = like.created_at as string;
        const savedAt = pinTimeMap.get(timeKey(pid, uid)) ?? null;
        const row: EngagementEngager = {
          id: raw.id,
          full_name: raw.full_name ?? null,
          avatar_url: raw.avatar_url ?? null,
          role: raw.role ?? null,
          email: raw.email ?? null,
          budget_min: raw.budget_min ?? null,
          budget_max: raw.budget_max ?? null,
          preferred_locations: raw.preferred_locations,
          looking_to: raw.looking_to ?? null,
          likedAt,
          savedAt,
        };
        map[pid]?.likers.push(row);
      }
      for (const pin of pins || []) {
        const raw = profileMap[pin.user_id as string];
        if (!raw) continue;
        const pid = pin.property_id as string;
        const uid = pin.user_id as string;
        const savedAt = pin.created_at as string;
        const likedAt = likeTimeMap.get(timeKey(pid, uid)) ?? null;
        const row: EngagementEngager = {
          id: raw.id,
          full_name: raw.full_name ?? null,
          avatar_url: raw.avatar_url ?? null,
          role: raw.role ?? null,
          email: raw.email ?? null,
          budget_min: raw.budget_min ?? null,
          budget_max: raw.budget_max ?? null,
          preferred_locations: raw.preferred_locations,
          looking_to: raw.looking_to ?? null,
          likedAt,
          savedAt,
        };
        map[pid]?.pinners.push(row);
      }

      console.log("final engagementMap:", map);
      setEngagementMap(map);
    };

    fetchEngagement();
  }, [flipEligible, listings]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const filteredAndSortedListings = useMemo(() => {
    let list = listings.filter((p) => passesListingFilter(p, listingFilter));
    if (listingSort === "newest") {
      list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (listingSort === "price_high") {
      list = [...list].sort((a, b) => parsePesoToNumber(b.price) - parsePesoToNumber(a.price));
    } else {
      list = [...list].sort((a, b) => {
        const ca = engagement.saveCount(a.id);
        const cb = engagement.saveCount(b.id);
        if (cb !== ca) return cb - ca;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return list;
  }, [listings, listingFilter, listingSort, engagement]);

  const markPropertySold = useCallback(
    async (propertyId: string) => {
      if (!user?.id) return;
      setMarkingStatus(true);
      const { error } = await supabase
        .from("properties")
        .update({ listing_status: "sold", status: "sold" })
        .eq("id", propertyId)
        .eq("listed_by", user.id);
      setMarkingStatus(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setListings((prev) =>
        prev.map((x) =>
          x.id === propertyId ? { ...x, listing_status: "sold", status: "sold" } : x,
        ),
      );
      toast.success("Listing marked as sold");
      setListingFilter("sold");
    },
    [user?.id],
  );

  const markPropertyRented = useCallback(
    async (propertyId: string) => {
      if (!user?.id) return;
      setMarkingStatus(true);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("properties")
        .update({ listing_status: "rented", status: "rented", rented_at: now })
        .eq("id", propertyId)
        .eq("listed_by", user.id);
      setMarkingStatus(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setListings((prev) =>
        prev.map((x) =>
          x.id === propertyId
            ? { ...x, listing_status: "rented", status: "rented", rented_at: now }
            : x,
        ),
      );
      toast.success("Listing marked as rented");
      setListingFilter("rented");
    },
    [user?.id],
  );

  const deleteListing = useCallback(
    async (propertyId: string) => {
      if (!user?.id) return;
      if (!confirm("Delete this listing? This cannot be undone.")) return;
      setDeletingPropertyId(propertyId);
      const { error: delErr } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId)
        .eq("listed_by", user.id);
      setDeletingPropertyId(null);
      if (delErr) {
        alert(delErr.message);
        return;
      }
      setListings((prev) => prev.filter((p) => p.id !== propertyId));
    },
    [user?.id],
  );

  const openScheduleHeader = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      setSignInPromptOpen(true);
      return;
    }
    if (!agent) return;
    setViewingPropertyId(null);
    setViewingPropertyTitle(`Viewing with ${agent.name}`);
    setShowViewingModal(true);
  }, [authLoading, user, agent]);

  const openScheduleForListing = useCallback(
    (p: ListingRow) => {
      if (authLoading) return;
      if (!user) {
        setSignInPromptOpen(true);
        return;
      }
      setViewingPropertyId(p.id);
      setViewingPropertyTitle(p.name?.trim() || p.location);
      setShowViewingModal(true);
    },
    [authLoading, user],
  );

  const openContactHeader = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      setSignInPromptOpen(true);
      return;
    }
    setContactPropertyId(null);
    setContactPropertyTitle("General Inquiry");
    setShowContactModal(true);
  }, [authLoading, user]);

  const openContactForListing = useCallback(
    (p: ListingRow) => {
      if (authLoading) return;
      if (!user) {
        setSignInPromptOpen(true);
        return;
      }
      setContactPropertyId(p.id);
      setContactPropertyTitle(p.name?.trim() || p.location);
      setShowContactModal(true);
    },
    [authLoading, user],
  );

  const onMessageAgent = useCallback(async (opts?: {
    propertyId?: string | null;
    propertyName?: string | null;
    propertyPrice?: string | null;
    propertyImage?: string | null;
  }) => {
    if (authLoading || messageBusy) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }
    if (!agent?.user_id || user.id === agent.user_id) return;
    setMessageBusy(true);
    try {
      const metadata = {
        property_id: opts?.propertyId ?? null,
        property_name: opts?.propertyName ?? null,
        property_price: opts?.propertyPrice ?? null,
        property_image: opts?.propertyImage ?? null,
      };
      const res = await fetch("/api/stream/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agent_user_id: agent.user_id,
          client_user_id: user.id,
          metadata,
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      const ok = data as CreateMessagingChannelResponse;
      const err = data as CreateMessagingChannelErrorBody;
      if (!res.ok || typeof ok.channel_id !== "string" || !ok.channel_id) {
        toast.error(typeof err.error === "string" ? err.error : "Could not start chat");
        return;
      }
      router.push(`/dashboard/client/messages?channel=${encodeURIComponent(ok.channel_id)}`);
    } finally {
      setMessageBusy(false);
    }
  }, [agent?.user_id, authLoading, messageBusy, router, user?.id]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#2C2C2C]">
      {!loading && !error && agent && isOwnProfile && agent.verification_status !== "verified" ? (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            ⚠️ Your account is unverified. Listings may be hidden.{" "}
            <Link href="/settings?tab=verification" className="font-semibold underline">
              Settings → Verification
            </Link>
          </div>
        </div>
      ) : null}
      <MaddenTopNav />

      {loading && (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
            <div className="h-[480px] animate-pulse rounded-2xl bg-white shadow-md" />
            <div className="h-[400px] animate-pulse rounded-2xl bg-white shadow-md" />
          </div>
        </div>
      )}

      {!loading && error && (
        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load agent</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        </main>
      )}

      {!loading && !error && agent && (
        <>
          <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
            <div className="mb-6 text-sm font-semibold text-[#2C2C2C]/65">
              <Link href="/" className="hover:text-[#2C2C2C]">
                Home
              </Link>{" "}
              <span>·</span>{" "}
              <Link href="/agents" className="hover:text-[#2C2C2C]">
                Agents
              </Link>{" "}
              <span>·</span> <span className="text-[#2C2C2C]">{agent.name}</span>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,30%)_minmax(0,70%)] lg:items-start lg:gap-10">
              {/* LEFT SIDEBAR */}
              <aside className="self-start lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto lg:scrollbar-hide">
                <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white p-4 shadow-md">
                  <div className="relative mx-auto h-20 w-20">
                    <div className="relative h-full w-full overflow-hidden rounded-full bg-[#FAF8F4] ring-2 ring-white">
                      {agent.image_url ? (
                        <SupabasePublicImage
                          src={agent.image_url}
                          alt={agent.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-serif text-2xl font-bold text-[#2C2C2C]/25">
                          {agent.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    {isAgentIdentityVerified(agent) ? (
                      <span
                        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#D4A843] shadow-md ring-2 ring-white"
                        title="Verified"
                      >
                        <BadgeCheck className="h-3.5 w-3.5 text-white" aria-hidden />
                      </span>
                    ) : null}
                  </div>

                  {showClientFollowUi ? (
                    <div className="mt-3 flex w-full flex-col items-center gap-1.5">
                      <button
                        type="button"
                        disabled={followActionLoading}
                        onClick={() => void onToggleFollow()}
                        className={
                          isFollowing
                            ? "rounded-full border border-[#2C2C2C]/20 bg-[#FAF8F4] px-4 py-1.5 text-xs font-semibold text-[#2C2C2C]/60 transition hover:bg-[#2C2C2C]/5"
                            : "rounded-full border-2 border-[#6B9E6E] bg-transparent px-4 py-1.5 text-xs font-semibold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/10"
                        }
                      >
                        {followActionLoading ? "…" : isFollowing ? "Unfollow" : "Follow"}
                      </button>
                      <p className="text-center text-[11px] text-[#2C2C2C]/45">
                        {followerCount === 1 ? "1 follower" : `${followerCount} followers`}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-center text-[11px] text-[#2C2C2C]/45">
                      {followerCount === 1 ? "1 follower" : `${followerCount} followers`}
                    </p>
                  )}

                  <h1 className="mt-4 text-center font-serif text-lg font-bold tracking-tight text-[#2C2C2C]">
                    {agent.name}
                  </h1>

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C]/85">
                      <Trophy className="h-3 w-3 text-[#6B9E6E]" />
                      {agent.closings} closings
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4A843]/35 bg-[#D4A843]/10 px-2.5 py-1 text-[11px] font-bold text-[#8a6d32]">
                      <Star className="h-3 w-3 text-[#D4A843]" />
                      {formatAgentScore(agent.score)}
                    </span>
                  </div>

                  <div className="mt-5 border-t border-[#2C2C2C]/10 pt-4">
                    <p className="text-center font-serif text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                      About
                    </p>
                    {agent.bio?.trim() ? (
                      <AgentBioBlock bio={agent.bio} />
                    ) : (
                      <div className="mt-2 flex justify-center">
                        {isOwnProfile ? (
                          <Link
                            href="/dashboard/agent?tab=profile"
                            className="inline-flex items-center gap-1.5 text-sm italic text-[#6B9E6E] underline decoration-[#6B9E6E]/40 underline-offset-2 hover:text-[#2C2C2C]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            No bio yet — add one
                          </Link>
                        ) : (
                          <p className="text-center text-sm italic text-[#2C2C2C]/45">No bio yet</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-[#2C2C2C]/10 pt-4">
                    <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                      Contact
                    </p>
                    <p className="break-all text-center text-sm font-medium text-[#2C2C2C]/80">{agent.email}</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={openContactHeader}
                      disabled={authLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2C2C2C] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2C2C2C]/90 disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      Contact
                    </button>
                  </div>
                  {agent ? (
                    <ReportProfileButton reportedUserId={agent.user_id} disabled={isOwnProfile} />
                  ) : null}
                </div>
              </aside>

              {/* RIGHT FEED */}
              <div className="min-w-0">
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white px-4 py-4 shadow-sm sm:px-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {FILTER_TABS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setListingFilter(t.id)}
                            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                              listingFilter === t.id
                                ? "bg-[#6B9E6E] text-white"
                                : "text-[#2C2C2C]/65 hover:bg-[#FAF8F4]"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                        {isOwnProfile ? (
                          <Link
                            href="/dashboard/agent?tab=listings"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] text-white"
                            aria-label="Open listings in dashboard"
                            title="Add listing"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <label htmlFor="agent-feed-sort" className="sr-only">
                          Sort listings
                        </label>
                        <span className="text-xs font-semibold text-[#2C2C2C]/45">Sort</span>
                        <select
                          id="agent-feed-sort"
                          value={listingSort}
                          onChange={(e) => setListingSort(e.target.value as ListingSort)}
                          className="rounded-full border border-[#2C2C2C]/15 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/40"
                        >
                          <option value="newest">Newest</option>
                          <option value="price_high">Price High-Low</option>
                          <option value="most_saved">Most Pinned</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {listings.length === 0 ? (
                    <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white px-4 py-16 text-center shadow-sm">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/25">
                        <LayoutGrid className="h-10 w-10 text-[#6B9E6E]" aria-hidden />
                      </div>
                      <p className="mt-6 font-serif text-xl font-bold text-[#2C2C2C]">No listings yet</p>
                      <p className="mt-2 max-w-sm text-sm font-medium text-[#2C2C2C]/55">
                        When this agent adds properties, they’ll appear here.
                      </p>
                    </div>
                  ) : filteredAndSortedListings.length === 0 ? (
                    <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white px-4 py-12 text-center shadow-sm">
                      <p className="font-serif text-lg font-bold text-[#2C2C2C]">No listings match this tab</p>
                      <button
                        type="button"
                        onClick={() => setListingFilter("active")}
                        className="mt-4 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-bold text-white hover:bg-[#5c8a5f]"
                      >
                        View Active
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {filteredAndSortedListings.map((p) => {
                        const title = p.name?.trim() || p.location;
                        const listed = listingListedLabel(p.created_at);
                        const showEng = engagement.showEngagementCounts(p.id);
                        const likeN = engagement.likeCount(p.id);
                        const pinN = engagement.saveCount(p.id);
                        const statusLabel = p.is_presale
                          ? "Presale"
                          : p.status === "for_rent"
                            ? "For Rent"
                            : "For Sale";
                        const canManagePost =
                          isOwnProfile &&
                          user?.id &&
                          p.listed_by === agent.user_id;
                        const flipFace = listingFlipById[p.id] ?? "front";
                        const showBack = flipEligible && flipFace !== "front";
                        const visitorLiked = engagement.isLiked(p.id);
                        const viewerPinned = engagement.isPinned(p.id);
                        return (
                          <div
                            key={p.id}
                            className="w-full"
                            style={flipEligible ? { perspective: "1000px" } : undefined}
                          >
                            <div
                              className="relative w-full"
                              style={
                                flipEligible
                                  ? {
                                      transformStyle: "preserve-3d",
                                      transition: "transform 0.5s",
                                      transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)",
                                    }
                                  : undefined
                              }
                            >
                              <article
                                className="relative overflow-hidden rounded-2xl border border-[#2C2C2C]/8 bg-white shadow-sm"
                                style={
                                  flipEligible
                                    ? {
                                        backfaceVisibility: "hidden",
                                        WebkitBackfaceVisibility: "hidden",
                                        transform: "rotateY(0deg)",
                                      }
                                    : undefined
                                }
                              >
                            <div className="flex items-start justify-between gap-2 px-4 pt-4">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-black/10">
                                  {agent.image_url ? (
                                    <SupabasePublicImage src={agent.image_url} alt="" fill sizes="40px" className="object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center font-serif text-sm font-bold text-[#2C2C2C]/40">
                                      {agent.name.slice(0, 1)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-[#2C2C2C]">{agent.name}</span>
                                    {isAgentIdentityVerified(agent) ? (
                                      <BadgeCheck className="h-4 w-4 shrink-0 text-[#D4A843]" aria-label="Verified" />
                                    ) : null}
                                  </div>
                                  <p className="text-xs font-medium text-[#2C2C2C]/50">{listed}</p>
                                </div>
                              </div>
                              {canManagePost ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#FAF8F4] hover:text-[#2C2C2C]"
                                      aria-label="Post options"
                                    >
                                      <MoreHorizontal className="h-5 w-5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="min-w-[10rem]">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/dashboard/agent?tab=listings`}>Edit</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      disabled={deletingPropertyId === p.id}
                                      onClick={() => void deleteListing(p.id)}
                                    >
                                      {deletingPropertyId === p.id ? "Deleting…" : "Delete"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </div>

                            <div className="relative mt-3 w-full overflow-hidden">
                              <Link
                                href={`/properties/${encodeURIComponent(p.id)}`}
                                className="relative block aspect-video w-full"
                              >
                                <Image
                                  src={p.image_url}
                                  alt={title}
                                  fill
                                  sizes="(max-width: 1024px) 100vw, 65vw"
                                  className="object-cover"
                                />
                              </Link>
                              <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold shadow-md ${
                                    p.is_presale ? "bg-[#D4A843] text-[#2C2C2C]" : "bg-[#6B9E6E] text-white"
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                                {isRecentlyRentedBadge(p) ? (
                                  <span className="rounded-full bg-[#D4A843]/25 px-2 py-0.5 text-[10px] font-bold text-[#8a6d32] shadow-sm">
                                    Recently Rented
                                  </span>
                                ) : null}
                              </div>
                              <div className="absolute right-3 top-3 z-10 flex items-start gap-1">
                                {flipEligible ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        writeSeenEngagementCount(p.id, "likes", likeN);
                                        setListingFlipById((prev) => ({ ...prev, [p.id]: "likes" }));
                                      }}
                                      className={cn(
                                        "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                                        visitorLiked
                                          ? "border border-red-200 bg-white"
                                          : "border border-gray-200 bg-white/80",
                                        shouldPulseEngagement(p.id, "likes", likeN)
                                          ? "ring-2 ring-red-400 animate-pulse"
                                          : "",
                                      )}
                                      aria-label={
                                        showEng && likeN > 0 ? `${likeN} likes` : "Like"
                                      }
                                    >
                                      <Heart
                                        className={cn(
                                          "h-3.5 w-3.5 shrink-0",
                                          visitorLiked
                                            ? "fill-red-500 text-red-500"
                                            : "fill-none text-red-400",
                                        )}
                                        aria-hidden
                                      />
                                      {showEng && likeN > 0 ? (
                                        <span
                                          className={cn(
                                            "text-xs font-medium tabular-nums",
                                            visitorLiked ? "text-red-500" : "text-red-400",
                                          )}
                                        >
                                          {likeN}
                                        </span>
                                      ) : null}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        writeSeenEngagementCount(p.id, "pins", pinN);
                                        setListingFlipById((prev) => ({ ...prev, [p.id]: "pins" }));
                                      }}
                                      className={cn(
                                        "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                                        viewerPinned
                                          ? "border border-[#D4A843]/40 bg-white"
                                          : "border border-gray-200 bg-white/80",
                                        shouldPulseEngagement(p.id, "pins", pinN)
                                          ? "ring-2 ring-[#D4A843] animate-pulse"
                                          : "",
                                      )}
                                      aria-label={
                                        showEng && pinN > 0 ? `${pinN} pins` : "Pin"
                                      }
                                    >
                                      <Pin
                                        className={cn(
                                          "h-3.5 w-3.5 shrink-0",
                                          viewerPinned
                                            ? "fill-[#D4A843] text-[#D4A843]"
                                            : "fill-none text-[#D4A843]",
                                        )}
                                        aria-hidden
                                      />
                                      {showEng && pinN > 0 ? (
                                        <span className="text-xs font-medium tabular-nums text-[#D4A843]">
                                          {pinN}
                                        </span>
                                      ) : null}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        void engagement.toggleLike(p.id);
                                      }}
                                      className={cn(
                                        "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                                        visitorLiked
                                          ? "border border-red-200 bg-white"
                                          : "border border-gray-200 bg-white/80",
                                      )}
                                      aria-label={
                                        showEng && likeN > 0 ? `${likeN} likes` : "Like"
                                      }
                                    >
                                      <Heart
                                        className={cn(
                                          "h-3.5 w-3.5 shrink-0",
                                          visitorLiked
                                            ? "fill-red-500 text-red-500"
                                            : "fill-none text-red-400",
                                        )}
                                        aria-hidden
                                      />
                                      {showEng && likeN > 0 ? (
                                        <span
                                          className={cn(
                                            "text-xs font-medium tabular-nums",
                                            visitorLiked ? "text-red-500" : "text-red-400",
                                          )}
                                        >
                                          {likeN}
                                        </span>
                                      ) : null}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        void engagement.togglePin(p.id);
                                      }}
                                      className={cn(
                                        "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                                        viewerPinned
                                          ? "border border-[#D4A843]/40 bg-white"
                                          : "border border-gray-200 bg-white/80",
                                      )}
                                      aria-label={
                                        showEng && pinN > 0 ? `${pinN} pins` : "Pin"
                                      }
                                    >
                                      <Pin
                                        className={cn(
                                          "h-3.5 w-3.5 shrink-0",
                                          viewerPinned
                                            ? "fill-[#D4A843] text-[#D4A843]"
                                            : "fill-none text-[#D4A843]",
                                        )}
                                        aria-hidden
                                      />
                                      {showEng && pinN > 0 ? (
                                        <span className="text-xs font-medium tabular-nums text-[#D4A843]">
                                          {pinN}
                                        </span>
                                      ) : null}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1 px-4 pb-3 pt-3">
                              <p className="font-serif text-2xl font-bold text-[#D4A843]">
                                {formatPropertyPriceDisplay(p.price, p.status)}
                              </p>
                              <p className="font-serif text-lg font-bold text-[#2C2C2C]">{title}</p>
                              <p className="flex items-start gap-1.5 text-sm text-[#2C2C2C]/55">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                                <span>{p.location}</span>
                              </p>
                              {p.is_presale && p.developer_name?.trim() ? (
                                <p className="text-xs font-semibold text-[#2C2C2C]/75">{p.developer_name.trim()}</p>
                              ) : null}
                              {p.is_presale && p.turnover_date ? (
                                <p className="text-xs text-[#2C2C2C]/45">
                                  Turnover: {new Date(`${p.turnover_date}T12:00:00`).getFullYear()}
                                </p>
                              ) : null}
                              <p className="text-sm text-[#6B6B6B]">
                                {p.sqft} sqft · {p.beds} beds · {p.baths} baths
                              </p>
                            </div>

                            <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:items-center">
                              {!isOwnProfile ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openContactForListing(p)}
                                    disabled={authLoading}
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2C2C2C] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2C2C2C]/90 disabled:opacity-50 sm:w-auto"
                                  >
                                    <Mail className="h-3.5 w-3.5" />
                                    Contact Agent
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void onMessageAgent({
                                        propertyId: p.id,
                                        propertyName: title,
                                        propertyPrice: formatPropertyPriceDisplay(p.price, p.status),
                                        propertyImage: p.image_url ?? null,
                                      })
                                    }
                                    disabled={authLoading || messageBusy}
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50 sm:w-auto"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                                    Message
                                  </button>
                                  {p.is_presale ? (
                                    <Link
                                      href={`/properties/${encodeURIComponent(p.id)}#presale-interest`}
                                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#6B9E6E] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5d8a60] sm:w-auto"
                                    >
                                      Register Interest
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openScheduleForListing(p)}
                                      disabled={authLoading}
                                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-[#6B9E6E] bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#6B9E6E]/10 disabled:opacity-50 sm:w-auto"
                                    >
                                      <Calendar className="h-3.5 w-3.5 text-[#6B9E6E]" />
                                      Schedule View
                                    </button>
                                  )}
                                </>
                              ) : null}
                              {isOwnProfile &&
                              canManagePost &&
                              (p.listing_status === "active" || p.listing_status === "under_offer") &&
                              (p.status === "for_rent" || (p.status === "for_sale" && !p.is_presale)) ? (
                                <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
                                  <div className="flex min-w-0 shrink items-center gap-2">
                                    {p.status === "for_sale" && !p.is_presale ? (
                                      <button
                                        type="button"
                                        disabled={markingStatus}
                                        onClick={() => {
                                          if (!confirm("Mark this property as sold?")) return;
                                          void markPropertySold(p.id);
                                        }}
                                        className="rounded-full border border-red-400 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                      >
                                        Mark as Sold
                                      </button>
                                    ) : null}
                                    {p.status === "for_rent" ? (
                                      <button
                                        type="button"
                                        disabled={markingStatus}
                                        onClick={() => {
                                          if (!confirm("Mark this property as rented?")) return;
                                          void markPropertyRented(p.id);
                                        }}
                                        className="rounded-full border border-[#D4A843] bg-white px-3 py-1.5 text-xs font-semibold text-[#8a6d32] hover:bg-[#D4A843]/10 disabled:opacity-50"
                                      >
                                        Mark as Rented
                                      </button>
                                    ) : null}
                                  </div>
                                  <Link
                                    href={`/properties/${encodeURIComponent(p.id)}`}
                                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#D4A843]/60 bg-[#FAF8F4] px-3 py-2.5 text-sm font-bold text-[#8a6d32] hover:bg-[#D4A843]/15"
                                  >
                                    Property Details
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                </div>
                              ) : (
                                <Link
                                  href={`/properties/${encodeURIComponent(p.id)}`}
                                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#D4A843]/60 bg-[#FAF8F4] px-3 py-2.5 text-sm font-bold text-[#8a6d32] hover:bg-[#D4A843]/15 sm:w-auto"
                                >
                                  Property Details
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              )}
                            </div>
                              </article>

                              {flipEligible ? (
                                <div
                                  className="absolute inset-0 flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/8 bg-white shadow-sm"
                                  style={{
                                    backfaceVisibility: "hidden",
                                    WebkitBackfaceVisibility: "hidden",
                                    transform: "rotateY(180deg)",
                                  }}
                                >
                                  {(() => {
                                    const usersRaw =
                                      flipFace === "likes"
                                        ? engagementMap[p.id]?.likers ?? []
                                        : engagementMap[p.id]?.pinners ?? [];
                                    const users = [...usersRaw].sort((a, b) => {
                                      const ta = engagementLastActivityAt(a)?.getTime() ?? 0;
                                      const tb = engagementLastActivityAt(b)?.getTime() ?? 0;
                                      return tb - ta;
                                    });
                                    const hasUsers = users.length > 0;
                                    return (
                                      <>
                                        <div className="flex shrink-0 flex-col border-b border-[#2C2C2C]/10 px-4 pb-3 pt-3">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setListingFlipById((prev) => ({ ...prev, [p.id]: "front" }))
                                            }
                                            className="self-start text-sm font-semibold text-[#6B9E6E] hover:underline"
                                          >
                                            ← Back
                                          </button>
                                          <h2 className="mt-2 font-serif text-lg font-bold text-[#2C2C2C]">
                                            {flipFace === "likes" ? "Liked by" : "📌 Pinned by"}
                                          </h2>
                                        </div>
                                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
                                            {!hasUsers ? (
                                              <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
                                                <span className="text-5xl leading-none" aria-hidden>
                                                  🏡
                                                </span>
                                                <p className="mt-4 font-semibold text-[#2C2C2C]">
                                                  No engagement yet
                                                </p>
                                                <p className="mt-1 max-w-xs text-sm text-[#2C2C2C]/55">
                                                  Share your listing to get more eyes on it
                                                </p>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/properties/${encodeURIComponent(p.id)}`;
                                                    void navigator.clipboard.writeText(url).then(() => {
                                                      toast.success("Link copied");
                                                    });
                                                  }}
                                                  className="mt-5 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white hover:bg-[#5d8a60]"
                                                >
                                                  Copy listing link
                                                </button>
                                              </div>
                                            ) : (
                                              <ul className="space-y-2">
                                                {users.map((u) => {
                                                  const href = profileHrefForEngagement(
                                                    u,
                                                    engagementAgentIdByUserId,
                                                  );
                                                  const label = u.full_name?.trim() || "User";
                                                  const leadKey = `${p.id}:${u.id}`;
                                                  const leadAdded = engagementLeadAdded[leadKey];
                                                  const lastAct = engagementLastActivityAt(u);
                                                  const activeLabel = lastAct
                                                    ? formatDistanceToNow(lastAct, { addSuffix: true })
                                                    : "recently";
                                                  return (
                                                    <li
                                                      key={u.id}
                                                      className="border-b border-[#2C2C2C]/8 py-1.5 last:border-0"
                                                    >
                                                      <div className="flex min-h-0 flex-col gap-1">
                                                        <div className="flex min-h-0 items-center gap-2">
                                                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-[#6B9E6E]/35">
                                                            {u.avatar_url?.trim() ? (
                                                              <SupabasePublicImage
                                                                src={u.avatar_url}
                                                                alt=""
                                                                fill
                                                                sizes="32px"
                                                                className="object-cover"
                                                              />
                                                            ) : (
                                                              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#2C2C2C]/55">
                                                                {agentAvatarInitials(label)}
                                                              </span>
                                                            )}
                                                          </div>
                                                          <div className="min-w-0 flex-1">
                                                            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0">
                                                              <span className="truncate text-sm font-bold text-[#2C2C2C]">
                                                                {label}
                                                              </span>
                                                              <span className="shrink-0 rounded-full bg-[#6B9E6E]/12 px-1.5 py-px text-[10px] font-semibold leading-tight text-[#6B9E6E]">
                                                                {engagementRoleBadgeLabel(u.role)}
                                                              </span>
                                                            </div>
                                                          </div>
                                                          <span className="shrink-0 text-[10px] leading-tight text-gray-500">
                                                            Active {activeLabel}
                                                          </span>
                                                          {href ? (
                                                            <Link
                                                              href={href}
                                                              className="shrink-0 text-[10px] font-semibold text-[#6B9E6E] hover:underline"
                                                              onClick={(e) => e.stopPropagation()}
                                                            >
                                                              View Profile
                                                            </Link>
                                                          ) : null}
                                                        </div>
                                                        {isOwnProfile ? (
                                                          <>
                                                            <div className="flex min-h-0 flex-wrap items-center gap-1.5 pl-10">
                                                            <button
                                                              type="button"
                                                              disabled={leadAdded}
                                                              onClick={() => {
                                                                void (async () => {
                                                                  if (!agent) return;
                                                                  const { error } = await supabase
                                                                    .from("leads")
                                                                    .insert({
                                                                      name: label,
                                                                      email: u.email?.trim() || "",
                                                                      agent_id: agent.user_id,
                                                                      client_id: u.id,
                                                                      property_id: p.id,
                                                                      source: "engagement",
                                                                      stage: "new",
                                                                      property_interest: title,
                                                                    });
                                                                  if (error) {
                                                                    if (error.code === "23505") {
                                                                      setEngagementLeadAdded((prev) => ({
                                                                        ...prev,
                                                                        [leadKey]: true,
                                                                      }));
                                                                      toast.success("Lead added!");
                                                                    } else {
                                                                      toast.error(error.message);
                                                                    }
                                                                    return;
                                                                  }
                                                                  setEngagementLeadAdded((prev) => ({
                                                                    ...prev,
                                                                    [leadKey]: true,
                                                                  }));
                                                                  toast.success("Lead added!");
                                                                })();
                                                              }}
                                                              className="rounded-lg border border-[#6B9E6E] bg-white px-3 py-1 text-xs font-semibold text-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-70"
                                                            >
                                                              {leadAdded ? "✓ Lead Added" : "+ Add as Lead"}
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                void onMessageAgent({
                                                                  propertyId: p.id,
                                                                  propertyName: title,
                                                                  propertyPrice: formatPropertyPriceDisplay(p.price, p.status),
                                                                  propertyImage: p.image_url ?? null,
                                                                })
                                                              }
                                                              disabled={messageBusy}
                                                              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-6 py-3 font-medium text-white disabled:opacity-50"
                                                            >
                                                              {messageBusy ? (
                                                                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                                              ) : (
                                                                <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                                                              )}
                                                              {messageBusy ? "Opening chat…" : "Message"}
                                                            </button>
                                                            </div>
                                                          </>
                                                        ) : null}
                                                      </div>
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            )}
                                          </div>
                                          <div className="shrink-0 border-t border-[#2C2C2C]/10 px-4 py-3">
                                            <p className="text-center text-xs text-gray-400">
                                              👁 {likeN} likes · 📌 {pinN} saves · 🏠 {listed}
                                            </p>
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <section className="mt-12 border-t border-[#2C2C2C]/15 pt-10">
                  <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Similar Agents</h2>
                  <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                    Same brokerage first, then similar ratings (±0.5).
                  </p>
                  {similarLoading ? (
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="h-44 animate-pulse rounded-2xl bg-white shadow-sm" />
                      <div className="h-44 animate-pulse rounded-2xl bg-white shadow-sm" />
                      <div className="h-44 animate-pulse rounded-2xl bg-white shadow-sm" />
                    </div>
                  ) : similarAgents.length === 0 ? (
                    <p className="mt-6 text-sm font-semibold text-[#2C2C2C]/45">No similar agents to show yet.</p>
                  ) : (
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {similarAgents.slice(0, 3).map((a) => (
                        <AgentDirectoryCard key={a.id} agent={a} className="w-full" />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </main>

          <ViewingRequestModal
            open={showViewingModal}
            onOpenChange={(open) => {
              setShowViewingModal(open);
              if (!open) {
                setViewingPropertyId(null);
                setViewingPropertyTitle("");
              }
            }}
            propertyId={viewingPropertyId}
            propertyTitle={viewingPropertyTitle || `Viewing with ${agent.name}`}
            agentUserId={agent.user_id}
          />
          <SignInViewingPromptModal open={signInPromptOpen} onOpenChange={setSignInPromptOpen} />
          <AgentContactOptionsModal
            open={showContactModal}
            onOpenChange={(open) => {
              setShowContactModal(open);
              if (!open) {
                setContactPropertyId(null);
                setContactPropertyTitle("General Inquiry");
              }
            }}
            agent={contactModalAgent}
            propertyId={contactPropertyId}
            propertyTitle={contactPropertyTitle}
          />
        </>
      )}
    </div>
  );
}
