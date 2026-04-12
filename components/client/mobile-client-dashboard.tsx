"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Bookmark,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Crown,
  FileText,
  Folder,
  Heart,
  Home,
  Key,
  LayoutGrid,
  Lock,
  MapPin,
  Pin,
  Search,
  Shield,
  Star,
  Tag,
  TrendingUp,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePinnedPropertyIds, usePropertyLikes } from "@/hooks/use-property-engagement";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { labelForClientDocType } from "@/lib/client-documents";
import { formatNotificationTimeAgo } from "@/components/notifications/notification-list";
import { cn } from "@/lib/utils";

const FEED_CARD_CLASS =
  "rounded-2xl border border-gray-100 bg-white shadow-md transition-transform duration-150 active:scale-95 md:hover:shadow-lg";
const FEED_CARD_PAD_SM = "p-3";
const FEED_CARD_PAD_MD = "p-4";

type MainTab = "all" | "pins" | "likes" | "badges" | "documents";

type PropertyPhoto = { url: string; sort_order: number | null };

type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  price: string;
  status: "for_sale" | "for_rent" | "sold" | "rented";
  image_url: string;
  property_photos?: PropertyPhoto[] | null;
};

type SavedJoinRow = { created_at: string; properties: PropertyRow | PropertyRow[] | null };
type LikeJoinRow = {
  property_id: string;
  created_at: string;
  properties: PropertyRow | PropertyRow[] | null;
};

function oneProperty(p: PropertyRow | PropertyRow[] | null | undefined): PropertyRow | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

type ClientDocRow = {
  id: string;
  created_at: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
};

type SharedDocRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type BadgeSlug =
  | "first-save"
  | "smart-shopper"
  | "active-hunter"
  | "early-adopter"
  | "document-ready"
  | "welcome-home"
  | "neighborhood-scout"
  | "committed"
  | "in-the-pipeline"
  | "signed-and-sealed"
  | "document-pro"
  | "social-saver";

const BADGE_ORDER: BadgeSlug[] = [
  "first-save",
  "smart-shopper",
  "active-hunter",
  "early-adopter",
  "document-ready",
  "welcome-home",
  "neighborhood-scout",
  "committed",
  "in-the-pipeline",
  "signed-and-sealed",
  "document-pro",
  "social-saver",
];

const BADGE_UNLOCK_PILL: Record<BadgeSlug, string> = {
  "first-save": "Save 1 property",
  "smart-shopper": "Save 5 properties",
  "active-hunter": "Request 3 viewings",
  "early-adopter": "Join before 2027",
  "document-ready": "Upload 3 documents",
  "welcome-home": "Complete your profile with photo and preferences",
  "neighborhood-scout": "View listings in 5 different locations",
  "committed": "Request 5 or more viewings",
  "in-the-pipeline": "Reach Offer stage in a deal",
  "signed-and-sealed": "Close a deal",
  "document-pro": "Upload 5 or more documents",
  "social-saver": "Save 10 or more properties",
};

/** Accent hex for Badges tab glass cards (feed still uses BADGE_META.theme). */
const BADGE_GLASS_HEX: Record<BadgeSlug, string> = {
  "first-save": "#F97316",
  "smart-shopper": "#D4A843",
  "active-hunter": "#4A90D9",
  "early-adopter": "#9B59B6",
  "document-ready": "#6B9E6E",
  "welcome-home": "#6B9E6E",
  "neighborhood-scout": "#00897B",
  committed: "#3B82F6",
  "in-the-pipeline": "#E67E22",
  "signed-and-sealed": "#D4A843",
  "document-pro": "#9B59B6",
  "social-saver": "#E91E8C",
};

const HEX_CLIP =
  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

const BADGE_META: Record<
  BadgeSlug,
  {
    label: string;
    description: string;
    Icon: LucideIcon;
    theme: {
      borderLeftClass: string;
      earnedTintClass: string;
      iconCircleClass: string;
    };
  }
> = {
  "first-save": {
    label: "First Step",
    description: "The journey to your dream home starts here.",
    Icon: Bookmark,
    theme: {
      borderLeftClass: "border-l-[#6B9E6E]",
      earnedTintClass: "bg-[#6B9E6E]/10",
      iconCircleClass: "bg-[#6B9E6E]",
    },
  },
  "smart-shopper": {
    label: "Sharp Eye",
    description: "You know exactly what you are looking for.",
    Icon: Search,
    theme: {
      borderLeftClass: "border-l-[#D4A843]",
      earnedTintClass: "bg-[#D4A843]/10",
      iconCircleClass: "bg-[#D4A843]",
    },
  },
  "active-hunter": {
    label: "Serious Buyer",
    description: "Actions speak louder than wishlists.",
    Icon: CheckCircle,
    theme: {
      borderLeftClass: "border-l-[#4A90D9]",
      earnedTintClass: "bg-[#4A90D9]/10",
      iconCircleClass: "bg-[#4A90D9]",
    },
  },
  "early-adopter": {
    label: "OG Member",
    description: "You believed before everyone else did.",
    Icon: Crown,
    theme: {
      borderLeftClass: "border-l-[#9B59B6]",
      earnedTintClass: "bg-[#9B59B6]/10",
      iconCircleClass: "bg-[#9B59B6]",
    },
  },
  "document-ready": {
    label: "Deal Ready",
    description: "Prepared. Professional. Unstoppable.",
    Icon: Shield,
    theme: {
      borderLeftClass: "border-l-[#E67E22]",
      earnedTintClass: "bg-[#E67E22]/10",
      iconCircleClass: "bg-[#E67E22]",
    },
  },
  "welcome-home": {
    label: "Welcome Home",
    description: "You are officially on the map",
    Icon: Home,
    theme: {
      borderLeftClass: "border-l-[#6B9E6E]",
      earnedTintClass: "bg-[#6B9E6E]/10",
      iconCircleClass: "bg-[#6B9E6E]",
    },
  },
  "neighborhood-scout": {
    label: "Neighborhood Scout",
    description: "You have done your homework",
    Icon: MapPin,
    theme: {
      borderLeftClass: "border-l-[#00897B]",
      earnedTintClass: "bg-[#00897B]/10",
      iconCircleClass: "bg-[#00897B]",
    },
  },
  committed: {
    label: "Committed",
    description: "You are not playing around",
    Icon: Star,
    theme: {
      borderLeftClass: "border-l-[#4A90D9]",
      earnedTintClass: "bg-[#4A90D9]/10",
      iconCircleClass: "bg-[#4A90D9]",
    },
  },
  "in-the-pipeline": {
    label: "In The Pipeline",
    description: "You are closer than you think",
    Icon: TrendingUp,
    theme: {
      borderLeftClass: "border-l-[#E67E22]",
      earnedTintClass: "bg-[#E67E22]/10",
      iconCircleClass: "bg-[#E67E22]",
    },
  },
  "signed-and-sealed": {
    label: "Signed and Sealed",
    description: "You did it. Welcome home",
    Icon: Key,
    theme: {
      borderLeftClass: "border-l-[#D4A843]",
      earnedTintClass: "bg-[#D4A843]/10",
      iconCircleClass: "bg-[#D4A843]",
    },
  },
  "document-pro": {
    label: "Document Pro",
    description: "Agents love working with you",
    Icon: Folder,
    theme: {
      borderLeftClass: "border-l-[#9B59B6]",
      earnedTintClass: "bg-[#9B59B6]/10",
      iconCircleClass: "bg-[#9B59B6]",
    },
  },
  "social-saver": {
    label: "Social Saver",
    description: "Your wishlist is getting serious",
    Icon: Heart,
    theme: {
      borderLeftClass: "border-l-[#E91E8C]",
      earnedTintClass: "bg-[#E91E8C]/10",
      iconCircleClass: "bg-[#E91E8C]",
    },
  },
};

const KNOWN_BADGE_SLUGS = new Set<string>(BADGE_ORDER);

function normalizeBadgeSlug(raw: string | null | undefined): BadgeSlug | null {
  const t = (raw ?? "").trim();
  return KNOWN_BADGE_SLUGS.has(t) ? (t as BadgeSlug) : null;
}

type FeedNotificationRow = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
};

type FeedUnion =
  | {
      kind: "saved_property";
      sortAt: string;
      property: PropertyRow;
      created_at: string;
      saveKey: string;
    }
  | {
      kind: "agent";
      sortAt: string;
      notification: FeedNotificationRow;
      agentPhone: string | null;
      property?: PropertyRow | null;
      propertyId: string;
      imageUrl: string;
      priceDisplay: string;
      showSavedPill: boolean;
    }
  | {
      kind: "price_drop_al";
      sortAt: string;
      id: string;
      propertyId: string;
      propertyName: string;
      oldPrice: string;
      newPrice: string;
      thumbUrl: string;
    }
  | {
      kind: "badge";
      sortAt: string;
      notification: FeedNotificationRow;
    }
  | {
      kind: "badge_earned";
      sortAt: string;
      badge_slug: BadgeSlug;
      earned_at: string;
      feedKey: string;
    }
  | {
      kind: "viewing_confirmed";
      sortAt: string;
      notification: FeedNotificationRow;
    }
  | {
      kind: "pin_activity";
      sortAt: string;
      likeKey: string;
      property: PropertyRow;
      created_at: string;
    };

type NotifPrefs = {
  price_drop: boolean;
  new_listing_followed_agent: boolean;
  badge_earned: boolean;
  document_request: boolean;
  pipeline_stage: boolean;
  viewing_request_confirmed: boolean;
};

function parseNotifPrefs(raw: unknown): NotifPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    price_drop: o.price_drop !== false,
    new_listing_followed_agent: o.new_listing_followed_agent !== false,
    badge_earned: o.badge_earned !== false,
    document_request: o.document_request !== false,
    pipeline_stage: o.pipeline_stage !== false,
    viewing_request_confirmed: o.viewing_request_confirmed !== false,
  };
}

function filterFeedByPrefs(items: FeedUnion[], prefs: NotifPrefs): FeedUnion[] {
  return items.filter((item) => {
    if (item.kind === "saved_property") return true;
    if (item.kind === "price_drop_al") return prefs.price_drop;
    if (item.kind === "badge") return prefs.badge_earned;
    if (item.kind === "badge_earned") return prefs.badge_earned;
    if (item.kind === "agent") return prefs.viewing_request_confirmed;
    if (item.kind === "viewing_confirmed") return prefs.viewing_request_confirmed;
    return true;
  });
}

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function pickPropertyImage(p: PropertyRow): string {
  const photos = p.property_photos;
  if (photos?.length) {
    const sorted = [...photos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const u = sorted[0]?.url?.trim();
    if (u) return u;
  }
  return p.image_url?.trim() || "";
}

function firstNameFromFull(full: string): string {
  const t = full.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? "there";
}

function stripPhoneDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d : null;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type TimeBucket = "today" | "yesterday" | "this_week" | "earlier";

function bucketForDate(iso: string): TimeBucket {
  const t = new Date(iso).getTime();
  const now = new Date();
  const sod = startOfLocalDay(now).getTime();
  const dayMs = 86400000;
  if (t >= sod) return "today";
  if (t >= sod - dayMs) return "yesterday";
  if (t >= sod - 7 * dayMs) return "this_week";
  return "earlier";
}

const BUCKET_LABEL: Record<TimeBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

function metaStr(m: Record<string, unknown> | null | undefined, key: string): string {
  const v = m?.[key];
  return typeof v === "string" ? v : "";
}

type LikePinApi = {
  has: (id: string) => boolean;
  toggle: (id: string) => Promise<boolean>;
};

function FeedPhotoOverlay({
  propertyId,
  href,
  imageSrc,
  priceDisplay,
  likes,
  pins,
  showPinButton = true,
}: {
  propertyId: string;
  href: string;
  imageSrc: string;
  priceDisplay: string;
  likes: LikePinApi;
  pins: LikePinApi;
  showPinButton?: boolean;
}) {
  const isLiked = likes.has(propertyId);
  const isPinned = pins.has(propertyId);
  return (
    <div className="relative mt-3 h-[160px] w-full overflow-hidden rounded-xl bg-[#E5E5E5]/40">
      <Link href={href} className="absolute inset-0 block">
        <Image src={imageSrc} alt="" fill className="object-cover" sizes="100vw" unoptimized />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute bottom-2 right-2 text-sm font-bold text-white">{priceDisplay}</div>
      </Link>
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="pointer-events-auto absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void likes.toggle(propertyId);
            }}
            className={cn(
              "inline-flex rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
              isLiked ? "border border-red-200 bg-white" : "border border-gray-200 bg-white/80",
            )}
            aria-label="Like"
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                isLiked ? "fill-red-500 text-red-500" : "fill-none text-red-400",
              )}
            />
          </button>
          {showPinButton ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void pins.toggle(propertyId);
              }}
              className={cn(
                "inline-flex rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                isPinned ? "border border-[#D4A843]/40 bg-white" : "border border-gray-200 bg-white/80",
              )}
              aria-label="Save"
            >
              <Pin
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isPinned ? "fill-[#D4A843] text-[#D4A843]" : "fill-none text-[#D4A843]",
                )}
              />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PinSaveFeedCardHeader({
  beforePostedBy,
  createdAt,
  agent,
  locationLine,
  headerBadgeKind,
}: {
  beforePostedBy: string;
  createdAt: string;
  agent: { agentId: string | null; agentName: string; agentAvatarUrl: string | null } | null;
  locationLine: string;
  headerBadgeKind: "pin" | "heart" | "both";
}) {
  const a =
    agent &&
    (Boolean(agent.agentId) ||
      (Boolean(agent.agentName?.trim()) && agent.agentName.trim() !== "Agent"))
      ? agent
      : null;
  return (
    <div className="flex gap-3">
      {a ? (
        <div className="relative h-10 w-10 shrink-0">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[#E5E5E5]/60">
            {a.agentAvatarUrl ? (
              <Image src={a.agentAvatarUrl} alt="" fill className="object-cover" sizes="40px" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/40 text-sm font-bold text-white">
                {(a.agentName || "A").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          {headerBadgeKind === "both" ? (
            <div className="absolute -bottom-0.5 -right-0.5 flex items-end" aria-hidden>
              <span className="relative z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md">
                <Heart className="h-4 w-4 text-red-500" strokeWidth={2.25} fill="currentColor" />
              </span>
              <span className="relative z-[2] -ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md">
                <Pin className="h-4 w-4 text-[#D4A843]" strokeWidth={2.25} />
              </span>
            </div>
          ) : headerBadgeKind === "pin" ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md" aria-hidden>
              <Pin className="h-4 w-4 text-[#D4A843]" strokeWidth={2.25} />
            </span>
          ) : headerBadgeKind === "heart" ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md" aria-hidden>
              <Heart className="h-4 w-4 text-red-500" strokeWidth={2.25} fill="currentColor" />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-bold text-[#2C2C2C]">{beforePostedBy}</span>
          {a ? (
            <>
              {" posted by "}
              {a.agentId ? (
                <Link href={`/agents/${a.agentId}`} className="font-medium text-[#6B9E6E] hover:underline">
                  {a.agentName}
                </Link>
              ) : (
                <span className="font-medium text-[#6B9E6E]">{a.agentName}</span>
              )}
            </>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{formatNotificationTimeAgo(createdAt)}</p>
        {locationLine.trim() ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="min-w-0">{locationLine.trim()}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MobileClientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mainTab, setMainTab] = useState<MainTab>("pins");
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [badges, setBadges] = useState<{ badge_slug: BadgeSlug; earned_at: string }[]>([]);
  const [savedRows, setSavedRows] = useState<SavedJoinRow[]>([]);
  const [likeRows, setLikeRows] = useState<LikeJoinRow[]>([]);
  const [ownDocs, setOwnDocs] = useState<ClientDocRow[]>([]);
  const [sharedDocs, setSharedDocs] = useState<SharedDocRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewBusyUrl, setViewBusyUrl] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedUnion[]>([]);
  const [feedAgentMeta, setFeedAgentMeta] = useState<
    Record<string, { agentName: string; agentAvatarUrl: string | null; agentId: string | null }>
  >({});
  const likes = usePropertyLikes();
  const pins = usePinnedPropertyIds();

  const loadAll = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.warn("[mobile-client-dashboard] auth.getUser() error", authErr);
    }
    const authUid = authData.user?.id ?? null;
    const uid = authUid ?? user.id;
    if (authUid && user.id && authUid !== user.id) {
      console.warn("[mobile-client-dashboard] auth user id does not match context user.id; using auth session id for queries", {
        authUserId: authUid,
        contextUserId: user.id,
      });
    }

    const [
      profileRes,
      badgesRes,
      savedRes,
      likesRes,
      ownDocsRes,
      sharedRes,
      notifRes,
      feedNotifRes,
    ] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url, created_at, notification_preferences").eq("id", uid).maybeSingle(),
      supabase.from("client_badges").select("badge_slug, earned_at").eq("client_id", uid).order("earned_at", { ascending: false }),
      supabase
        .from("saved_properties")
        .select(
          `
          created_at,
          properties (
            id,
            name,
            location,
            price,
            status,
            image_url,
            property_photos (url, sort_order)
          )
        `,
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_likes")
        .select(
          `
          property_id,
          created_at,
          properties (
            id,
            name,
            location,
            price,
            status,
            image_url,
            property_photos (url, sort_order)
          )
        `,
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("client_documents")
        .select("id, created_at, document_type, file_url, file_name")
        .eq("client_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id, created_at, metadata")
        .eq("user_id", uid)
        .eq("type", "document_shared")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
      supabase
        .from("notifications")
        .select("id, created_at, type, title, body, metadata")
        .eq("user_id", uid)
        .in("type", ["client_feed_price_drop", "client_feed_viewing", "viewing_confirmed"])
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    const prow = profileRes.data as {
      full_name?: string | null;
      avatar_url?: string | null;
      created_at?: string;
      notification_preferences?: unknown;
    } | null;
    if (prow) {
      setFullName(prow.full_name?.trim() ?? "");
      setAvatarUrl(prow.avatar_url?.trim() || null);
    }

    if (badgesRes.error) {
      console.error("[mobile-client-dashboard] client_badges query error", badgesRes.error);
    }
    const rawBadgeRows = (badgesRes.data ?? []) as { badge_slug: string; earned_at: string }[];
    const normalizedBadges: { badge_slug: BadgeSlug; earned_at: string }[] = [];
    for (const row of rawBadgeRows) {
      const slug = normalizeBadgeSlug(row.badge_slug);
      if (!slug) {
        if ((row.badge_slug ?? "").trim()) {
          console.warn("[mobile-client-dashboard] client_badges row ignored — unknown badge_slug", row.badge_slug);
        }
        continue;
      }
      normalizedBadges.push({ badge_slug: slug, earned_at: row.earned_at });
    }
    console.log("[mobile-client-dashboard] client_badges", {
      clientId: uid,
      rowCount: normalizedBadges.length,
      rows: normalizedBadges,
    });
    setBadges(normalizedBadges);

    setSavedRows((savedRes.data ?? []) as unknown as SavedJoinRow[]);
    setLikeRows((likesRes.data ?? []) as unknown as LikeJoinRow[]);

    setOwnDocs((ownDocsRes.data ?? []) as ClientDocRow[]);

    if (sharedRes.data) {
      const filtered = (sharedRes.data as SharedDocRow[]).filter((r) => {
        const url = r.metadata && typeof r.metadata.signed_url === "string" ? r.metadata.signed_url : "";
        return Boolean(url?.trim());
      });
      setSharedDocs(filtered);
    } else {
      setSharedDocs([]);
    }

    setUnreadCount(typeof notifRes.count === "number" ? notifRes.count : 0);

    const feedRows = (feedNotifRes.data ?? []) as FeedNotificationRow[];
    const savedIdSet = new Set<string>();
    for (const r of (savedRes.data ?? []) as SavedJoinRow[]) {
      const p = oneProperty(r.properties);
      if (p?.id) savedIdSet.add(p.id);
    }

    const profileIdSetEarly = new Set<string>();
    for (const r of (savedRes.data ?? []) as SavedJoinRow[]) {
      const p = oneProperty(r.properties);
      if (p?.id) profileIdSetEarly.add(p.id);
    }
    for (const r of (likesRes.data ?? []) as LikeJoinRow[]) {
      const p = oneProperty(r.properties);
      if (p?.id) profileIdSetEarly.add(p.id);
    }

    const propertyIds = new Set<string>(profileIdSetEarly);
    const agentIds = new Set<string>();
    for (const n of feedRows) {
      const m = n.metadata ?? {};
      const pid = m.property_id;
      if (typeof pid === "string" && pid) propertyIds.add(pid);
      const aid = m.agent_user_id;
      if (typeof aid === "string" && aid) agentIds.add(aid);
    }

    let propMap = new Map<string, PropertyRow>();
    if (propertyIds.size > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select(
          `
          id,
          name,
          location,
          price,
          status,
          image_url,
          property_photos (url, sort_order)
        `,
        )
        .in("id", [...propertyIds]);
      for (const row of (props ?? []) as PropertyRow[]) {
        propMap.set(row.id, row);
      }
    }

    let phoneMap = new Map<string, string | null>();
    if (agentIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, phone")
        .in("id", [...agentIds]);
      for (const pr of profs ?? []) {
        const r = pr as { id: string; phone: string | null };
        phoneMap.set(r.id, r.phone);
      }
    }

    const built: FeedUnion[] = [];

    for (const n of feedRows) {
      if (n.type === "viewing_confirmed") {
        built.push({ kind: "viewing_confirmed", sortAt: n.created_at, notification: n });
        continue;
      }
      const m = n.metadata ?? {};
      if (n.type === "client_feed_viewing") {
        const aid = typeof m.agent_user_id === "string" ? m.agent_user_id : "";
        const pid = typeof m.property_id === "string" ? m.property_id : "";
        const prop = pid ? propMap.get(pid) ?? null : null;
        const metaImg = metaStr(m, "property_image_url");
        const img = metaImg || (prop ? pickPropertyImage(prop) : "") || "";
        const priceRaw = prop?.price ?? "";
        const status = prop?.status ?? "for_sale";
        const priceDisplay = formatPropertyPriceDisplay(priceRaw, status);
        const showSavedPill = pid ? savedIdSet.has(pid) : false;
        const phone = aid ? stripPhoneDigits(phoneMap.get(aid) ?? null) : null;
        built.push({
          kind: "agent",
          sortAt: n.created_at,
          notification: n,
          agentPhone: phone,
          property: prop,
          propertyId: pid,
          imageUrl: img,
          priceDisplay,
          showSavedPill,
        });
      } else if (n.type === "client_feed_price_drop") {
        const pidDrop = typeof m.property_id === "string" ? m.property_id : "";
        const propDrop = pidDrop ? propMap.get(pidDrop) : undefined;
        const thumb =
          metaStr(m, "property_image_url") || (propDrop ? pickPropertyImage(propDrop) : "") || "";
        const pName =
          metaStr(m, "property_name")?.trim() ||
          propDrop?.name?.trim() ||
          propDrop?.location?.trim() ||
          "Listing";
        built.push({
          kind: "price_drop_al",
          sortAt: n.created_at,
          id: `notif-${n.id}`,
          propertyId: pidDrop,
          propertyName: pName,
          oldPrice: metaStr(m, "old_price"),
          newPrice: metaStr(m, "new_price"),
          thumbUrl: thumb,
        });
      }
    }

    for (const b of normalizedBadges) {
      built.push({
        kind: "badge_earned",
        sortAt: b.earned_at,
        badge_slug: b.badge_slug,
        earned_at: b.earned_at,
        feedKey: `${b.badge_slug}-${b.earned_at}`,
      });
    }

    const savedDataForFeed = (savedRes.data ?? []) as SavedJoinRow[];
    for (const r of savedDataForFeed) {
      const p = oneProperty(r.properties);
      if (!p?.id) continue;
      built.push({
        kind: "saved_property",
        sortAt: r.created_at,
        property: p,
        created_at: r.created_at,
        saveKey: `${p.id}-${r.created_at}`,
      });
    }

    const likeData = (likesRes.data ?? []) as {
      property_id: string;
      created_at: string;
      properties: PropertyRow | PropertyRow[] | null;
    }[];
    for (const row of likeData) {
      const p = oneProperty(row.properties);
      if (!p?.id) continue;
      built.push({
        kind: "pin_activity",
        sortAt: row.created_at,
        likeKey: `${row.property_id}-${row.created_at}`,
        property: p,
        created_at: row.created_at,
      });
    }

    const pidListForActivity = [...profileIdSetEarly];
    if (pidListForActivity.length > 0) {
      const { data: alRows } = await supabase
        .from("activity_log")
        .select("id, created_at, entity_id, metadata")
        .eq("entity_type", "price_drop")
        .in("entity_id", pidListForActivity);
      for (const raw of alRows ?? []) {
        const row = raw as {
          id: string;
          created_at: string;
          entity_id: string;
          metadata: Record<string, unknown> | null;
        };
        const meta = row.metadata ?? {};
        const oldP = metaStr(meta, "old_price");
        const newP = metaStr(meta, "new_price");
        const propRow = propMap.get(row.entity_id);
        const thumb =
          propRow ? pickPropertyImage(propRow) : metaStr(meta, "property_image_url") || "";
        const pName =
          propRow?.name?.trim() || propRow?.location?.trim() || "Listing";
        built.push({
          kind: "price_drop_al",
          sortAt: row.created_at,
          id: row.id,
          propertyId: row.entity_id,
          propertyName: pName,
          oldPrice: oldP,
          newPrice: newP,
          thumbUrl: thumb,
        });
      }
    }

    built.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

    const prefs = parseNotifPrefs(
      (profileRes.data as { notification_preferences?: unknown } | null)?.notification_preferences,
    );
    setFeedItems(filterFeedByPrefs(built, prefs));

    const feedPropIds = new Set<string>();
    for (const item of built) {
      if (item.kind === "agent") {
        if (item.propertyId) feedPropIds.add(item.propertyId);
      } else if (item.kind === "price_drop_al") {
        feedPropIds.add(item.propertyId);
      } else if (item.kind === "saved_property") {
        feedPropIds.add(item.property.id);
      } else if (item.kind === "pin_activity") {
        feedPropIds.add(item.property.id);
      }
    }
    if (feedPropIds.size > 0) {
      const { data: feedPa } = await supabase
        .from("property_agents")
        .select(
          `
          property_id,
          agent:agents (
            id,
            name,
            image_url
          )
        `,
        )
        .in("property_id", [...feedPropIds]);
      const fam: Record<string, { agentName: string; agentAvatarUrl: string | null; agentId: string | null }> = {};
      const seen = new Set<string>();
      for (const row of feedPa ?? []) {
        const r = row as {
          property_id: string;
          agent: { id?: string | null; name?: string | null; image_url?: string | null } | null;
        };
        if (seen.has(r.property_id) || !r.agent) continue;
        seen.add(r.property_id);
        fam[r.property_id] = {
          agentId: typeof r.agent.id === "string" && r.agent.id ? r.agent.id : null,
          agentName: r.agent.name?.trim() || "Agent",
          agentAvatarUrl: r.agent.image_url?.trim() || null,
        };
      }
      setFeedAgentMeta(fam);
    } else {
      setFeedAgentMeta({});
    }

    setLoading(false);
  }, [supabase, user?.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const feedGrouped = useMemo(() => {
    const order: TimeBucket[] = ["today", "yesterday", "this_week", "earlier"];
    const groups: Record<TimeBucket, FeedUnion[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const item of feedItems) {
      groups[bucketForDate(item.sortAt)].push(item);
    }
    return order
      .filter((k) => groups[k].length > 0)
      .map((k) => ({
        bucket: k,
        label: BUCKET_LABEL[k],
        items: [...groups[k]].sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()),
      }));
  }, [feedItems]);

  const openOwnDocument = async (file_url: string) => {
    setViewBusyUrl(file_url);
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
      setViewBusyUrl(null);
    }
  };

  const first = firstNameFromFull(fullName);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <div className="animate-pulse px-5 pt-4">
          <div className="h-8 w-56 rounded-lg bg-[#E5E5E5]" />
          <div className="mt-4 h-12 w-full rounded-2xl bg-[#E5E5E5]" />
          <div className="mt-6 h-40 w-full rounded-2xl bg-[#E5E5E5]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-28 font-sans text-[#2C2C2C] transition-all duration-200">
      <header className="px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-normal text-[#2C2C2C]">
              {greetingForHour()},{" "}
              <span className="font-serif text-2xl font-bold text-[#2C2C2C]">{first}</span>
            </p>
          </div>
          <Link
            href="/notifications"
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-200 active:opacity-80"
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6 text-[#2C2C2C]" />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="scrollbar-hide -mx-1 mt-4 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", "All", LayoutGrid],
              ["pins", "Pins", Pin],
              ["likes", "Likes", Heart],
              ["badges", "Badges", Star],
              ["documents", "Documents", FileText],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMainTab(id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1.5 rounded-full px-4 py-2.5 transition-all duration-200",
                mainTab === id
                  ? "border-l-[3px] border-[#6B9E6E] bg-white pl-3 text-[#2C2C2C] shadow-sm ring-1 ring-[#E5E5E5]"
                  : "border-l-[3px] border-transparent text-[#6B6B6B]",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={mainTab === id ? 2.25 : 1.75} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="mt-4 px-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-48 w-full rounded-2xl bg-[#E5E5E5]" />
            <div className="h-28 w-full rounded-2xl bg-[#E5E5E5]" />
            <div className="h-28 w-full rounded-2xl bg-[#E5E5E5]" />
          </div>
        ) : mainTab === "all" ? (
          <AllFeedTab
            grouped={feedGrouped}
            feedAgentMeta={feedAgentMeta}
            likes={likes}
            pins={pins}
            onViewBadges={() => setMainTab("badges")}
          />
        ) : mainTab === "pins" ? (
          <SavedPinsTab savedRows={savedRows} />
        ) : mainTab === "likes" ? (
          <LikedPropertiesTab likeRows={likeRows} />
        ) : mainTab === "badges" ? (
          <BadgesTab badges={badges} />
        ) : (
          <DocumentsTab
            ownDocs={ownDocs}
            sharedDocs={sharedDocs}
            viewBusyUrl={viewBusyUrl}
            onViewOwn={openOwnDocument}
          />
        )}
      </main>

      <BottomNav
        pathname={pathname}
        userId={user.id}
        avatarUrl={avatarUrl}
        fullName={fullName}
        unreadCount={unreadCount}
      />
    </div>
  );
}

function AllFeedTab({
  grouped,
  feedAgentMeta,
  likes,
  pins,
  onViewBadges,
}: {
  grouped: { bucket: TimeBucket; label: string; items: FeedUnion[] }[];
  feedAgentMeta: Record<
    string,
    { agentName: string; agentAvatarUrl: string | null; agentId: string | null }
  >;
  likes: LikePinApi;
  pins: LikePinApi;
  onViewBadges: () => void;
}) {
  const empty = grouped.length === 0 || grouped.every((g) => g.items.length === 0);

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-[#6B9E6E]/20 text-[#6B9E6E]">
          <LayoutGrid className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-base font-semibold text-[#2C2C2C]">Nothing new yet</p>
        <p className="mt-2 max-w-xs text-sm text-[#6B6B6B]">
          Save listings, book viewings, and we&apos;ll show updates here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ label, items }) => (
        <section key={label}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B6B6B]">{label}</h3>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.sortAt}-${
                  item.kind === "saved_property"
                    ? item.saveKey
                    : item.kind === "badge_earned"
                      ? item.feedKey
                      : item.kind === "price_drop_al"
                        ? item.id
                        : item.kind === "viewing_confirmed"
                          ? item.notification.id
                          : "notification" in item
                            ? item.notification.id
                            : item.likeKey
                }`}
              >
                {item.kind === "saved_property" ? (
                  <SavedPropertyBigCard
                    property={item.property}
                    createdAt={item.created_at}
                    feedAgentMeta={feedAgentMeta}
                    likes={likes}
                    pins={pins}
                  />
                ) : item.kind === "agent" ? (
                  <ViewingRequestMediumCard item={item} feedAgentMeta={feedAgentMeta} />
                ) : item.kind === "price_drop_al" ? (
                  <PriceDropMediumCard item={item} />
                ) : item.kind === "badge_earned" ? (
                  <BadgeEarnedFeedCard
                    badge_slug={item.badge_slug}
                    earned_at={item.earned_at}
                    onViewBadges={onViewBadges}
                  />
                ) : item.kind === "badge" ? (
                  <BadgeMediumCard n={item.notification} onViewBadges={onViewBadges} />
                ) : item.kind === "viewing_confirmed" ? (
                  <ViewingConfirmedSmallCard n={item.notification} />
                ) : (
                  <ListingLikeSmallCard
                    property={item.property}
                    createdAt={item.created_at}
                    feedAgentMeta={feedAgentMeta}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SavedPropertyBigCard({
  property,
  createdAt,
  feedAgentMeta,
  likes,
  pins,
}: {
  property: PropertyRow;
  createdAt: string;
  feedAgentMeta: Record<
    string,
    { agentName: string; agentAvatarUrl: string | null; agentId: string | null }
  >;
  likes: LikePinApi;
  pins: LikePinApi;
}) {
  const img = pickPropertyImage(property);
  const pid = property.id;
  const title = property.name?.trim() || property.location || "Listing";
  const price = formatPropertyPriceDisplay(property.price, property.status);
  const ag = feedAgentMeta[pid];
  const agent = ag
    ? { agentId: ag.agentId, agentName: ag.agentName, agentAvatarUrl: ag.agentAvatarUrl }
    : null;

  return (
    <article className={cn(FEED_CARD_CLASS, FEED_CARD_PAD_MD)}>
      <PinSaveFeedCardHeader
        beforePostedBy="You saved this listing"
        createdAt={createdAt}
        agent={agent}
        locationLine={property.location ?? ""}
        headerBadgeKind="heart"
      />
      {img && pid ? (
        <FeedPhotoOverlay
          propertyId={pid}
          href={`/properties/${pid}`}
          imageSrc={img}
          priceDisplay={price}
          likes={likes}
          pins={pins}
          showPinButton={false}
        />
      ) : null}
      {pid ? (
        <Link
          href={`/properties/${pid}`}
          className={cn(
            "block text-sm font-semibold text-gray-800 transition-transform duration-150 active:scale-[0.98]",
            img ? "mt-2" : "mt-3",
          )}
        >
          {title}
        </Link>
      ) : (
        <p className={cn("text-sm font-semibold text-gray-800", img ? "mt-2" : "mt-3")}>{title}</p>
      )}
    </article>
  );
}

function ViewingRequestMediumCard({
  item,
  feedAgentMeta,
}: {
  item: Extract<FeedUnion, { kind: "agent" }>;
  feedAgentMeta: Record<
    string,
    { agentName: string; agentAvatarUrl: string | null; agentId?: string | null }
  >;
}) {
  const n = item.notification;
  const m = n.metadata ?? {};
  const propName =
    metaStr(m, "property_name").trim() ||
    item.property?.name?.trim() ||
    item.property?.location ||
    "Property";
  const actionText = (n.title ?? n.body ?? "Viewing activity").trim();
  const propertyHrefId = metaStr(m, "property_id").trim() || item.property?.id || "";
  const agentLine = propertyHrefId ? feedAgentMeta[propertyHrefId]?.agentName?.trim() : "";
  const waHref = item.agentPhone ? `https://wa.me/${item.agentPhone}` : null;

  return (
    <article className={cn(FEED_CARD_CLASS, FEED_CARD_PAD_MD, "flex w-full items-start gap-3")}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#6B9E6E]/20">
        <Calendar className="h-5 w-5 text-[#6B9E6E]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug text-[#2C2C2C]">{actionText}</p>
        <p className="mt-0.5 text-sm text-[#6B6B6B]">{propName}</p>
        {agentLine ? <p className="mt-1 text-xs font-medium text-[#6B6B6B]">{agentLine}</p> : null}
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#25D366]"
          >
            WhatsApp
          </a>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-[#6B6B6B]">{formatNotificationTimeAgo(n.created_at)}</span>
        {propertyHrefId ? (
          <Link
            href={`/properties/${propertyHrefId}`}
            className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] ring-1 ring-[#E5E5E5]"
          >
            View
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function PriceDropMediumCard({ item }: { item: Extract<FeedUnion, { kind: "price_drop_al" }> }) {
  const newPriceDisplay = formatPropertyPriceDisplay(item.newPrice);
  return (
    <article className={cn(FEED_CARD_CLASS, FEED_CARD_PAD_MD, "flex w-full items-center gap-3")}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#6B9E6E]/20">
        <Tag className="h-5 w-5 text-[#6B9E6E]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[#2C2C2C]">Price drop</p>
        <p className="mt-0.5 font-semibold text-[#2C2C2C]">{item.propertyName}</p>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          <span className="line-through">{formatPropertyPriceDisplay(item.oldPrice)}</span>
          <span className="mx-1.5">→</span>
          <span className="font-bold text-[#6B9E6E]">{newPriceDisplay}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-[#6B6B6B]">{formatNotificationTimeAgo(item.sortAt)}</span>
        <Link
          href={`/properties/${item.propertyId}`}
          className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] ring-1 ring-[#E5E5E5] transition-all duration-200"
        >
          View
        </Link>
      </div>
    </article>
  );
}

function BadgeMediumCard({
  n,
  onViewBadges,
}: {
  n: FeedNotificationRow;
  onViewBadges: () => void;
}) {
  const m = n.metadata ?? {};
  const badgeName = metaStr(m, "badge_name").trim() || n.title || "Badge";
  const desc = metaStr(m, "badge_description").trim() || (n.body ?? "").trim() || "You earned a new badge.";
  const slug = normalizeBadgeSlug(metaStr(m, "badge_slug"));
  const themed = slug ? BADGE_META[slug] : null;
  const Icon = themed?.Icon ?? Star;
  const theme = themed?.theme ?? {
    borderLeftClass: "border-l-[#D4A843]",
    earnedTintClass: "bg-[#D4A843]/10",
    iconCircleClass: "bg-[#D4A843]",
  };

  return (
    <article
      className={cn(
        FEED_CARD_CLASS,
        FEED_CARD_PAD_MD,
        "flex w-full items-center gap-3 border-l-[3px] border-solid",
        theme.borderLeftClass,
        theme.earnedTintClass,
      )}
    >
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-white", theme.iconCircleClass)}>
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[#2C2C2C]">{badgeName}</p>
        <p className="mt-0.5 text-sm text-[#6B6B6B]">{desc}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-[#6B6B6B]">{formatNotificationTimeAgo(n.created_at)}</span>
        <button
          type="button"
          onClick={onViewBadges}
          className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] ring-1 ring-[#E5E5E5] transition-all duration-200"
        >
          View badges
        </button>
      </div>
    </article>
  );
}

function BadgeEarnedFeedCard({
  badge_slug,
  earned_at,
  onViewBadges,
}: {
  badge_slug: BadgeSlug;
  earned_at: string;
  onViewBadges: () => void;
}) {
  const meta = BADGE_META[badge_slug];
  const { Icon, theme } = meta;
  const dateLabel = new Date(earned_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article
      className={cn(
        FEED_CARD_CLASS,
        FEED_CARD_PAD_MD,
        "flex w-full items-center gap-3 border-l-[3px] border-solid",
        theme.borderLeftClass,
        theme.earnedTintClass,
      )}
    >
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-white", theme.iconCircleClass)}>
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[#2C2C2C]">{meta.label}</p>
        <p className="mt-0.5 text-sm text-[#6B6B6B]">{meta.description}</p>
        <p className="mt-1 text-xs font-medium text-[#6B9E6E]">{dateLabel}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-[#6B6B6B]">{formatNotificationTimeAgo(earned_at)}</span>
        <button
          type="button"
          onClick={onViewBadges}
          className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] ring-1 ring-[#E5E5E5] transition-all duration-200"
        >
          View badges
        </button>
      </div>
    </article>
  );
}

function ViewingConfirmedSmallCard({ n }: { n: FeedNotificationRow }) {
  const title = (n.title ?? "Viewing confirmed").trim();
  const body = (n.body ?? "").trim();
  return (
    <article className={cn(FEED_CARD_CLASS, FEED_CARD_PAD_SM, "flex items-start gap-3")}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#6B9E6E]/15">
        <Calendar className="h-4 w-4 text-[#6B9E6E]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[#2C2C2C]">{title}</p>
        {body ? <p className="mt-0.5 text-sm text-[#6B6B6B]">{body}</p> : null}
      </div>
      <span className="shrink-0 text-xs text-[#6B6B6B]">{formatNotificationTimeAgo(n.created_at)}</span>
    </article>
  );
}

function ListingLikeSmallCard({
  property,
  createdAt,
  feedAgentMeta,
}: {
  property: PropertyRow;
  createdAt: string;
  feedAgentMeta: Record<
    string,
    { agentName: string; agentAvatarUrl: string | null; agentId: string | null }
  >;
}) {
  const title = property.name?.trim() || property.location || "Listing";
  const ag = feedAgentMeta[property.id];

  return (
    <article className={cn(FEED_CARD_CLASS, FEED_CARD_PAD_SM, "flex items-center gap-3")}>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E5E5E5]/80">
        <Home className="h-4 w-4 text-[#6B6B6B]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#2C2C2C]">Listing updated</p>
        <p className="text-sm text-[#6B6B6B]">{title}</p>
        {ag?.agentName ? <p className="mt-0.5 text-xs text-[#6B6B6B]">{ag.agentName}</p> : null}
      </div>
      <span className="shrink-0 text-xs text-[#6B6B6B]">{formatNotificationTimeAgo(createdAt)}</span>
    </article>
  );
}

/** Heart/liked listings from `property_likes` (same source as usePropertyLikes). */
function LikedPropertiesTab({ likeRows }: { likeRows: LikeJoinRow[] }) {
  if (likeRows.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No liked properties yet"
        subtitle="Heart listings you love."
      />
    );
  }

  return (
    <div className="space-y-4">
      {likeRows.map((r) => {
        const p = oneProperty(r.properties);
        if (!p) return null;
        const img = pickPropertyImage(p);
        return (
          <Link
            key={`like-${r.created_at}-${p.id}`}
            href={`/properties/${p.id}`}
            className="relative block overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-[#E5E5E5] transition-all duration-200"
          >
            <div className="relative h-[200px] w-full bg-[#E5E5E5]/40">
              {img ? (
                <Image src={img} alt="" fill className="object-cover" sizes="100vw" unoptimized />
              ) : null}
              <div className="absolute right-3 top-3">
                <Heart className="h-7 w-7 fill-red-500 text-red-500" aria-hidden />
              </div>
            </div>
            <div className="p-4">
              <p className="font-semibold text-[#2C2C2C]">{p.name?.trim() || "Listing"}</p>
              <p className="mt-1 text-sm text-[#6B6B6B]">{p.location}</p>
              <p className="mt-2 text-base font-bold text-[#6B9E6E]">{formatPropertyPriceDisplay(p.price, p.status)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function BadgesTab({ badges }: { badges: { badge_slug: BadgeSlug; earned_at: string }[] }) {
  const earnedMap = useMemo(() => {
    const m = new Map<BadgeSlug, string>();
    for (const b of badges) m.set(b.badge_slug, b.earned_at);
    return m;
  }, [badges]);

  return (
    <div className="bg-[#FAF8F4]">
      <div className="grid grid-cols-2 gap-3 [grid-auto-rows:1fr]">
        {BADGE_ORDER.map((slug) => {
          const meta = BADGE_META[slug];
          const earnedAt = earnedMap.get(slug);
          const earned = Boolean(earnedAt);
          const accentHex = BADGE_GLASS_HEX[slug];
          const rgb = hexToRgb(accentHex);

          if (earned && earnedAt) {
            const Icon = meta.Icon;
            const glassStyle =
              rgb != null
                ? {
                    backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`,
                    borderColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`,
                    boxShadow: `inset 0 0 8px rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`,
                  }
                : undefined;
            const watermarkStyle =
              rgb != null
                ? { color: `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)` }
                : { color: "rgba(255,255,255,0.08)" };

            return (
              <article
                key={slug}
                className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border p-3"
                style={glassStyle}
              >
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  aria-hidden
                >
                  <Icon className="h-16 w-16" strokeWidth={1.5} style={watermarkStyle} />
                </div>

                <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="relative flex h-12 w-12 shrink-0 items-center justify-center"
                      style={{ clipPath: HEX_CLIP }}
                    >
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ backgroundColor: accentHex }}
                      >
                        <Icon className="relative z-[1] h-5 w-5 text-white" strokeWidth={2} aria-hidden />
                      </div>
                    </div>
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/25"
                      aria-hidden
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#6B9E6E]" strokeWidth={2.5} />
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-bold text-white">{meta.label}</p>
                  <p className="mt-1 text-xs leading-snug text-gray-400">{meta.description}</p>

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <p className="text-xs font-medium text-[#6B9E6E]">
                      Earned {formatNotificationTimeAgo(earnedAt)}
                    </p>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.25} aria-hidden />
                  </div>
                </div>
              </article>
            );
          }

          return (
            <article
              key={slug}
              className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1a1f2e] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center bg-[#12161f]"
                  style={{ clipPath: HEX_CLIP }}
                >
                  <Lock className="h-5 w-5 text-gray-500" strokeWidth={2} aria-hidden />
                </div>
              </div>

              <p className="mt-3 text-sm font-bold text-gray-500">{meta.label}</p>
              <p className="mt-1 text-xs leading-snug text-gray-500">{meta.description}</p>

              <p className="mt-auto pt-3 text-xs text-gray-500">{BADGE_UNLOCK_PILL[slug]}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Pinned listings from `saved_properties` (same source as usePinnedPropertyIds / pin action). */
function SavedPinsTab({ savedRows }: { savedRows: SavedJoinRow[] }) {
  if (savedRows.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved properties yet"
        subtitle="No saved listings yet."
      />
    );
  }

  return (
    <div className="space-y-4">
      {savedRows.map((r) => {
        const p = oneProperty(r.properties);
        if (!p) return null;
        const img = pickPropertyImage(p);
        return (
          <Link
            key={`saved-${r.created_at}-${p.id}`}
            href={`/properties/${p.id}`}
            className="relative block overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-[#E5E5E5] transition-all duration-200"
          >
            <div className="relative h-[200px] w-full bg-[#E5E5E5]/40">
              {img ? (
                <Image src={img} alt="" fill className="object-cover" sizes="100vw" unoptimized />
              ) : null}
              <div className="absolute right-3 top-3">
                <Bookmark className="h-7 w-7 fill-[#D4A843] text-[#D4A843]" aria-hidden />
              </div>
            </div>
            <div className="p-4">
              <p className="font-semibold text-[#2C2C2C]">{p.name?.trim() || "Listing"}</p>
              <p className="mt-1 text-sm text-[#6B6B6B]">{p.location}</p>
              <p className="mt-2 text-base font-bold text-[#6B9E6E]">{formatPropertyPriceDisplay(p.price, p.status)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function DocumentsTab({
  ownDocs,
  sharedDocs,
  viewBusyUrl,
  onViewOwn,
}: {
  ownDocs: ClientDocRow[];
  sharedDocs: SharedDocRow[];
  viewBusyUrl: string | null;
  onViewOwn: (file_url: string) => void;
}) {
  return (
    <div className="space-y-10">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#6B6B6B]">Your uploads</h3>
        {ownDocs.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B6B6B]">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {ownDocs.map((d) => (
              <li key={d.id} className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-[#E5E5E5]">
                <div className="flex gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#6B9E6E]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B]">
                      {labelForClientDocType(d.document_type)}
                    </p>
                    <p className="mt-1 font-semibold text-[#2C2C2C]">{d.file_name?.trim() || "Document"}</p>
                    <p className="mt-1 text-xs text-[#6B6B6B]">{new Date(d.created_at).toLocaleDateString()}</p>
                    <button
                      type="button"
                      disabled={viewBusyUrl === d.file_url}
                      onClick={() => void onViewOwn(d.file_url)}
                      className="mt-3 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow transition-all duration-200 disabled:opacity-50"
                    >
                      {viewBusyUrl === d.file_url ? "Opening…" : "View"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#6B6B6B]">From Your Agent</h3>
        {sharedDocs.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B6B6B]">No shared documents yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sharedDocs.map((r) => {
              const meta = r.metadata ?? {};
              const signedUrl = typeof meta.signed_url === "string" ? meta.signed_url : "";
              const docType =
                typeof meta.document_type === "string" ? meta.document_type : "Document";
              const fileName =
                typeof meta.file_name === "string" && meta.file_name.trim()
                  ? meta.file_name
                  : "File";
              const agentName =
                typeof meta.agent_name === "string" && meta.agent_name.trim()
                  ? meta.agent_name
                  : "Agent";
              return (
                <li key={r.id} className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-[#E5E5E5]">
                  <div className="flex gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#6B9E6E]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#6B6B6B]">{docType}</p>
                      <p className="mt-1 font-semibold text-[#2C2C2C]">{fileName}</p>
                      <p className="mt-1 text-sm text-[#6B6B6B]">
                        From {agentName} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      <button
                        type="button"
                        onClick={() => signedUrl && window.open(signedUrl, "_blank", "noopener,noreferrer")}
                        className="mt-3 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow"
                      >
                        View
                      </button>
                      <p className="mt-2 text-[11px] font-medium text-[#6B6B6B]">
                        Link may expire after ~1 hour. Request a new one from your agent if needed.
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Bookmark;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#6B9E6E]/20 text-[#6B9E6E]">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <p className="mt-4 font-serif text-lg font-bold text-[#2C2C2C]">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-[#6B6B6B]">{subtitle}</p>
    </div>
  );
}

function BottomNav({
  pathname,
  userId,
  avatarUrl,
  fullName,
  unreadCount,
}: {
  pathname: string;
  userId: string;
  avatarUrl: string | null;
  fullName: string;
  unreadCount: number;
}) {
  const initial = fullName.trim().slice(0, 1).toUpperCase() || "?";
  const profileHref = `/clients/${encodeURIComponent(userId)}`;
  const profileActive = pathname.startsWith("/clients/");

  const Item = ({
    href,
    label,
    icon: Icon,
    active,
    children,
  }: {
    href: string;
    label: string;
    icon?: typeof Home;
    active: boolean;
    children?: ReactNode;
  }) => (
    <Link
      href={href}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-all duration-200",
        active ? "text-[#6B9E6E]" : "text-[#6B6B6B]",
      )}
    >
      {children ?? (Icon ? <Icon className="h-6 w-6" /> : null)}
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#E5E5E5] bg-white px-1 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Item href="/" label="Home" icon={Home} active={pathname === "/"} />
      <Item href="/notifications" label="Notifications" active={pathname.startsWith("/notifications")}>
        <span className="relative">
          <Bell className="h-6 w-6" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
      </Item>
      <Link
        href={profileHref}
        className={cn(
          "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-all duration-200",
          profileActive ? "text-[#6B9E6E]" : "text-[#6B6B6B]",
        )}
      >
        <span className="relative h-7 w-7 overflow-hidden rounded-full bg-[#6B9E6E] ring-2 ring-[#E5E5E5]">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" sizes="28px" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white">
              {initial}
            </span>
          )}
        </span>
        <span className="truncate">Profile</span>
      </Link>
    </nav>
  );
}
