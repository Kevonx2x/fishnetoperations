"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
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
  Pencil,
  Pin,
  Search,
  Shield,
  Star,
  Tag,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePinnedPropertyIds, usePropertyLikes } from "@/hooks/use-property-engagement";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { labelForClientDocType } from "@/lib/client-documents";
import { formatNotificationTimeAgo } from "@/components/notifications/notification-list";
import { cn } from "@/lib/utils";
import { ClientMobileBottomNav } from "@/components/client/client-mobile-bottom-nav";
import {
  useClientActivityFeed,
  filterSavedRowsByMode,
  filterLikeRowsByMode,
  pickPropertyImage,
  normalizeBadgeSlug,
  metaStr,
  stripPhoneDigits,
  oneProperty,
  BADGE_ORDER,
  type ListingMode,
  type FeedUnion,
  type PropertyRow,
  type SavedJoinRow,
  type LikeJoinRow,
  type ClientDocRow,
  type SharedDocRow,
  type BadgeSlug,
  type ClientPrefsRow,
  type FeedNotificationRow,
  type TimeBucket,
} from "@/hooks/use-client-activity-feed";
import {
  formatBudgetRangePhp,
  isClientProfilePrefsComplete,
  isNonFilipinoCountry,
  lookingToLabel,
  preferredLocationsLabel,
} from "@/lib/client-profile-preferences";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { SupabasePublicImage } from "@/components/supabase-public-image";

const FEED_CARD_CLASS =
  "rounded-2xl border border-gray-100 bg-white text-gray-900 shadow-md transition-transform duration-150 active:scale-95 md:hover:shadow-lg";
const FEED_CARD_PAD_SM = "p-3";
const FEED_CARD_PAD_MD = "p-4";

type MainTab = "my_profile" | "all" | "pins" | "likes" | "badges" | "documents";

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

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstNameFromFull(full: string): string {
  const t = full.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? "there";
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
        <div className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2.5 py-1 shadow-md ring-1 ring-black/5">
          <span className="text-sm font-bold text-gray-900">{priceDisplay}</span>
        </div>
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
              <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/40 text-sm font-bold text-gray-900">
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
          <span className="font-bold text-gray-900">{beforePostedBy}</span>
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
        <p className="mt-0.5 text-xs text-gray-500">{formatNotificationTimeAgo(createdAt)}</p>
        {locationLine.trim() ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
            <span className="min-w-0">{locationLine.trim()}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function visaExpiryDisplay(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(`${iso.trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return `Expires: ${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
}

function ListingSubTabs({
  mode,
  onChange,
}: {
  mode: ListingMode;
  onChange: (m: ListingMode) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {(["rent", "sale"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold transition",
            mode === m
              ? "bg-[#6B9E6E] text-white shadow-sm"
              : "border border-[#2C2C2C]/20 bg-white text-[#6B6B6B]",
          )}
        >
          {m === "rent" ? "For Rent" : "For Sale"}
        </button>
      ))}
    </div>
  );
}

export function MobileClientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const [mainTab, setMainTab] = useState<MainTab>("all");
  const [listingMode, setListingMode] = useState<ListingMode>("rent");
  const [viewBusyUrl, setViewBusyUrl] = useState<string | null>(null);

  const feed = useClientActivityFeed(user?.id);
  const {
    loading,
    fullName,
    avatarUrl,
    createdAt,
    clientPrefs,
    badges,
    savedRows,
    likeRows,
    ownDocs,
    sharedDocs,
    unreadCount,
    feedGrouped,
    feedAgentMeta,
  } = feed;

  const likes = usePropertyLikes();
  const pins = usePinnedPropertyIds();

  const prefsComplete = useMemo(
    () => (clientPrefs ? isClientProfilePrefsComplete(clientPrefs) : false),
    [clientPrefs],
  );

  const feedGroupedAll = useMemo(
    () => feedGrouped.filter((g) => g.items.length > 0),
    [feedGrouped],
  );

  const savedRowsFiltered = useMemo(
    () => filterSavedRowsByMode(savedRows, listingMode),
    [savedRows, listingMode],
  );
  const likeRowsFiltered = useMemo(() => filterLikeRowsByMode(likeRows, listingMode), [likeRows, listingMode]);

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

        <div className="scrollbar-hide -mx-1 mt-4 flex flex-nowrap gap-3 overflow-x-auto pb-2 pr-10">
          {(
            [
              ["my_profile", "My Profile", User],
              ["all", "All", LayoutGrid],
              ["pins", "Pins", Pin],
              ["likes", "Likes", Heart],
              ["badges", "Badges", Star],
              ["documents", "Documents", FileText],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = mainTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMainTab(id)}
                className={cn(
                  "flex shrink-0 snap-start flex-col items-center gap-1 px-2 py-1.5 transition-colors duration-200",
                  active ? "text-[#6B9E6E]" : "text-gray-500",
                )}
              >
                <Icon
                  className={cn("h-5 w-5", active ? "text-[#6B9E6E]" : "text-gray-400")}
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className={cn("text-xs font-medium", active ? "text-[#6B9E6E]" : "text-gray-500")}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="mt-4 px-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-48 w-full rounded-2xl bg-[#E5E5E5]" />
            <div className="h-28 w-full rounded-2xl bg-[#E5E5E5]" />
            <div className="h-28 w-full rounded-2xl bg-[#E5E5E5]" />
          </div>
        ) : mainTab === "my_profile" ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 text-center shadow-sm">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-[#2C2C2C]/10 bg-[#FAF8F4]">
                {avatarUrl?.trim() ? (
                  <SupabasePublicImage
                    src={avatarUrl}
                    alt=""
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-xl font-bold text-white">
                    {agentAvatarInitials(fullName || "Member")}
                  </span>
                )}
              </div>
              <h2 className="mt-3 font-serif text-xl font-semibold text-[#2C2C2C]">
                {fullName.trim() || "Member"}
              </h2>
              <p className="mt-1 text-sm text-[#2C2C2C]/55">
                Member since{" "}
                {createdAt
                  ? new Date(createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
                  : "—"}
              </p>
              <p className="mt-3 text-sm font-semibold text-[#2C2C2C]">
                <span className="text-[#6B9E6E]">{savedRows.length}</span> properties saved
              </p>
              <p className="mt-1 text-xs text-[#2C2C2C]/45">0 properties viewed · coming soon</p>
            </div>
            {clientPrefs ? (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">My Preferences</h3>
                  <Link
                    href="/settings?tab=profile"
                    className="rounded-lg p-1.5 text-[#6B9E6E] transition hover:bg-[#6B9E6E]/15"
                    aria-label="Edit preferences in settings"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
                <div className="mt-3 rounded-lg border border-[#6B9E6E]/30 bg-[#FAF8F4]/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B9E6E]">Location &amp; visa</p>
                  <p className="mt-1 font-serif text-lg font-bold text-[#2C2C2C]">
                    {clientPrefs.country_of_origin?.trim() || "—"}
                  </p>
                  {isNonFilipinoCountry(clientPrefs.country_of_origin) ? (
                    <div className="mt-2 space-y-1 border-t border-[#2C2C2C]/10 pt-2 text-sm">
                      {clientPrefs.visa_type?.trim() ? (
                        <p className="font-semibold text-[#2C2C2C]">Visa: {clientPrefs.visa_type.trim()}</p>
                      ) : (
                        <p className="text-[#2C2C2C]/55">Visa not specified</p>
                      )}
                      {clientPrefs.visa_expiry?.trim() ? (
                        <p className="font-medium text-[#D4A843]">{visaExpiryDisplay(clientPrefs.visa_expiry)}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">Budget</dt>
                    <dd className="font-medium text-[#2C2C2C]">
                      {clientPrefs.budget_min != null || clientPrefs.budget_max != null
                        ? formatBudgetRangePhp(clientPrefs.budget_min, clientPrefs.budget_max)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">Looking to</dt>
                    <dd className="font-medium text-[#2C2C2C]">{lookingToLabel(clientPrefs.looking_to)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">Property type</dt>
                    <dd className="font-medium text-[#2C2C2C]">{clientPrefs.preferred_property_type?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">Preferred areas</dt>
                    <dd className="font-medium text-[#2C2C2C]">{preferredLocationsLabel(clientPrefs.preferred_locations)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">Occupants</dt>
                    <dd className="font-medium text-[#2C2C2C]">
                      {clientPrefs.occupant_count != null ? String(clientPrefs.occupant_count) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">Pets</dt>
                    <dd className="font-medium text-[#2C2C2C]">
                      {clientPrefs.has_pets === true ? "Yes" : clientPrefs.has_pets === false ? "No" : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">Move-in timeline</dt>
                    <dd className="font-medium text-[#2C2C2C]">{clientPrefs.move_in_timeline?.trim() || "—"}</dd>
                  </div>
                  {clientPrefs.agent_notes?.trim() ? (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#2C2C2C]/45">
                        Notes for agents
                      </dt>
                      <dd className="text-sm font-medium leading-snug text-[#2C2C2C]">{clientPrefs.agent_notes.trim()}</dd>
                    </div>
                  ) : null}
                </dl>
                <p
                  className={`mt-3 text-center text-xs font-medium leading-snug ${
                    prefsComplete ? "text-[#6B9E6E]" : "text-[#D4A843]"
                  }`}
                >
                  {prefsComplete
                    ? "✓ Profile preferences complete"
                    : "⚠️ Complete your preferences so agents can serve you better"}
                </p>
                <Link
                  href="/settings"
                  className="mt-4 flex w-full items-center justify-center rounded-full bg-[#6B9E6E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60]"
                >
                  Edit Preferences
                </Link>
              </div>
            ) : (
              <p className="text-center text-sm text-[#6B6B6B]">Loading preferences…</p>
            )}
          </div>
        ) : mainTab === "all" ? (
          <div>
            <AllFeedTab
              grouped={feedGroupedAll}
              feedAgentMeta={feedAgentMeta}
              likes={likes}
              pins={pins}
              onViewBadges={() => setMainTab("badges")}
            />
          </div>
        ) : mainTab === "pins" ? (
          <div>
            <ListingSubTabs mode={listingMode} onChange={setListingMode} />
            <SavedPinsTab savedRows={savedRowsFiltered} />
          </div>
        ) : mainTab === "likes" ? (
          <div>
            <ListingSubTabs mode={listingMode} onChange={setListingMode} />
            <LikedPropertiesTab likeRows={likeRowsFiltered} />
          </div>
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

      <ClientMobileBottomNav
        pathname={pathname}
        userId={user.id}
        avatarUrl={avatarUrl}
        fullName={fullName}
        unreadCount={unreadCount}
      />
    </div>
  );
}

export function AllFeedTab({
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
        <p className="mt-4 text-base font-semibold text-gray-900">Nothing new yet</p>
        <p className="mt-2 max-w-xs text-sm text-gray-500">
          Save listings, book viewings, and we&apos;ll show updates here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ label, items }) => (
        <section key={label}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</h3>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.sortAt}-${
                  item.kind === "saved_property"
                    ? item.saveKey
                    : item.kind === "badge_earned"
                      ? item.feedKey
                      : item.kind === "price_drop_al" || item.kind === "listing_edited_al"
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
                ) : item.kind === "listing_edited_al" ? (
                  <ListingEditedActivityCard item={item} />
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
            "block text-sm font-semibold text-gray-900 transition-transform duration-150 active:scale-[0.98]",
            img ? "mt-2" : "mt-3",
          )}
        >
          {title}
        </Link>
      ) : (
        <p className={cn("text-sm font-semibold text-gray-900", img ? "mt-2" : "mt-3")}>{title}</p>
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
        <p className="font-bold leading-snug text-gray-900">{actionText}</p>
        <p className="mt-0.5 text-sm text-gray-500">{propName}</p>
        {agentLine ? <p className="mt-1 text-xs font-medium text-[#6B9E6E]">{agentLine}</p> : null}
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900"
          >
            WhatsApp
          </a>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-gray-500">{formatNotificationTimeAgo(n.created_at)}</span>
        {propertyHrefId ? (
          <Link
            href={`/properties/${propertyHrefId}`}
            className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-[#E5E5E5]"
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
        <p className="font-bold text-gray-900">Price drop</p>
        <p className="mt-0.5 font-semibold text-gray-900">{item.propertyName}</p>
        <p className="mt-1 text-sm text-gray-500">
          <span className="line-through">{formatPropertyPriceDisplay(item.oldPrice)}</span>
          <span className="mx-1.5">→</span>
          <span className="font-bold text-gray-900">{newPriceDisplay}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-gray-500">{formatNotificationTimeAgo(item.sortAt)}</span>
        <Link
          href={`/properties/${item.propertyId}`}
          className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-[#E5E5E5] transition-all duration-200"
        >
          View
        </Link>
      </div>
    </article>
  );
}

function ListingEditedActivityCard({ item }: { item: Extract<FeedUnion, { kind: "listing_edited_al" }> }) {
  return (
    <article className={cn(FEED_CARD_CLASS, FEED_CARD_PAD_MD, "flex w-full items-center gap-3")}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#D4A843]/20">
        <Pencil className="h-5 w-5 text-[#8a6d32]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900">Listing updated</p>
        <p className="mt-0.5 font-semibold text-gray-900">{item.propertyName}</p>
        <p className="mt-1 text-sm text-gray-500">{item.editedByName} updated details</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-gray-500">{formatNotificationTimeAgo(item.sortAt)}</span>
        <Link
          href={`/properties/${item.propertyId}`}
          className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-[#E5E5E5] transition-all duration-200"
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
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-900 ring-1 ring-black/10",
          theme.iconCircleClass,
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900">{badgeName}</p>
        <p className="mt-0.5 text-sm text-gray-500">{desc}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-gray-500">{formatNotificationTimeAgo(n.created_at)}</span>
        <button
          type="button"
          onClick={onViewBadges}
          className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-[#E5E5E5] transition-all duration-200"
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
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray-900 ring-1 ring-black/10",
          theme.iconCircleClass,
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900">{meta.label}</p>
        <p className="mt-0.5 text-sm text-gray-500">{meta.description}</p>
        <p className="mt-1 text-xs font-medium text-gray-500">{dateLabel}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-gray-500">{formatNotificationTimeAgo(earned_at)}</span>
        <button
          type="button"
          onClick={onViewBadges}
          className="rounded-full bg-[#F0F0F0] px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-[#E5E5E5] transition-all duration-200"
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
        <p className="font-bold text-gray-900">{title}</p>
        {body ? <p className="mt-0.5 text-sm text-gray-500">{body}</p> : null}
      </div>
      <span className="shrink-0 text-xs text-gray-500">{formatNotificationTimeAgo(n.created_at)}</span>
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
    <article
      className={cn(
        FEED_CARD_CLASS,
        FEED_CARD_PAD_SM,
        "flex items-center gap-3 text-gray-900",
      )}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50">
        <Heart className="h-4 w-4 text-red-500" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900">You liked a listing</p>
        <p className="text-sm text-gray-500">{title}</p>
        {ag?.agentName ? (
          <p className="mt-0.5 text-xs font-medium text-[#6B9E6E]">{ag.agentName}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-gray-500">{formatNotificationTimeAgo(createdAt)}</span>
    </article>
  );
}

/** Heart/liked listings from `property_likes` (same source as usePropertyLikes). */
export function LikedPropertiesTab({ likeRows }: { likeRows: LikeJoinRow[] }) {
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
            className="flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-4 shadow-lg ring-1 ring-[#E5E5E5] transition-all duration-200 active:opacity-90"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#2C2C2C]">{p.name?.trim() || "Listing"}</p>
              <p className="mt-1 text-sm text-[#6B6B6B]">{p.location}</p>
              <p className="mt-2 text-base font-bold text-[#6B9E6E]">{formatPropertyPriceDisplay(p.price, p.status)}</p>
            </div>
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#E5E5E5]/60">
              {img ? (
                <Image src={img} alt="" fill className="object-cover" sizes="56px" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Heart className="h-6 w-6 fill-red-500/30 text-red-400" aria-hidden />
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function BadgesTab({ badges }: { badges: { badge_slug: BadgeSlug; earned_at: string }[] }) {
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
export function SavedPinsTab({ savedRows }: { savedRows: SavedJoinRow[] }) {
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

export function DocumentsTab({
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

