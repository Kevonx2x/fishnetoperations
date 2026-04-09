"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Clock,
  Heart,
  Pin,
  LayoutGrid,
  Mail,
  MapPin,
  MoreHorizontal,
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
import { fetchSimilarAgents } from "@/lib/similar-agents";
import { listingListedLabel } from "@/lib/listing-listed-time";
import { usePropertyEngagementForProperties } from "@/hooks/use-property-engagement";
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
  status: "for_sale" | "for_rent";
  listing_status: string | null;
  listed_by: string | null;
};

type ListingFilter = "active" | "sold" | "for_rent" | "for_sale";
type ListingSort = "newest" | "price_high" | "most_saved";

const FILTER_TABS: { id: ListingFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "sold", label: "Sold" },
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
  if (mode === "for_rent") return p.status === "for_rent";
  if (mode === "for_sale") return p.status === "for_sale";
  return true;
}

const MASKED_PUBLIC_PRC = "PRC-AG-202*-*****";

function isAgentIdentityVerified(agent: AgentRow): boolean {
  return agent.verification_status === "verified";
}

function verificationStatusBadge(agent: AgentRow): { label: string; className: string } {
  const v = agent.verification_status;
  if (v === "verified") {
    return {
      label: "Verified Agent",
      className: "rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-bold text-white shadow-sm",
    };
  }
  if (v === "pending") {
    return {
      label: "Verification Pending",
      className:
        "rounded-full border border-[#2C2C2C]/15 bg-[#FAF8F4] px-5 py-2 text-sm font-bold text-[#2C2C2C]/70",
    };
  }
  if (v === "rejected") {
    return {
      label: "Verification Failed - Resubmit in Settings",
      className:
        "max-w-[280px] rounded-full border border-red-300 bg-red-50 px-4 py-2 text-center text-xs font-bold leading-snug text-red-700 sm:max-w-none sm:text-sm",
    };
  }
  if (v === "suspended") {
    return {
      label: "Account Suspended",
      className:
        "max-w-[280px] rounded-full border border-red-400 bg-red-100 px-4 py-2 text-center text-xs font-bold leading-snug text-red-800 sm:max-w-none sm:text-sm",
    };
  }
  return {
    label: "Unverified",
    className:
      "rounded-full border border-[#2C2C2C]/15 bg-[#FAF8F4] px-5 py-2 text-sm font-bold text-[#2C2C2C]/55",
  };
}

const BIO_WORD_LIMIT = 40;

function AgentBioBlock({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [animHeight, setAnimHeight] = useState(0);
  const words = useMemo(() => bio.trim().split(/\s+/).filter(Boolean), [bio]);
  const needsTruncate = words.length > BIO_WORD_LIMIT;
  const truncatedText = useMemo(
    () => `${words.slice(0, BIO_WORD_LIMIT).join(" ")}...`,
    [words],
  );

  useLayoutEffect(() => {
    if (!contentRef.current) return;
    setAnimHeight(contentRef.current.scrollHeight);
  }, [expanded, bio, needsTruncate]);

  if (!needsTruncate) {
    return (
      <p className="mt-2 whitespace-pre-wrap text-center text-sm font-medium leading-relaxed text-[#2C2C2C]/75">
        {bio.trim()}
      </p>
    );
  }

  return (
    <div className="mt-2">
      <motion.div
        className="overflow-hidden"
        initial={false}
        animate={{ height: animHeight }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      >
        <div ref={contentRef}>
          {!expanded ? (
            <p className="text-center text-sm font-medium leading-relaxed text-[#2C2C2C]/75">
              {truncatedText}{" "}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="font-semibold text-[#6B9E6E] hover:underline"
              >
                Read more
              </button>
            </p>
          ) : (
            <div className="text-center">
              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#2C2C2C]/75">
                {bio.trim()}
              </p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="mt-2 font-semibold text-[#6B9E6E] hover:underline"
              >
                Read less
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

type EngagementPreviewUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type EngagementPreview = {
  users: EngagementPreviewUser[];
  agentIdByUserId: Record<string, string>;
};

function groupEngagementTopUsers(
  rows: { user_id: string; property_id: string; created_at: string }[],
): Map<string, string[]> {
  const byProperty = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byProperty.has(row.property_id)) byProperty.set(row.property_id, []);
    byProperty.get(row.property_id)!.push(row);
  }
  const out = new Map<string, string[]>();
  for (const [pid, list] of byProperty) {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const uids: string[] = [];
    for (const r of list) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      uids.push(r.user_id);
      if (uids.length >= 3) break;
    }
    out.set(pid, uids);
  }
  return out;
}

function profileHrefForEngagement(
  u: EngagementPreviewUser,
  agentIdByUserId: Record<string, string>,
): string | null {
  if (u.role === "client") return `/clients/${u.id}`;
  if (u.role === "agent") {
    const aid = agentIdByUserId[u.id];
    return aid ? `/agents/${aid}` : null;
  }
  return null;
}

function OwnListingEngagementButton({
  kind,
  count,
  showCount,
  topUsers,
  isOwnProfile,
  icon,
  ariaLabel,
  onToggle,
}: {
  kind: "like" | "pin";
  count: number;
  showCount: boolean;
  topUsers: EngagementPreview | undefined;
  isOwnProfile: boolean;
  icon: ReactNode;
  ariaLabel: string;
  /** Used only when viewing someone else’s profile (clients can like/pin). Own profile: ignored. */
  onToggle: () => void | Promise<void>;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);

  const canOpenPopover =
    isOwnProfile && count > 0 && Boolean(topUsers?.users.length);

  const triggerClass =
    "relative inline-flex flex-col items-center gap-0.5 rounded-lg bg-white/95 px-1.5 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-md ring-1 ring-black/10";

  const iconAndCount = (
    <>
      {icon}
      {showCount ? <span>{count}</span> : null}
    </>
  );

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setShowPopover(false);
      setPopoverStyle(null);
    }, 200);
  };

  const openPopover = () => {
    console.log("hover triggered");
    console.log("topUsers", topUsers);
    if (!canOpenPopover) return;
    clearLeaveTimer();
    setShowPopover(true);
    if (typeof window === "undefined" || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPopoverStyle({
      position: "fixed",
      right: window.innerWidth - r.right,
      bottom: window.innerHeight - r.top + 8,
      zIndex: 50,
      minWidth: 160,
    });
  };

  /** Own listing on your agent profile: counts are read-only; hover opens popover only (no like/pin toggle). */
  if (isOwnProfile) {
    if (!canOpenPopover) {
      return (
        <div className={triggerClass} aria-label={ariaLabel} role="group">
          {iconAndCount}
        </div>
      );
    }

    const others = Math.max(0, count - 3);

    const popoverContent = (
      <div
        className="min-w-[160px] rounded-xl bg-white p-2 shadow-lg"
        style={popoverStyle ?? undefined}
        role="tooltip"
        onMouseEnter={() => {
          clearLeaveTimer();
          setShowPopover(true);
        }}
        onMouseLeave={scheduleClose}
      >
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">
          {kind === "like" ? "Liked by" : "Pinned by"}
        </p>
        <ul className="space-y-2">
          {topUsers!.users.map((u) => {
            const href = profileHrefForEngagement(u, topUsers!.agentIdByUserId);
            const label = u.full_name?.trim() || "User";
            const inner = (
              <>
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-black/10">
                  {u.avatar_url?.trim() ? (
                    <SupabasePublicImage src={u.avatar_url} alt="" fill sizes="24px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-[#2C2C2C]/55">
                      {agentAvatarInitials(label)}
                    </span>
                  )}
                </div>
                <span className="min-w-0 truncate text-xs font-semibold text-[#2C2C2C]">{label}</span>
              </>
            );
            return (
              <li key={`${kind}-${u.id}`}>
                {href ? (
                  <Link
                    href={href}
                    className="flex items-center gap-2 hover:opacity-90"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
        {others > 0 ? (
          <p className="mt-2 text-xs font-medium text-[#2C2C2C]/45">and {others} others</p>
        ) : null}
      </div>
    );

    return (
      <>
        <div
          ref={anchorRef}
          className={triggerClass}
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
          aria-label={ariaLabel}
          role="group"
        >
          {iconAndCount}
        </div>
        {showPopover && popoverStyle && typeof document !== "undefined"
          ? createPortal(popoverContent, document.body)
          : null}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onToggle();
      }}
      className={triggerClass}
      aria-label={ariaLabel}
    >
      {iconAndCount}
    </button>
  );
}

export default function AgentProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user, loading: authLoading } = useAuth();

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

  const listingIdsKey = useMemo(
    () => [...listings.map((l) => l.id)].sort().join(","),
    [listings],
  );

  const [likePreviewByProperty, setLikePreviewByProperty] = useState<Record<string, EngagementPreview>>({});
  const [pinPreviewByProperty, setPinPreviewByProperty] = useState<Record<string, EngagementPreview>>({});

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

  const agentUserId = agent?.user_id ?? null;
  const agentRecordId = agent?.id ?? null;

  useEffect(() => {
    if (!agentUserId || !agentRecordId) {
      setListings([]);
      return;
    }

    let cancelled = false;
    const selectFields =
      "id, created_at, name, location, price, beds, baths, sqft, image_url, status, listing_status, listed_by";

    void (async () => {
      const [ownedRes, linksRes] = await Promise.all([
        supabase.from("properties").select(selectFields).eq("listed_by", agentUserId),
        supabase.from("property_agents").select("property_id").eq("agent_id", agentRecordId),
      ]);

      if (cancelled) return;

      const owned = (ownedRes.data ?? []) as unknown as ListingRow[];
      const linkIds = [...new Set((linksRes.data ?? []).map((r) => r.property_id).filter(Boolean))] as string[];

      let linked: ListingRow[] = [];
      if (linkIds.length > 0) {
        const { data: linkedRows } = await supabase.from("properties").select(selectFields).in("id", linkIds);
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

  useEffect(() => {
    if (!isOwnProfile || !user?.id || listings.length === 0) {
      setLikePreviewByProperty({});
      setPinPreviewByProperty({});
      return;
    }
    let cancelled = false;
    const propertyIds = listings.map((l) => l.id);
    void (async () => {
      const [likesRes, savesRes] = await Promise.all([
        supabase
          .from("property_likes")
          .select("user_id, property_id, created_at")
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_properties")
          .select("user_id, property_id, created_at")
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (likesRes.error) console.error(likesRes.error);
      if (savesRes.error) console.error(savesRes.error);

      const likeRows = (likesRes.data ?? []) as {
        user_id: string;
        property_id: string;
        created_at: string;
      }[];
      const saveRows = (savesRes.data ?? []) as {
        user_id: string;
        property_id: string;
        created_at: string;
      }[];

      const likeTop3 = groupEngagementTopUsers(likeRows);
      const pinTop3 = groupEngagementTopUsers(saveRows);

      const allUserIds = new Set<string>();
      for (const uids of likeTop3.values()) for (const u of uids) allUserIds.add(u);
      for (const uids of pinTop3.values()) for (const u of uids) allUserIds.add(u);

      if (allUserIds.size === 0) {
        if (!cancelled) {
          setLikePreviewByProperty({});
          setPinPreviewByProperty({});
        }
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .in("id", [...allUserIds]);
      if (cancelled) return;
      if (profErr) console.error(profErr);

      const profileMap = new Map((prof ?? []).map((p) => [p.id, p as EngagementPreviewUser]));

      const agentUserIdsForLinks = [
        ...new Set((prof ?? []).filter((p) => p.role === "agent").map((p) => p.id)),
      ];
      let agentIdByUserId: Record<string, string> = {};
      if (agentUserIdsForLinks.length > 0) {
        const { data: ags } = await supabase.from("agents").select("id, user_id").in("user_id", agentUserIdsForLinks);
        if (cancelled) return;
        if (ags) agentIdByUserId = Object.fromEntries(ags.map((a) => [a.user_id, a.id as string]));
      }

      function buildPreview(map: Map<string, string[]>): Record<string, EngagementPreview> {
        const rec: Record<string, EngagementPreview> = {};
        for (const pid of propertyIds) {
          const uids = map.get(pid);
          if (!uids || uids.length === 0) continue;
          const users = uids
            .map((uid) => profileMap.get(uid))
            .filter((p): p is EngagementPreviewUser => Boolean(p));
          if (users.length === 0) continue;
          rec[pid] = { users, agentIdByUserId };
        }
        return rec;
      }

      if (!cancelled) {
        setLikePreviewByProperty(buildPreview(likeTop3));
        setPinPreviewByProperty(buildPreview(pinTop3));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user?.id, listingIdsKey]);

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

  const onCallClick = () => {
    if (authLoading) return;
    if (!user) {
      setSignInPromptOpen(true);
      return;
    }
    if (agent?.phone) {
      window.location.href = `tel:${agent.phone}`;
    }
  };

  const identityBadge = agent ? verificationStatusBadge(agent) : null;

  const brokerageDisplay = (a: AgentRow) => {
    const n = a.brokers?.company_name?.trim();
    return n ? n : "Independent Agent";
  };

  const licenseDisplay = (a: AgentRow) => {
    const n = String(a.license_number ?? "").trim();
    return n ? MASKED_PUBLIC_PRC : null;
  };

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
              <aside className="lg:sticky lg:top-24">
                <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white p-6 shadow-md">
                  <div className="relative mx-auto h-[100px] w-[100px]">
                    <div className="relative h-full w-full overflow-hidden rounded-full bg-[#FAF8F4] ring-2 ring-white">
                      {agent.image_url ? (
                        <SupabasePublicImage
                          src={agent.image_url}
                          alt={agent.name}
                          fill
                          sizes="100px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-serif text-3xl font-bold text-[#2C2C2C]/25">
                          {agent.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    {isAgentIdentityVerified(agent) ? (
                      <span
                        className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#D4A843] shadow-md ring-2 ring-white"
                        title="Verified"
                      >
                        <BadgeCheck className="h-4 w-4 text-white" aria-hidden />
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-5 text-center font-serif text-xl font-bold tracking-tight text-[#2C2C2C]">
                    {agent.name}
                  </h1>

                  <p className="mt-2 text-center text-sm italic text-[#2C2C2C]/55">{brokerageDisplay(agent)}</p>

                  <p className="mt-1 text-center text-xs italic text-[#2C2C2C]/45">
                    {licenseDisplay(agent) ? (
                      <>License {licenseDisplay(agent)}</>
                    ) : (
                      <span>License unknown</span>
                    )}
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C]/85">
                      <Trophy className="h-3 w-3 text-[#6B9E6E]" />
                      {agent.closings} closings
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C]/85">
                      <Clock className="h-3 w-3 text-[#6B9E6E]" />
                      {agent.response_time ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4A843]/35 bg-[#D4A843]/10 px-2.5 py-1 text-[11px] font-bold text-[#8a6d32]">
                      <Star className="h-3 w-3 text-[#D4A843]" />
                      {formatAgentScore(agent.score)}
                    </span>
                  </div>

                  <div className="mt-5 flex justify-center">
                    {identityBadge ? (
                      <span className={identityBadge.className}>{identityBadge.label}</span>
                    ) : null}
                  </div>

                  <div className="mt-6 border-t border-[#2C2C2C]/10 pt-5">
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

                  <div className="mt-5 space-y-2 border-t border-[#2C2C2C]/10 pt-5">
                    <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                      Contact
                    </p>
                    <p className="break-all text-center text-sm font-medium text-[#2C2C2C]/80">{agent.email}</p>
                    {agent.phone?.trim() ? (
                      <button
                        type="button"
                        onClick={onCallClick}
                        disabled={authLoading}
                        className="w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#6B9E6E]/10 disabled:opacity-50"
                      >
                        {agent.phone}
                      </button>
                    ) : (
                      <p className="text-center text-sm italic text-[#2C2C2C]/45">Phone not listed</p>
                    )}
                  </div>

                  <div className="mt-6 space-y-2">
                    <button
                      type="button"
                      onClick={openContactHeader}
                      disabled={authLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2C2C2C] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2C2C2C]/90 disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      Contact
                    </button>
                    <button
                      type="button"
                      onClick={openScheduleHeader}
                      disabled={authLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#6B9E6E] bg-white py-3 text-sm font-semibold text-[#2C2C2C] transition hover:bg-[#6B9E6E]/10 disabled:opacity-50"
                    >
                      <Calendar className="h-4 w-4 text-[#6B9E6E]" />
                      Schedule
                    </button>
                    {isOwnProfile ? (
                      <Link
                        href="/dashboard/agent?tab=profile"
                        className="flex w-full items-center justify-center rounded-full border border-[#D4A843]/50 bg-[#FAF8F4] py-3 text-sm font-bold text-[#8a6d32] transition hover:bg-[#D4A843]/15"
                      >
                        Edit Profile
                      </Link>
                    ) : null}
                  </div>
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
                        const statusLabel = p.status === "for_rent" ? "For Rent" : "For Sale";
                        const canManagePost =
                          isOwnProfile &&
                          user?.id &&
                          p.listed_by === agent.user_id;
                        return (
                          <article
                            key={p.id}
                            className="overflow-hidden rounded-2xl border border-[#2C2C2C]/8 bg-white shadow-sm"
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
                              <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[#6B9E6E] px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                                {statusLabel}
                              </span>
                              <div className="absolute right-3 top-3 z-10 flex items-start gap-1">
                                <OwnListingEngagementButton
                                  kind="like"
                                  count={likeN}
                                  showCount={showEng}
                                  topUsers={likePreviewByProperty[p.id]}
                                  isOwnProfile={isOwnProfile}
                                  ariaLabel={showEng ? `${likeN} likes` : "Like"}
                                  onToggle={() => engagement.toggleLike(p.id)}
                                  icon={
                                    <Heart
                                      className={`h-3.5 w-3.5 shrink-0 ${engagement.isLiked(p.id) ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"}`}
                                      aria-hidden
                                    />
                                  }
                                />
                                <OwnListingEngagementButton
                                  kind="pin"
                                  count={pinN}
                                  showCount={showEng}
                                  topUsers={pinPreviewByProperty[p.id]}
                                  isOwnProfile={isOwnProfile}
                                  ariaLabel={showEng ? `${pinN} pins` : "Pin"}
                                  onToggle={() => engagement.togglePin(p.id)}
                                  icon={
                                    <Pin
                                      className={`h-3.5 w-3.5 shrink-0 ${engagement.isPinned(p.id) ? "fill-[#D4A843] text-[#D4A843]" : "text-[#2C2C2C]"}`}
                                      aria-hidden
                                    />
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-1 px-4 pb-3 pt-3">
                              <p className="font-serif text-2xl font-bold text-[#D4A843]">{p.price}</p>
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
                                    onClick={() => openScheduleForListing(p)}
                                    disabled={authLoading}
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-[#6B9E6E] bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#6B9E6E]/10 disabled:opacity-50 sm:w-auto"
                                  >
                                    <Calendar className="h-3.5 w-3.5 text-[#6B9E6E]" />
                                    Schedule View
                                  </button>
                                </>
                              ) : null}
                              <Link
                                href={`/properties/${encodeURIComponent(p.id)}`}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#D4A843]/60 bg-[#FAF8F4] px-3 py-2.5 text-sm font-bold text-[#8a6d32] hover:bg-[#D4A843]/15 sm:w-auto"
                              >
                                Property Details
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </article>
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
