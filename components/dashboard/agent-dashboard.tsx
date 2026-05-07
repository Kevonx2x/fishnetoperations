"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  FileText,
  Check,
  CreditCard,
  Eye,
  GitBranch,
  House,
  Info,
  LayoutList,
  Loader2,
  MapPin,
  ExternalLink,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Settings,
    Sparkles,
  Globe,
  Phone,
  User,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { AgentBillingTab } from "@/components/dashboard/agent-billing-tab";
import { AgentAnalyticsTab } from "@/components/dashboard/agent-analytics-tab";
import { AgentLeadSlideOver } from "@/components/dashboard/agent-lead-slideover";
import {
  AgentPipelineTab,
  type PipelineStageId,
  type ViewingRequestPipelineMeta,
} from "@/components/dashboard/agent-pipeline-tab";
import { AgentMessagesInbox } from "@/features/messaging/components/agent-messages-inbox";
import { streamDmChannelId } from "@/features/messaging/lib/stream-dm-channel-id";
import { useUnreadMessageCount } from "@/features/messaging/hooks/use-unread-message-count";
import { useAuth } from "@/contexts/auth-context";
import { useGlobalAlert } from "@/contexts/global-alert-context";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { AgentCalendarModal } from "@/components/dashboard/agent-calendar-modal";
import { AgentViewingsProvider, useAgentViewings } from "@/lib/agent-viewings-context";
// Legacy onboarding modal — replaced by agent tour overlay. Kept commented in case we want to revive.
// import { PostLoginModal } from "@/components/onboarding/post-login-modal";
import { AgentTourSidebarHelp } from "@/components/onboarding/agent-tour-trigger";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeListingLocation } from "@/lib/duplicate-listing";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  manilaCalendarAddDays,
  manilaDateStringFromInstant,
  manilaDayOfMonthFromYmd,
  manilaMonthDayLabelFromInstant,
  manilaWeekdayShortFromYmd,
} from "@/lib/manila-datetime";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
import { formatLicenseDate } from "@/lib/license-expiry";
import {
  coListLimitForTier,
  isUnlimitedCoList,
  isUnlimitedOwned,
  listingLimitForTier,
  normalizeListingTier,
  TIER_LABEL,
} from "@/lib/agent-listing-limits";
import {
  DEFAULT_AGENT_LANGUAGES_COMMAS,
  DEFAULT_AGENT_SPECIALTIES_COMMAS,
} from "@/lib/agent-profile-defaults";
import { ListingLimitUpgradeModal } from "@/components/marketplace/listing-limit-upgrade-modal";
import { ImportListingModal } from "@/components/dashboard/import-listing-modal";
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload";
import {
  GooglePlacesInput,
  type GooglePlaceSelectedPayload,
} from "@/components/forms/google-places-input";
import { PhPhoneInput } from "@/components/ui/ph-phone-input";
import { isPhilippinePhoneMode, validatePhilippinePhoneInput } from "@/lib/phone-ph";
import { formatListingPricePhp } from "@/lib/format-listing-price";
import { cn } from "@/lib/utils";
import { avatarObjectExt, validateAvatarFile } from "@/lib/supabase/upload-avatar";
import {
  AGENT_AVAILABILITY_NOW,
  AGENT_AVAILABILITY_OFFLINE,
  isAgentAvailableNow,
} from "@/components/marketplace/agent-availability-badge";
import { AgentAvailabilitySchedule } from "@/components/dashboard/agent-availability-schedule";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import {
  formatDigitsOnly,
  formatPriceInputDigits,
  parseListingPricePesos,
  validateBedsBaths,
  validateListingPriceDisplay,
  validateSqft,
} from "@/lib/validation/listing-form";
import { normalizeCity } from "@/lib/normalize-city";
import { ServiceAreasMultiInput } from "@/components/ui/service-areas-multi-input";
import {
  AGENT_PIPELINE_TAB_NOTIFICATION_TYPES,
  NotificationCard,
  resolveNotificationLink,
  type NotificationListItem,
} from "@/components/notifications/notification-list";
import { formatRelativeTime } from "@/lib/relative-time";
import { isPropertyListingRemoved } from "@/lib/property-soft-delete";
import {
  normalizePropertyAvailabilityState,
  propertyEngagementLooksUnavailable,
} from "@/lib/property-availability";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab =
  | "overview"
  | "pipeline"
  | "messages"
  | "documents"
  | "listings"
  | "profile"
  | "analytics"
  | "notifications"
  | "billing";

const URL_TAB_QUERY_ALLOWED: Tab[] = [
  "overview",
  "pipeline",
  "messages",
  "documents",
  "listings",
  "profile",
  "analytics",
  "notifications",
  "billing",
];

function tabFromSearchParamsString(queryString: string): Tab {
  const sp = new URLSearchParams(queryString);
  const raw = sp.get("tab");
  if (raw === "leads" || raw === "viewings") return "pipeline";
  if (raw === "dashboard") return "overview";
  /** Legacy bookmarks */
  if (raw === "team") return "profile";
  if (raw && URL_TAB_QUERY_ALLOWED.includes(raw as Tab)) return raw as Tab;
  return "overview";
}

type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  license_number: string;
  license_expiry: string | null;
  image_url: string | null;
  status: string;
  verified: boolean;
  broker_id: string | null;
  specialties: string | null;
  service_areas: string | null;
  social_links: Record<string, string> | null;
  age?: number | null;
  years_experience?: number | null;
  languages_spoken?: string | null;
  response_time?: string | null;
  closings?: number | null;
  score?: number | null;
  listing_tier?: string | null;
  availability_schedule?: unknown;
  availability?: string | null;
  updated_at?: string | null;
  verification_status?: "pending" | "verified" | "rejected" | null;
};

type LeadRow = {
  id: number;
  is_demo?: boolean | null;
  name: string;
  email: string;
  phone: string | null;
  property_interest: string | null;
  message: string | null;
  stage: string;
  pipeline_stage?: string | null;
  pipeline_position?: number | null;
  pinned?: boolean | null;
  pinned_at?: string | null;
  closing_notes?: string | null;
  property_id?: string | null;
  /** Client viewing slot (`viewing_requests.scheduled_at`) when set. */
  viewing_request_id?: string | null;
  created_at: string;
  updated_at?: string;
  client_id: string | null;
  closed_date?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  closure_confirmed_by_client?: boolean | null;
  /** Cached avatar_url for the linked client profile (used in pipeline cards). */
  client_avatar_url?: string | null;
  new_lead_seen_at?: string | null;
  new_viewing_request_seen_at?: string | null;
  archived_by_client?: boolean | null;
  archived_at?: string | null;
  archive_reason?: string | null;
  archive_note?: string | null;
  stage_at_archive?: string | null;
};

async function fetchViewingRequestMetaByLeadId(
  sb: SupabaseClient,
  rows: { id: number; pipeline_stage?: string | null; viewing_request_id?: string | null }[],
): Promise<Record<number, ViewingRequestPipelineMeta>> {
  const out: Record<number, ViewingRequestPipelineMeta> = {};
  const withVr = rows.filter(
    (r) => String(r.pipeline_stage ?? "").toLowerCase() === "lead" && r.viewing_request_id?.trim(),
  );
  const vrIds = [...new Set(withVr.map((r) => r.viewing_request_id!.trim()))];
  if (vrIds.length === 0) return out;
  const { data, error } = await sb
    .from("viewing_requests")
    .select("id, scheduled_at, created_at, updated_at")
    .in("id", vrIds);
  if (error || !data?.length) return out;
  const by = new Map(
    (data as { id: string; scheduled_at: string | null; created_at: string; updated_at: string }[]).map((r) => [
      r.id,
      {
        scheduled_at: r.scheduled_at != null ? String(r.scheduled_at) : "",
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      },
    ]),
  );
  for (const r of withVr) {
    const vid = r.viewing_request_id!.trim();
    const row = by.get(vid);
    if (row?.scheduled_at?.trim()) out[r.id] = row;
  }
  return out;
}

type ViewingRow = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  scheduled_at: string;
  status: string;
  property_id: string;
  notes: string | null;
  reminder_minutes?: number | null;
  reminder_sent?: boolean | null;
  client_user_id: string | null;
};

type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  /** Supabase may return `numeric` as string or number. */
  price: string | number;
  rent_price?: string | number | null;
  listing_type?: "sale" | "rent" | "both" | null;
  image_url: string;
  status: "for_sale" | "for_rent" | "both";
  beds: number;
  baths: number;
  sqft: string;
  description: string | null;
  property_type: string | null;
  listing_status: "active" | "under_offer" | "sold" | "off_market";
  is_presale?: boolean;
  developer_name?: string | null;
  turnover_date?: string | null;
  unit_types?: string[] | null;
  /** True when connected via property_agents but not the listing owner. */
  isCoHost?: boolean;
  expires_at?: string | null;
  deleted_at?: string | null;
  availability_state?: string | null;
  listed_by?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  formatted_address?: string | null;
  place_id?: string | null;
  /** Tutorial seed listing; excluded from marketplace. */
  is_demo?: boolean | null;
  pet_friendly?: boolean | null;
  near_schools?: boolean | null;
  family_friendly?: boolean | null;
};

const EDIT_PROPERTY_TYPES = [
  "House",
  "Condo",
  "Apartment",
  "Studio",
  "Commercial",
  "Villa",
  "Townhouse",
  "Land",
  "Presale",
] as const;

/** New listing + standard resale/rent types (presale uses separate `Presale` option in edit when applicable). */
const LISTING_PROPERTY_TYPE_OPTIONS = [
  "Condo",
  "House",
  "Townhouse",
  "Lot",
  "Apartment",
  "Commercial",
  "Warehouse",
  "Office",
] as const;

function listingPropertyTypeOptionsForEdit(current: string | null | undefined, isPresaleListing: boolean): string[] {
  const opts = new Set<string>([...LISTING_PROPERTY_TYPE_OPTIONS]);
  const cur = (current ?? "").trim();
  if (isPresaleListing || cur === "Presale") opts.add("Presale");
  if (cur && !opts.has(cur)) opts.add(cur);
  return [...opts];
}

function normalizeNewListingPropertyType(
  raw: string | null | undefined,
): (typeof LISTING_PROPERTY_TYPE_OPTIONS)[number] {
  const t = (raw ?? "").trim();
  if ((LISTING_PROPERTY_TYPE_OPTIONS as readonly string[]).includes(t)) {
    return t as (typeof LISTING_PROPERTY_TYPE_OPTIONS)[number];
  }
  if (t === "Studio") return "Condo";
  if (t === "Villa") return "House";
  if (t === "Land") return "Lot";
  return "Condo";
}

const PRESALE_UNIT_TYPE_OPTIONS = ["Studio", "1BR", "2BR", "3BR", "4BR+"] as const;

const EDIT_LISTING_STATUSES = ["active", "under_offer", "sold", "off_market"] as const;

const DEFAULT_LISTING_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop";

function normalizeListingImageUrl(u: string): string {
  return u.trim().split("?")[0].replace(/\/$/, "");
}

type PropertyPhotoRow = {
  url: string;
  sort_order?: number | null;
  created_at?: string | null;
};

/** Ordered gallery for edit: [0] = main `image_url`; rest from `property_photos`, deduped. */
function buildEditListingImageUrls(
  imageUrl: string | null | undefined,
  photoRows: PropertyPhotoRow[],
): string[] {
  const sorted = [...photoRows].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  const urlsFromDb = sorted
    .map((r) => r.url?.trim())
    .filter((u): u is string => Boolean(u));

  const mainNorm = imageUrl?.trim() ? normalizeListingImageUrl(imageUrl.trim()) : "";
  const mainOriginal = imageUrl?.trim() || "";

  if (urlsFromDb.length > 0 && mainNorm) {
    const firstNorm = normalizeListingImageUrl(urlsFromDb[0]);
    if (firstNorm === mainNorm) {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const u of urlsFromDb) {
        const n = normalizeListingImageUrl(u);
        if (!seen.has(n)) {
          seen.add(n);
          out.push(u);
        }
      }
      return out.slice(0, 10);
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  if (mainOriginal) {
    out.push(mainOriginal);
    seen.add(normalizeListingImageUrl(mainOriginal));
  }
  for (const u of urlsFromDb) {
    const n = normalizeListingImageUrl(u);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(u);
    }
  }
  if (out.length === 0 && urlsFromDb.length > 0) {
    const seen2 = new Set<string>();
    const out2: string[] = [];
    for (const u of urlsFromDb) {
      const n = normalizeListingImageUrl(u);
      if (!seen2.has(n)) {
        seen2.add(n);
        out2.push(u);
      }
    }
    return out2.slice(0, 10);
  }
  return out.slice(0, 10);
}

function computeListingCompleteness(
  form: {
    location: string;
    name: string;
    price: string;
    rent_price?: string;
    listing_type?: "sale" | "rent" | "both";
    beds: string;
    baths: string;
    sqft: string;
    description: string;
    property_type: string;
  },
  imageUrls: string[],
) {
  const photosOk = imageUrls.filter((u) => u?.trim()).length >= 1;
  const priceOk =
    form.listing_type === "both"
      ? !validateListingPriceDisplay(form.price) && !validateListingPriceDisplay(form.rent_price ?? "")
      : !validateListingPriceDisplay(form.price);
  const locationOk = form.location.trim().length > 0;
  const typeOk = Boolean(form.property_type?.trim());
  const bedsBathsOk =
    !validateBedsBaths(form.beds, "Beds") && !validateBedsBaths(form.baths, "Baths");
  const requiredCount = [photosOk, priceOk, locationOk, typeOk, bedsBathsOk].filter(Boolean).length;
  const descWords = form.description.trim().split(/\s+/).filter(Boolean).length;
  const descRec = descWords >= 50;
  const titleRec = form.name.trim().length > 0;
  const sqftRec = !validateSqft(form.sqft);
  return {
    photosOk,
    priceOk,
    locationOk,
    typeOk,
    bedsBathsOk,
    requiredCount,
    requiredComplete: requiredCount === 5,
    descRec,
    titleRec,
    sqftRec,
  };
}

function ListingCompletenessAside({
  completeness,
}: {
  completeness: ReturnType<typeof computeListingCompleteness>;
}) {
  const c = completeness;
  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-52">
      <div className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Publishing checklist</p>
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#2C2C2C]/55">
            <span>Required</span>
            <span>
              {c.requiredCount}/5 required fields
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#6B9E6E] transition-all"
              style={{ width: `${(c.requiredCount / 5) * 100}%` }}
            />
          </div>
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Required</p>
        <ul className="mt-1 space-y-1.5">
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/85">
            {c.photosOk ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            )}
            <span>At least 1 photo</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/85">
            {c.priceOk ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            )}
            <span>Price</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/85">
            {c.locationOk ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            )}
            <span>Location</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/85">
            {c.typeOk ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            )}
            <span>Property type</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/85">
            {c.bedsBathsOk ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
            )}
            <span>Beds & baths</span>
          </li>
        </ul>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Recommended</p>
        <ul className="mt-1 space-y-1.5">
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/80">
            <span className="mt-0.5 shrink-0">{c.descRec ? "✅" : "⚠️"}</span>
            <span>Description (at least 50 words)</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/80">
            <span className="mt-0.5 shrink-0">{c.titleRec ? "✅" : "⚠️"}</span>
            <span>Property name / title</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/80">
            <span className="mt-0.5 shrink-0">{c.sqftRec ? "✅" : "⚠️"}</span>
            <span>Square footage</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}

const LANGUAGE_OPTIONS = ["English", "Filipino", "Mandarin", "Hokkien", "Spanish", "Bisaya", "Ilocano"] as const;
const SPECIALTY_OPTIONS = ["Luxury", "Condo", "House & Lot", "Commercial", "Rental", "Farm"] as const;

function propertyPriceToFormDisplay(price: PropertyRow["price"]): string {
  if (typeof price === "number" && Number.isFinite(price)) {
    return formatPriceInputDigits(String(Math.round(price)));
  }
  const n = parseListingPricePesos(String(price));
  if (n === null) return "";
  return formatPriceInputDigits(String(n));
}

function splitCsv(s: string | null | undefined): string[] {
  if (!s?.trim()) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitServiceAreas(s: string | null | undefined): string[] {
  if (!s?.trim()) return [];
  return s
    .split(/[;|\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function listingStatusForApi(isPresale: boolean, lt: EditListingForm["listing_type"]): "for_sale" | "for_rent" | "both" {
  if (isPresale) return "for_sale";
  if (lt === "both") return "both";
  if (lt === "rent") return "for_rent";
  return "for_sale";
}

function listingTypeColumnForApi(
  isPresale: boolean,
  lt: EditListingForm["listing_type"],
): "sale" | "rent" | "both" {
  if (isPresale) return "sale";
  return lt;
}

type EditListingForm = {
  name: string;
  location: string;
  price: string;
  rent_price: string;
  beds: string;
  baths: string;
  sqft: string;
  property_type: string;
  listing_type: "sale" | "rent" | "both";
  listing_status: "active" | "under_offer" | "sold" | "off_market";
  description: string;
  developer_name: string;
  turnover_date: string;
  unit_types: string[];
  pet_friendly: boolean;
  near_schools: boolean;
  family_friendly: boolean;
  formatted_address: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  /** Locality from Places (or prior DB city) for API `city` when saving. */
  placeCity: string | null;
  /** Region/province from Places for API `region` when saving. */
  placeRegion: string | null;
  /** Neighborhood/sublocality from Places for API `neighborhood` when saving. */
  placeNeighborhood: string | null;
};

/** UI labels → DB lead stages (existing check constraint). */
const LEAD_STAGE_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Viewing Scheduled", value: "viewing" },
  { label: "Closed", value: "closed_won" },
  { label: "Lost", value: "closed_lost" },
] as const;

function labelForStage(stage: string): string {
  return LEAD_STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? stage;
}

function editFormPriceString(price: PropertyRow["price"] | null | undefined): string {
  if (price === null || price === undefined) return "";
  if (typeof price === "number" && Number.isFinite(price)) return String(price);
  const s = String(price).trim();
  if (!s || s === "null" || s === "undefined") return "";
  return s;
}

function normalizeEditListingStatus(
  raw: PropertyRow["listing_status"] | string | null | undefined,
): EditListingForm["listing_status"] {
  const s = (raw ?? "").trim();
  if ((EDIT_LISTING_STATUSES as readonly string[]).includes(s)) {
    return s as EditListingForm["listing_status"];
  }
  return "active";
}

type DealDocumentListRow = {
  id: string;
  lead_id: number;
  document_type: string | null;
  file_name: string | null;
  status: string | null;
  created_at: string | null;
};

function AgentDashboardDocumentsTab({
  leads,
  supabase,
}: {
  leads: LeadRow[];
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
}) {
  const [rows, setRows] = useState<DealDocumentListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = leads.map((l) => l.id).filter((id): id is number => typeof id === "number");
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("deal_documents")
        .select("id, lead_id, document_type, file_name, status, created_at")
        .in("lead_id", ids)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as DealDocumentListRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leads, supabase]);

  const leadName = (leadId: number) => leads.find((l) => l.id === leadId)?.name ?? `Lead #${leadId}`;

  return (
    <div className="font-sans">
      <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">Documents</h2>
      <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
        Deal documents across your pipeline leads.
      </p>
      {loading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" aria-hidden />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-10 text-center text-sm font-semibold text-[#2C2C2C]/55">No documents yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4] text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#2C2C2C]/5 last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#2C2C2C]">{leadName(r.lead_id)}</td>
                  <td className="px-4 py-3 text-[#2C2C2C]/70">{r.document_type ?? "—"}</td>
                  <td className="px-4 py-3 text-[#2C2C2C]/70">{r.file_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#6B9E6E]/15 px-2.5 py-0.5 text-xs font-semibold text-[#2C2C2C]">
                      {r.status ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgentSidebarCalendarStrip({ setCalendarModalOpen }: { setCalendarModalOpen: (open: boolean) => void }) {
  const { viewings: agentViewings, isLoading: sidebarViewingsLoading } = useAgentViewings();
  const sidebarViewings = useMemo(() => {
    const stripTodayKey = manilaDateStringFromInstant(new Date());
    const endExclusive = manilaCalendarAddDays(stripTodayKey, 5);
    return agentViewings
      .filter((v) => v.dateKey >= stripTodayKey && v.dateKey < endExclusive)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }, [agentViewings]);

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center">
      <div className="w-full px-1">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setCalendarModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setCalendarModalOpen(true);
          }}
          className="rounded-xl border border-[#2C2C2C]/8 bg-white/70 p-2 shadow-sm cursor-pointer hover:bg-white"
          aria-label="Open calendar"
        >
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#6B9E6E]" aria-hidden />
            <p className="text-xs font-semibold text-[#2C2C2C]">Calendar</p>
          </div>

          {sidebarViewingsLoading ? (
            <p className="mt-2 text-[10px] font-semibold text-[#888888]">Loading…</p>
          ) : sidebarViewings.length === 0 ? (
            <p className="mt-2 text-[10px] font-semibold text-[#888888]">Nothing scheduled</p>
          ) : (
            <div className="mt-2 space-y-1">
              {(() => {
                const stripTodayKey = manilaDateStringFromInstant(new Date());
                return Array.from({ length: 5 }).map((_, i) => {
                  const cellKey = manilaCalendarAddDays(stripTodayKey, i);
                  const label =
                    i === 0 ? "Today" : `${manilaWeekdayShortFromYmd(cellKey)} ${manilaDayOfMonthFromYmd(cellKey)}`;
                  const items = sidebarViewings.filter((v) => v.dateKey === cellKey);
                  const isToday = i === 0;
                  const todaySub =
                    isToday && manilaMonthDayLabelFromInstant(new Date(`${stripTodayKey}T12:00:00+08:00`));
                  return (
                    <div
                      key={cellKey}
                      className={cn(
                        "flex items-start gap-2 rounded-md px-1.5 py-1",
                        isToday && "border-l-2 border-[#6B9E6E] bg-[#6B9E6E]/6",
                      )}
                    >
                      <div
                        className={cn(
                          "w-[46px] shrink-0 text-[10px] font-semibold leading-tight text-[#888888]",
                          isToday && "font-bold text-[#6B9E6E]",
                        )}
                      >
                        <span className="block">{i === 0 ? "Today" : label}</span>
                        {todaySub ? (
                          <span className="mt-0.5 block text-[9px] font-semibold text-[#6B9E6E]/80">{todaySub}</span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        {items.length === 0 ? (
                          <div className="text-[10px] font-semibold text-[#888888]/70">
                            {isToday ? "No viewings" : "—"}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {items.slice(0, 2).map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCalendarModalOpen(true);
                                }}
                                className="flex w-full min-w-0 items-center gap-1 rounded-sm px-0.5 py-0.5 text-left hover:bg-[#FAF8F4]"
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6B9E6E]" aria-hidden />
                                <span className="shrink-0 text-[10px] font-semibold text-[#2C2C2C]">
                                  {event.dayLabel} {event.timeLabel}
                                </span>
                                <span className="min-w-0 truncate text-[10px] font-semibold text-[#888888]">
                                  {event.propertyName}
                                </span>
                              </button>
                            ))}
                            {items.length > 2 ? (
                              <div className="text-[10px] font-semibold text-[#888888]">+{items.length - 2} more</div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQueryString = searchParams.toString();
  const { user, profile, loading: authLoading, role: authProfileRole } = useAuth();
  const streamMessagesUnreadTotal = useUnreadMessageCount();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const agentViewingsRefetchRef = useRef<(() => Promise<void>) | null>(null);

  const tab = useMemo(() => tabFromSearchParamsString(searchQueryString), [searchQueryString]);

  const navigateAgentTab = useCallback(
    (next: Tab) => {
      const sp = new URLSearchParams(searchQueryString);
      sp.set("tab", next);
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, router, searchQueryString],
  );

  const [streamChannelId, setStreamChannelId] = useState<string | null>(null);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [paymentBannerTier, setPaymentBannerTier] = useState<string | null>(null);
  /** Set from `?editProperty=` on /dashboard/agent; applied after listings load (see propertiesLoadVersion). */
  const pendingEditPropertyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const editProp = sp.get("editProperty");
      if (editProp) pendingEditPropertyIdRef.current = editProp;
      const ch = sp.get("channel");
      if (ch) setStreamChannelId(ch);

      if (sp.get("payment") === "success") {
        const tier = sp.get("tier");
        if (tier === "pro" || tier === "featured" || tier === "broker") {
          setPaymentBannerTier(tier);
        }
        sp.delete("payment");
        sp.delete("tier");
        const qs = sp.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      }
    }
  }, []);

  const { showAlert } = useGlobalAlert();
  const paymentAlertShownRef = useRef(false);
  useEffect(() => {
    if (!paymentBannerTier || paymentAlertShownRef.current) return;
    paymentAlertShownRef.current = true;
    const tier = normalizeListingTier(paymentBannerTier);
    showAlert(`🎉 Welcome to ${TIER_LABEL[tier]}! Your account has been upgraded.`, "success");
  }, [paymentBannerTier, showAlert]);

  const [loaded, setLoaded] = useState(false);
  /** Mirrors `profiles.role` for this session; drives team-member-only navigation. */
  const [sessionDashboardKind, setSessionDashboardKind] = useState<"agent" | "team_member">("agent");
  const [teamMemberSetupError, setTeamMemberSetupError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [viewingRequestMetaByLeadId, setViewingRequestMetaByLeadId] = useState<
    Record<number, ViewingRequestPipelineMeta>
  >({});
  const [archivedLeads, setArchivedLeads] = useState<LeadRow[]>([]);
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null);
  const [leavingPropertyId, setLeavingPropertyId] = useState<string | null>(null);
  const [profileViewsCount, setProfileViewsCount] = useState(0);
  const [pendingDealDocumentsCount, setPendingDealDocumentsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pipelineTabUnreadCount, setPipelineTabUnreadCount] = useState(0);
  const [yesterdayNewLeadsCount, setYesterdayNewLeadsCount] = useState(0);
  const [yesterdayPendingDocumentsCount, setYesterdayPendingDocumentsCount] = useState(0);
  const [yesterdayUnreadNotificationsCount, setYesterdayUnreadNotificationsCount] = useState(0);
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    bio: "",
    age: "",
    yearsExperience: "",
    languages: [] as string[],
    specialties: [] as string[],
    serviceAreaTags: [] as string[],
    serviceAreaDraft: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    website: "",
  });

  const [listingOpen, setListingOpen] = useState(false);
  const [listingLimitModalOpen, setListingLimitModalOpen] = useState(false);
  const [listingLimitModalKind, setListingLimitModalKind] = useState<"owned" | "coList">("owned");
  const [listingPublishDisclosureOpen, setListingPublishDisclosureOpen] = useState(false);
  const [editWarningOpen, setEditWarningOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [pendingEditProperty, setPendingEditProperty] = useState<PropertyRow | null>(null);
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditListingForm>({
    name: "",
    location: "",
    price: "",
    rent_price: "",
    beds: "2",
    baths: "2",
    sqft: "1,000",
    property_type: "Condo",
    listing_type: "sale",
    listing_status: "active",
    description: "",
    developer_name: "",
    turnover_date: "",
    unit_types: [],
    pet_friendly: false,
    near_schools: false,
    family_friendly: false,
    formatted_address: null,
    place_id: null,
    lat: null,
    lng: null,
    placeCity: null,
    placeRegion: null,
    placeNeighborhood: null,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editListingImages, setEditListingImages] = useState<string[]>([]);
  const [editGalleryReadOnly, setEditGalleryReadOnly] = useState(false);
  const [duplicateListingModal, setDuplicateListingModal] = useState<{
    existing: {
      id: string;
      name: string | null;
      location: string;
      agent_name: string;
      agent_id: string | null;
    };
  } | null>(null);
  const [duplicateCoListBusy, setDuplicateCoListBusy] = useState(false);
  const [listingForm, setListingForm] = useState({
    location: "",
    name: "",
    price: "",
    rent_price: "",
    beds: "2",
    baths: "2",
    sqft: "1000",
    description: "",
    listingImageUrls: [] as string[],
    property_type: "Condo",
    listing_type: "sale" as "sale" | "rent" | "both",
    developer_name: "",
    turnover_date: "",
    unit_types: [] as string[],
    source_url: null as string | null,
    source_hash: null as string | null,
    formatted_address: null as string | null,
    place_id: null as string | null,
    lat: null as number | null,
    lng: null as number | null,
    placeCity: null as string | null,
    placeRegion: null as string | null,
    placeNeighborhood: null as string | null,
    pet_friendly: false,
    near_schools: false,
    family_friendly: false,
  });
  const [listingFormErrors, setListingFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  const onEditListingLocationChange = useCallback((v: string) => {
    setEditForm((f) => ({
      ...f,
      location: v,
      formatted_address: null,
      place_id: null,
      lat: null,
      lng: null,
      placeCity: null,
      placeRegion: null,
      placeNeighborhood: null,
    }));
  }, []);

  const onEditListingPlaceSelected = useCallback((payload: GooglePlaceSelectedPayload) => {
    setEditForm((f) => ({
      ...f,
      location: payload.location,
      formatted_address: payload.formatted_address,
      place_id: payload.place_id,
      lat: payload.lat,
      lng: payload.lng,
      placeCity: payload.city,
      placeRegion: payload.region,
      placeNeighborhood: payload.neighborhood,
    }));
  }, []);

  const editListingCompleteness = useMemo(
    () => computeListingCompleteness(editForm, editListingImages),
    [editForm, editListingImages],
  );

  /** Bumps when a new edit open starts or the edit modal closes, so stale photo fetches cannot apply the wrong listing's images. */
  const editListingPhotosLoadIdRef = useRef(0);
  const [propertiesLoadVersion, setPropertiesLoadVersion] = useState(0);
  const sampleSeedAttemptedRef = useRef(false);
  const [removeSampleBusy, setRemoveSampleBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setTeamMemberSetupError(null);

    const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const accountRole = ((profileRow as { role?: string | null } | null)?.role ?? "").trim();
    setSessionDashboardKind(accountRole === "team_member" ? "team_member" : "agent");

    if (accountRole === "team_member") {
      const { data: tm, error: tmErr } = await supabase
        .from("team_members")
        .select("agent_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (tmErr || !(tm as { agent_id?: string } | null)?.agent_id) {
        setAgent(null);
        setLeads([]);
        setArchivedLeads([]);
        setViewingRequestMetaByLeadId({});
        setProperties([]);
        setViewings([]);
        setProfileViewsCount(0);
        setPendingDealDocumentsCount(0);
        setUnreadNotificationsCount(0);
        setPipelineTabUnreadCount(0);
        setYesterdayNewLeadsCount(0);
        setYesterdayPendingDocumentsCount(0);
        setYesterdayUnreadNotificationsCount(0);
        setPropertiesLoadVersion((v) => v + 1);
        setLoaded(true);
        setTeamMemberSetupError(tmErr?.message ?? "No active team assignment found.");
        return;
      }

      const agentTableId = (tm as { agent_id: string }).agent_id;
      const { data: a } = await supabase
        .from("agents")
        .select(
          "id, user_id, name, email, phone, bio, license_number, license_expiry, image_url, status, verified, broker_id, specialties, service_areas, social_links, age, years_experience, languages_spoken, response_time, closings, score, listing_tier, availability_schedule, availability, updated_at, verification_status",
        )
        .eq("id", agentTableId)
        .maybeSingle();
      setAgent((a as AgentRow | null) ?? null);
      setLoaded(true);
      if (!a) {
        setLeads([]);
        setArchivedLeads([]);
        setViewingRequestMetaByLeadId({});
        setProperties([]);
        setViewings([]);
        setProfileViewsCount(0);
        setPendingDealDocumentsCount(0);
        setUnreadNotificationsCount(0);
        setPipelineTabUnreadCount(0);
        setYesterdayNewLeadsCount(0);
        setYesterdayPendingDocumentsCount(0);
        setYesterdayUnreadNotificationsCount(0);
        setPropertiesLoadVersion((v) => v + 1);
        setTeamMemberSetupError("Supervising agent profile could not be loaded.");
        return;
      }

      if (a.status === "approved" && (a as AgentRow).verification_status === "verified") {
        const supervisorUserId = (a as AgentRow).user_id;
        const leadSel =
          "id, is_demo, name, email, phone, property_interest, message, stage, pipeline_stage, pipeline_position, pinned, pinned_at, closing_notes, property_id, viewing_request_id, created_at, updated_at, client_id, closed_date, closed_at, closed_by, closure_confirmed_by_client, new_lead_seen_at, new_viewing_request_seen_at";
        const leadSelArchived = `${leadSel}, archived_at, archive_reason, archive_note, stage_at_archive`;
        const [{ data: ld }, { data: ldArchived }, unreadRes, pipelineUnreadRes] = await Promise.all([
          supabase
            .from("leads")
            .select(leadSel)
            .eq("agent_id", supervisorUserId)
            .eq("archived_by_client", false)
            .order("created_at", { ascending: false }),
          supabase
            .from("leads")
            .select(leadSelArchived)
            .eq("agent_id", supervisorUserId)
            .eq("archived_by_client", true)
            .order("archived_at", { ascending: false })
            .limit(150),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("read_at", null),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("read_at", null)
            .in("type", [...AGENT_PIPELINE_TAB_NOTIFICATION_TYPES]),
        ]);
        const leadRows = (ld as LeadRow[]) ?? [];
        const archivedRows = ((ldArchived as LeadRow[]) ?? []) as LeadRow[];

        const clientIds = Array.from(
          new Set(
            [...leadRows, ...archivedRows]
              .map((l) => l.client_id)
              .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
          ),
        );

        let avatarByClientId = new Map<string, string | null>();
        if (clientIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, avatar_url")
            .in("id", clientIds);
          avatarByClientId = new Map(
            ((profiles ?? []) as { id: string; avatar_url: string | null }[]).map((p) => [p.id, p.avatar_url]),
          );
        }

        const leadRowsWithAvatar = leadRows.map((l) => ({
          ...l,
          client_avatar_url: avatarByClientId.get(l.client_id ?? "") ?? null,
        }));
        const archivedRowsWithAvatar = archivedRows.map((l) => ({
          ...l,
          client_avatar_url: avatarByClientId.get(l.client_id ?? "") ?? null,
        }));

        setLeads(leadRowsWithAvatar);
        setArchivedLeads(archivedRowsWithAvatar);
        setViewingRequestMetaByLeadId(await fetchViewingRequestMetaByLeadId(supabase, leadRowsWithAvatar));
        setUnreadNotificationsCount(unreadRes.error ? 0 : (unreadRes.count ?? 0));
        setPipelineTabUnreadCount(pipelineUnreadRes.error ? 0 : (pipelineUnreadRes.count ?? 0));
        setProperties([]);
        setViewings([]);
        setProfileViewsCount(0);

        const now = new Date();
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const startYesterday = new Date(startToday);
        startYesterday.setDate(startToday.getDate() - 1);
        const startTodayIso = startToday.toISOString();
        const startYesterdayIso = startYesterday.toISOString();

        const yLeadRes = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", supervisorUserId)
          .eq("archived_by_client", false)
          .gte("created_at", startYesterdayIso)
          .lt("created_at", startTodayIso);
        setYesterdayNewLeadsCount(yLeadRes.error ? 0 : (yLeadRes.count ?? 0));

        const leadIds = leadRows.map((l) => l.id).filter((id): id is number => typeof id === "number");
        if (leadIds.length === 0) {
          setPendingDealDocumentsCount(0);
          setYesterdayPendingDocumentsCount(0);
          setYesterdayUnreadNotificationsCount(0);
        } else {
          const ddRes = await supabase
            .from("deal_documents")
            .select("id", { count: "exact", head: true })
            .in("lead_id", leadIds)
            .eq("direction", "requested")
            .in("status", ["pending", "uploaded"]);
          setPendingDealDocumentsCount(ddRes.error ? 0 : (ddRes.count ?? 0));

          const yDocsRes = await supabase
            .from("deal_documents")
            .select("id", { count: "exact", head: true })
            .in("lead_id", leadIds)
            .eq("direction", "requested")
            .in("status", ["pending", "uploaded"])
            .gte("created_at", startYesterdayIso)
            .lt("created_at", startTodayIso);
          setYesterdayPendingDocumentsCount(yDocsRes.error ? 0 : (yDocsRes.count ?? 0));

          const yUnreadRes = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("read_at", null)
            .gte("created_at", startYesterdayIso)
            .lt("created_at", startTodayIso);
          setYesterdayUnreadNotificationsCount(yUnreadRes.error ? 0 : (yUnreadRes.count ?? 0));
        }
      } else {
        setLeads([]);
        setArchivedLeads([]);
        setViewingRequestMetaByLeadId({});
        setProperties([]);
        setViewings([]);
        setProfileViewsCount(0);
        setPendingDealDocumentsCount(0);
        setUnreadNotificationsCount(0);
        setPipelineTabUnreadCount(0);
        setYesterdayNewLeadsCount(0);
        setYesterdayPendingDocumentsCount(0);
        setYesterdayUnreadNotificationsCount(0);
      }
      setPropertiesLoadVersion((v) => v + 1);
      return;
    }

    const { data: a } = await supabase
      .from("agents")
      .select(
        "id, user_id, name, email, phone, bio, license_number, license_expiry, image_url, status, verified, broker_id, specialties, service_areas, social_links, age, years_experience, languages_spoken, response_time, closings, score, listing_tier, availability_schedule, availability, updated_at, verification_status",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    setAgent((a as AgentRow | null) ?? null);
    setLoaded(true);
    if (!a) {
      setLeads([]);
      setArchivedLeads([]);
      setViewingRequestMetaByLeadId({});
      setProperties([]);
      setViewings([]);
      setProfileViewsCount(0);
      setPendingDealDocumentsCount(0);
      setUnreadNotificationsCount(0);
      setPipelineTabUnreadCount(0);
      setYesterdayNewLeadsCount(0);
      setYesterdayPendingDocumentsCount(0);
      setYesterdayUnreadNotificationsCount(0);
      setPropertiesLoadVersion((v) => v + 1);
      return;
    }

    if (a.status === "approved" && (a as AgentRow).verification_status === "verified") {
      const leadSel =
        "id, is_demo, name, email, phone, property_interest, message, stage, pipeline_stage, pipeline_position, pinned, pinned_at, closing_notes, property_id, viewing_request_id, created_at, updated_at, client_id, closed_date, closed_at, closed_by, closure_confirmed_by_client, new_lead_seen_at, new_viewing_request_seen_at";
      const leadSelArchived = `${leadSel}, archived_at, archive_reason, archive_note, stage_at_archive`;
      const [{ data: ld }, { data: ldArchived }, { data: owned }, { data: paRows }, vwRes, viewsRes, unreadRes, pipelineUnreadRes] =
        await Promise.all([
        supabase
          .from("leads")
          .select(leadSel)
          .eq("agent_id", user.id)
          .eq("archived_by_client", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("leads")
          .select(leadSelArchived)
          .eq("agent_id", user.id)
          .eq("archived_by_client", true)
          .order("archived_at", { ascending: false })
          .limit(150),
        supabase
          .from("properties")
          .select(
            "id, name, location, city, price, rent_price, listing_type, image_url, status, beds, baths, sqft, description, property_type, listing_status, is_presale, developer_name, turnover_date, unit_types, expires_at, deleted_at, availability_state, listed_by, lat, lng, formatted_address, place_id, is_demo, pet_friendly, near_schools, family_friendly",
          )
          .eq("listed_by", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("property_agents").select("property_id").eq("agent_id", a.id),
        supabase
          .from("viewing_requests")
          .select("*")
          .eq("agent_user_id", user.id)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("activity_log")
          .select("id", { count: "exact", head: true })
          .eq("action", "profile_view")
          .eq("agent_id", a.id),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null)
          .in("type", [...AGENT_PIPELINE_TAB_NOTIFICATION_TYPES]),
      ]);
      const leadRows = (ld as LeadRow[]) ?? [];
      const archivedRows = ((ldArchived as LeadRow[]) ?? []) as LeadRow[];

      const clientIds = Array.from(
        new Set(
          [...leadRows, ...archivedRows]
            .map((l) => l.client_id)
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
        ),
      );

      let avatarByClientId = new Map<string, string | null>();
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", clientIds);
        avatarByClientId = new Map(
          ((profiles ?? []) as { id: string; avatar_url: string | null }[]).map((p) => [p.id, p.avatar_url]),
        );
      }

      const leadRowsWithAvatar = leadRows.map((l) => ({
        ...l,
        client_avatar_url: avatarByClientId.get(l.client_id ?? "") ?? null,
      }));
      const archivedRowsWithAvatar = archivedRows.map((l) => ({
        ...l,
        client_avatar_url: avatarByClientId.get(l.client_id ?? "") ?? null,
      }));

      setLeads(leadRowsWithAvatar);
      setArchivedLeads(archivedRowsWithAvatar);
      setViewingRequestMetaByLeadId(await fetchViewingRequestMetaByLeadId(supabase, leadRowsWithAvatar));
      setProfileViewsCount(viewsRes.error ? 0 : (viewsRes.count ?? 0));
      setUnreadNotificationsCount(unreadRes.error ? 0 : (unreadRes.count ?? 0));
      setPipelineTabUnreadCount(pipelineUnreadRes.error ? 0 : (pipelineUnreadRes.count ?? 0));

      const now = new Date();
      const startToday = new Date(now);
      startToday.setHours(0, 0, 0, 0);
      const startYesterday = new Date(startToday);
      startYesterday.setDate(startToday.getDate() - 1);
      const startTodayIso = startToday.toISOString();
      const startYesterdayIso = startYesterday.toISOString();

      // Leads yesterday (created_at between start/end of yesterday).
      const yLeadRes = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .eq("archived_by_client", false)
        .gte("created_at", startYesterdayIso)
        .lt("created_at", startTodayIso);
      setYesterdayNewLeadsCount(yLeadRes.error ? 0 : (yLeadRes.count ?? 0));

      // Deal documents: count pending docs across this agent's leads.
      const leadIds = leadRows.map((l) => l.id).filter((id): id is number => typeof id === "number");
      if (leadIds.length === 0) {
        setPendingDealDocumentsCount(0);
        setYesterdayPendingDocumentsCount(0);
        setYesterdayUnreadNotificationsCount(0);
      } else {
        const ddRes = await supabase
          .from("deal_documents")
          .select("id", { count: "exact", head: true })
          .in("lead_id", leadIds)
          .eq("direction", "requested")
          .in("status", ["pending", "uploaded"]);
        setPendingDealDocumentsCount(ddRes.error ? 0 : (ddRes.count ?? 0));

        const yDocsRes = await supabase
          .from("deal_documents")
          .select("id", { count: "exact", head: true })
          .in("lead_id", leadIds)
          .eq("direction", "requested")
          .in("status", ["pending", "uploaded"])
          .gte("created_at", startYesterdayIso)
          .lt("created_at", startTodayIso);
        setYesterdayPendingDocumentsCount(yDocsRes.error ? 0 : (yDocsRes.count ?? 0));

        const yUnreadRes = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null)
          .gte("created_at", startYesterdayIso)
          .lt("created_at", startTodayIso);
        setYesterdayUnreadNotificationsCount(yUnreadRes.error ? 0 : (yUnreadRes.count ?? 0));
      }

      const ownedList = ((owned ?? []) as Record<string, unknown>[]).map((raw) => {
        const p = raw as Record<string, unknown>;
        return {
          id: String(p.id),
          name: (p.name as string | null) ?? null,
          location: String(p.location ?? ""),
          price: p.price as string | number,
          rent_price: p.rent_price as string | number | null | undefined,
          listing_type: (p.listing_type as PropertyRow["listing_type"]) ?? null,
          image_url: String(p.image_url ?? ""),
          status: p.status as PropertyRow["status"],
          beds: typeof p.beds === "number" ? p.beds : Number(p.beds) || 0,
          baths: typeof p.baths === "number" ? p.baths : Number(p.baths) || 0,
          sqft: p.sqft != null ? String(p.sqft) : "",
          description: (p.description as string | null) ?? null,
          property_type: (p.property_type as string | null) ?? null,
          listing_status: (p.listing_status as PropertyRow["listing_status"]) ?? "active",
          is_presale: Boolean(p.is_presale),
          developer_name: (p.developer_name as string | null) ?? null,
          turnover_date: p.turnover_date != null ? String(p.turnover_date).slice(0, 10) : null,
          unit_types: Array.isArray(p.unit_types) ? (p.unit_types as string[]) : [],
          isCoHost: false as const,
          expires_at:
            p.expires_at != null && typeof p.expires_at === "string"
              ? p.expires_at
              : p.expires_at != null
                ? String(p.expires_at)
                : null,
          deleted_at:
            p.deleted_at != null && typeof p.deleted_at === "string"
              ? p.deleted_at
              : p.deleted_at != null
                ? String(p.deleted_at)
                : null,
          listed_by: (p.listed_by as string | null) ?? null,
          availability_state: (p.availability_state as string | null) ?? "available",
          city: (p.city as string | null) ?? null,
          lat: typeof p.lat === "number" ? p.lat : p.lat != null ? Number(p.lat) : null,
          lng: typeof p.lng === "number" ? p.lng : p.lng != null ? Number(p.lng) : null,
          formatted_address: (p.formatted_address as string | null) ?? null,
          place_id: (p.place_id as string | null) ?? null,
          is_demo: Boolean(p.is_demo),
          pet_friendly: Boolean(p.pet_friendly),
          near_schools: Boolean(p.near_schools),
          family_friendly: Boolean(p.family_friendly),
        };
      });
      const ownedIds = new Set(ownedList.map((p) => p.id));
      const coIds = [
        ...new Set((paRows ?? []).map((r) => (r as { property_id: string }).property_id)),
      ].filter((id) => !ownedIds.has(id));

      let cohosted: PropertyRow[] = [];
      if (coIds.length > 0) {
        const { data: co } = await supabase
          .from("properties")
          .select(
            "id, name, location, city, price, rent_price, listing_type, image_url, status, beds, baths, sqft, description, property_type, listing_status, is_presale, developer_name, turnover_date, unit_types, expires_at, deleted_at, availability_state, listed_by, lat, lng, formatted_address, place_id, is_demo, pet_friendly, near_schools, family_friendly",
          )
          .in("id", coIds)
          .order("created_at", { ascending: false });
        cohosted = ((co ?? []) as Record<string, unknown>[]).map((raw) => {
          const p = raw as Record<string, unknown>;
          return {
            id: String(p.id),
            name: (p.name as string | null) ?? null,
            location: String(p.location ?? ""),
            price: p.price as string | number,
            rent_price: p.rent_price as string | number | null | undefined,
            listing_type: (p.listing_type as PropertyRow["listing_type"]) ?? null,
            image_url: String(p.image_url ?? ""),
            status: p.status as PropertyRow["status"],
            beds: typeof p.beds === "number" ? p.beds : Number(p.beds) || 0,
            baths: typeof p.baths === "number" ? p.baths : Number(p.baths) || 0,
            sqft: p.sqft != null ? String(p.sqft) : "",
            description: (p.description as string | null) ?? null,
            property_type: (p.property_type as string | null) ?? null,
            listing_status: (p.listing_status as PropertyRow["listing_status"]) ?? "active",
            is_presale: Boolean(p.is_presale),
            developer_name: (p.developer_name as string | null) ?? null,
            turnover_date: p.turnover_date != null ? String(p.turnover_date).slice(0, 10) : null,
            unit_types: Array.isArray(p.unit_types) ? (p.unit_types as string[]) : [],
            isCoHost: true as const,
            expires_at:
              p.expires_at != null && typeof p.expires_at === "string"
                ? p.expires_at
                : p.expires_at != null
                  ? String(p.expires_at)
                  : null,
            deleted_at:
              p.deleted_at != null && typeof p.deleted_at === "string"
                ? p.deleted_at
                : p.deleted_at != null
                  ? String(p.deleted_at)
                  : null,
            listed_by: (p.listed_by as string | null) ?? null,
            availability_state: (p.availability_state as string | null) ?? "available",
            city: (p.city as string | null) ?? null,
            lat: typeof p.lat === "number" ? p.lat : p.lat != null ? Number(p.lat) : null,
            lng: typeof p.lng === "number" ? p.lng : p.lng != null ? Number(p.lng) : null,
            formatted_address: (p.formatted_address as string | null) ?? null,
            place_id: (p.place_id as string | null) ?? null,
            is_demo: Boolean(p.is_demo),
            pet_friendly: Boolean(p.pet_friendly),
            near_schools: Boolean(p.near_schools),
            family_friendly: Boolean(p.family_friendly),
          };
        });
      }

      const merged: PropertyRow[] = [
        ...ownedList.map((p) => ({ ...p, isCoHost: false })),
        ...cohosted,
      ];
      setProperties(merged);
      setViewings(vwRes.error ? [] : ((vwRes.data as ViewingRow[]) ?? []));
    } else {
      setLeads([]);
      setArchivedLeads([]);
      setViewingRequestMetaByLeadId({});
      setProperties([]);
      setViewings([]);
      setProfileViewsCount(0);
      setPendingDealDocumentsCount(0);
      setUnreadNotificationsCount(0);
      setPipelineTabUnreadCount(0);
      setYesterdayNewLeadsCount(0);
      setYesterdayPendingDocumentsCount(0);
      setYesterdayUnreadNotificationsCount(0);
    }
    setPropertiesLoadVersion((v) => v + 1);
  }, [supabase, user?.id]);

  const refreshAfterPipelineChange = useCallback(async () => {
    await loadData();
    await agentViewingsRefetchRef.current?.();
  }, [loadData]);

  useEffect(() => {
    if (authLoading || !user?.id || tab !== "pipeline") return;
    const refetch = () => {
      void refreshAfterPipelineChange();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authLoading, user?.id, tab, refreshAfterPipelineChange]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login?next=/dashboard/agent");
      return;
    }
    void loadData();
  }, [authLoading, user, router, loadData]);

  useEffect(() => {
    if (paymentBannerTier) {
      void loadData();
    }
  }, [paymentBannerTier, loadData]);

  const identityVerified = agent?.verification_status === "verified";
  const isTeamMemberView = sessionDashboardKind === "team_member";

  const hasTutorialDemoData = useMemo(
    () => properties.some((p) => p.is_demo) || leads.some((l) => Boolean(l.is_demo)),
    [properties, leads],
  );

  useEffect(() => {
    if (!loaded || isTeamMemberView) return;
    if (!identityVerified || !agent) return;
    if (profile?.tutorial_completed === true) return;
    if (properties.length > 0) return;
    if (propertiesLoadVersion <= 0) return;
    if (sampleSeedAttemptedRef.current) return;
    sampleSeedAttemptedRef.current = true;
    void (async () => {
      await fetch("/api/agent/seed-sample-data", { method: "POST", credentials: "include" }).catch(() => null);
      await loadData();
    })();
  }, [
    loaded,
    isTeamMemberView,
    identityVerified,
    agent,
    profile?.tutorial_completed,
    properties.length,
    propertiesLoadVersion,
    loadData,
  ]);

  const removeTutorialSampleData = useCallback(async () => {
    setRemoveSampleBusy(true);
    try {
      const res = await fetch("/api/agent/remove-sample-data", { method: "POST", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not remove sample data", { duration: 5000 });
        return;
      }
      router.refresh();
      await loadData();
    } finally {
      setRemoveSampleBusy(false);
    }
  }, [router, loadData]);

  useEffect(() => {
    if (!agent?.user_id || isTeamMemberView) return;
    const uid = agent.user_id;
    void (async () => {
      try {
        const res = await fetch("/api/v1/agent/recalculate-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid }),
        });
        const json = (await res.json()) as { success?: boolean; data?: { score: number } };
        if (json.success && json.data && typeof json.data.score === "number") {
          setAgent((prev) => (prev ? { ...prev, score: json.data!.score } : null));
        }
      } catch {
        /* score recalc is best-effort */
      }
    })();
  }, [agent?.user_id, isTeamMemberView]);

  useEffect(() => {
    if (!agent || isTeamMemberView) return;
    if (agent.verification_status !== "verified" && (tab === "pipeline" || tab === "listings")) {
      navigateAgentTab("overview");
    }
  }, [agent, tab, isTeamMemberView, navigateAgentTab]);

  useEffect(() => {
    if (!isTeamMemberView && tab === "documents") {
      navigateAgentTab("pipeline");
    }
  }, [isTeamMemberView, tab, navigateAgentTab]);

  useEffect(() => {
    if (!isTeamMemberView) return;
    const allowed: Tab[] = ["pipeline", "messages", "documents"];
    if (!allowed.includes(tab)) navigateAgentTab("pipeline");
  }, [isTeamMemberView, tab, navigateAgentTab]);

  useEffect(() => {
    if (!agent || authProfileRole === "team_member") return;
    const sl = (agent.social_links ?? {}) as Record<string, string>;
    const spec = splitCsv(agent.specialties);
    const langs = splitCsv(agent.languages_spoken);
    const specEffective = spec.length ? spec : splitCsv(DEFAULT_AGENT_SPECIALTIES_COMMAS);
    const langsEffective = langs.length ? langs : splitCsv(DEFAULT_AGENT_LANGUAGES_COMMAS);
    const areas = splitServiceAreas(agent.service_areas);
    setProfileForm({
      name: agent.name,
      phone: agent.phone ?? "",
      bio: agent.bio ?? "",
      age: agent.age != null ? String(agent.age) : "",
      yearsExperience: agent.years_experience != null ? String(agent.years_experience) : "",
      languages: langsEffective.filter((x) => (LANGUAGE_OPTIONS as readonly string[]).includes(x)),
      specialties: specEffective.filter((x) => (SPECIALTY_OPTIONS as readonly string[]).includes(x)),
      serviceAreaTags: areas,
      serviceAreaDraft: "",
      instagram: sl.instagram ?? "",
      facebook: sl.facebook ?? "",
      linkedin: sl.linkedin ?? "",
      website: sl.website ?? "",
    });
  }, [agent, authProfileRole]);

  const ownedListingCount = useMemo(
    () => properties.filter((p) => !p.isCoHost).length,
    [properties],
  );

  const listingLimit = useMemo(() => listingLimitForTier(agent?.listing_tier), [agent?.listing_tier]);
  const coListLimit = useMemo(() => coListLimitForTier(agent?.listing_tier), [agent?.listing_tier]);
  const coListedCount = useMemo(
    () => properties.filter((p) => p.isCoHost).length,
    [properties],
  );
  const atListingLimit =
    identityVerified &&
    !isUnlimitedOwned(agent?.listing_tier) &&
    ownedListingCount >= listingLimit;
  const atCoListLimit =
    identityVerified && !isUnlimitedCoList(agent?.listing_tier) && coListedCount >= coListLimit;

  const openNewListingFlow = () => {
    if (atListingLimit) {
      setListingLimitModalKind("owned");
      setListingLimitModalOpen(true);
      return;
    }
    setListingFormErrors({});
    setListingOpen(true);
  };

  useEffect(() => {
    if (authLoading || !user?.id || !agent?.id || isTeamMemberView) return;
    void fetch("/api/agent/check-listing-expiry-notifications", {
      method: "POST",
      credentials: "include",
    });
  }, [authLoading, user?.id, agent?.id, isTeamMemberView]);

  const profileComplete = useMemo(() => {
    if (!agent) return { pct: 0, checks: [] as { ok: boolean; label: string }[] };
    const checks = [
      { ok: !!agent.image_url?.trim(), label: "Profile photo" },
      { ok: !!(agent.bio && agent.bio.trim().length > 20), label: "Bio" },
      { ok: !!(agent.specialties && agent.specialties.trim().length > 0), label: "Specialties" },
      { ok: properties.length >= 1, label: "At least one listing" },
    ];
    const done = checks.filter((c) => c.ok).length;
    const pct = Math.round((done / checks.length) * 100);
    return { pct, checks };
  }, [agent, properties.length]);

  const pipelinePropertyLabel = useCallback(
    (propertyId: string | null) => {
      if (!propertyId) return "General inquiry";
      const p = properties.find((x) => x.id === propertyId);
      return (p?.name?.trim() || p?.location || "Property").trim() || "Property";
    },
    [properties],
  );

  const [calendarModalOpen, setCalendarModalOpen] = useState(false);

  const pipelineArchivedTabRows = useMemo(
    () =>
      archivedLeads.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        client_id: l.client_id ?? null,
        client_avatar_url: l.client_avatar_url ?? null,
        pipeline_stage: (l.pipeline_stage ?? "lead") as PipelineStageId,
        property_id: l.property_id ?? null,
        viewing_request_id: l.viewing_request_id ?? null,
        created_at: l.created_at,
        updated_at: l.updated_at ?? null,
        closed_date: l.closed_date ?? null,
        closed_at: l.closed_at ?? null,
        closed_by: l.closed_by ?? null,
        closure_confirmed_by_client: l.closure_confirmed_by_client ?? null,
        pipeline_position: l.pipeline_position ?? null,
        closing_notes: l.closing_notes ?? null,
        pinned: l.pinned ?? null,
        pinned_at: l.pinned_at ?? null,
        archived_at: l.archived_at ?? null,
        archive_reason: l.archive_reason ?? null,
        archive_note: l.archive_note ?? null,
        stage_at_archive: l.stage_at_archive ?? null,
      })),
    [archivedLeads],
  );

  const responseRatePct = useMemo(() => {
    const total = leads.length;
    if (total <= 0) return 0;
    const responded = leads.filter((l) => String(l.stage ?? "").trim().toLowerCase() !== "new").length;
    if (!Number.isFinite(responded) || responded <= 0) return 0;
    return Math.round((responded / total) * 100);
  }, [leads]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !agent) return;
    setSaving(true);
    const social_links = {
      instagram: profileForm.instagram.trim() || undefined,
      facebook: profileForm.facebook.trim() || undefined,
      linkedin: profileForm.linkedin.trim() || undefined,
      website: profileForm.website.trim() || undefined,
    };
    const ageN = profileForm.age.trim() ? Number.parseInt(profileForm.age.replace(/\D/g, ""), 10) : null;
    const yexpN = profileForm.yearsExperience.trim()
      ? Number.parseInt(profileForm.yearsExperience.replace(/\D/g, ""), 10)
      : null;
    const bioTrim = profileForm.bio.trim();
    if (bioTrim.length > 500) {
      setSaving(false);
      toast.error("Bio must be 500 characters or less.", { duration: 5000 });
      return;
    }
    const phTrim = profileForm.phone.trim();
    if (phTrim && isPhilippinePhoneMode(phTrim)) {
      const pe = validatePhilippinePhoneInput(phTrim);
      if (pe) {
        setSaving(false);
        toast.error(pe, { duration: 5000 });
        return;
      }
    }
    const { error } = await supabase
      .from("agents")
      .update({
        name: profileForm.name.trim(),
        phone: phTrim || null,
        bio: bioTrim || null,
        specialties: profileForm.specialties.length ? profileForm.specialties.join(", ") : null,
        service_areas: profileForm.serviceAreaTags.length ? profileForm.serviceAreaTags.join("; ") : null,
        languages_spoken: profileForm.languages.length ? profileForm.languages.join(", ") : null,
        age: ageN != null && Number.isFinite(ageN) && ageN >= 18 && ageN <= 80 ? ageN : null,
        years_experience:
          yexpN != null && Number.isFinite(yexpN) && yexpN >= 0 && yexpN <= 50 ? yexpN : null,
        social_links,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message, { duration: 5000 });
      return;
    }
    toast.success("Profile saved");
    await loadData();
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.id || !agent) return;
    setSaving(true);
    const v = validateAvatarFile(file);
    if (v) {
      setSaving(false);
      toast.error(v, { duration: 5000 });
      return;
    }

    try {
      const ext = avatarObjectExt(file);
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (upErr) {
        toast.error(upErr.message, { duration: 5000 });
        return;
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const busted = `${pub.publicUrl}?t=${Date.now()}`;

      const [{ error: profErr }, { error: agentErr }] = await Promise.all([
        supabase.from("profiles").update({ avatar_url: busted }).eq("id", user.id),
        supabase.from("agents").update({ image_url: busted }).eq("user_id", user.id),
      ]);
      if (profErr) throw profErr;
      if (agentErr) throw agentErr;

      toast.success("Photo updated");
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const updateLeadStage = async (leadId: number, stage: string) => {
    const { error } = await supabase.from("leads").update({ stage }).eq("id", leadId);
    if (error) {
      toast.error(error.message, { duration: 5000 });
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    setSelectedLead((s) => (s && s.id === leadId ? { ...s, stage } : s));
  };

  const deleteListing = async (propertyId: string) => {
    if (!user?.id) return;
    if (!confirm("Remove this listing from the public site? Your data is kept for records.")) return;
    setDeletingPropertyId(propertyId);
    try {
      const res = await fetch("/api/agent/delete-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ property_id: propertyId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        toast.error(json.error ?? `Could not delete listing (${res.status})`, { duration: 5000 });
        return;
      }
      if (!json.ok) {
        toast.error("Could not delete listing", { duration: 5000 });
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete listing", { duration: 5000 });
      return;
    } finally {
      setDeletingPropertyId(null);
    }
    toast.success("Listing removed from public site");
    await loadData();
  };

  const leaveListing = async (propertyId: string) => {
    if (!agent?.id) return;
    if (!confirm("Leave this co-listing? You will no longer appear on this property.")) return;
    setLeavingPropertyId(propertyId);
    const { error } = await supabase
      .from("property_agents")
      .delete()
      .eq("property_id", propertyId)
      .eq("agent_id", agent.id);
    setLeavingPropertyId(null);
    if (error) {
      toast.error(error.message, { duration: 5000 });
      return;
    }
    toast.success("You left the listing");
    await loadData();
  };

  const openEditFormFromProperty = useCallback(
    async (p: PropertyRow) => {
      const loadId = ++editListingPhotosLoadIdRef.current;
      const propertyId = p.id;
      try {
        const { data: photoRows, error: photoErr } = await supabase
          .from("property_photos")
          .select("id, url, sort_order, created_at, property_id")
          .eq("property_id", propertyId);
        if (loadId !== editListingPhotosLoadIdRef.current) return;
        if (photoErr) {
          toast.error("Could not load extra photos. Main image and other fields are still editable.");
        }
        const rowsForListing = (photoRows ?? []).filter(
          (row) => String((row as { property_id?: string }).property_id ?? "") === propertyId,
        );
        const ptRaw = (p.property_type ?? "").trim();
        const isPsListing = Boolean(p.is_presale) || ptRaw === "Presale";
        const safeType = isPsListing
          ? "Presale"
          : normalizeNewListingPropertyType(
              ptRaw === "Studio"
                ? "Condo"
                : ptRaw === "Villa"
                  ? "House"
                  : ptRaw === "Land"
                    ? "Lot"
                    : ptRaw,
            );
        const imageUrls = buildEditListingImageUrls(p.image_url, rowsForListing as PropertyPhotoRow[]);
        if (loadId !== editListingPhotosLoadIdRef.current) return;
        setEditPropertyId(propertyId);
        setEditFormErrors({});
        const lt: EditListingForm["listing_type"] =
          p.listing_type === "both" || p.status === "both"
            ? "both"
            : p.status === "for_rent"
              ? "rent"
              : "sale";
        setEditForm({
          name: p.name ?? "",
          location: p.location ?? "",
          price: propertyPriceToFormDisplay(p.price),
          rent_price: propertyPriceToFormDisplay(p.rent_price ?? ""),
          beds: formatDigitsOnly(String(p.beds ?? 0), 2),
          baths: formatDigitsOnly(String(p.baths ?? 0), 2),
          sqft: p.sqft != null ? formatDigitsOnly(String(p.sqft), 6) : "",
          property_type: safeType,
          listing_type: lt,
          listing_status: normalizeEditListingStatus(p.listing_status),
          description: p.description ?? "",
          developer_name: p.developer_name?.trim() ?? "",
          turnover_date: p.turnover_date ? String(p.turnover_date).slice(0, 10) : "",
          unit_types: Array.isArray(p.unit_types) ? [...p.unit_types] : [],
          formatted_address: p.formatted_address ?? null,
          place_id: p.place_id ?? null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          placeCity: p.city ?? null,
          placeRegion: (p as { region?: string | null }).region ?? null,
          placeNeighborhood: (p as { neighborhood?: string | null }).neighborhood ?? null,
          pet_friendly: Boolean(p.pet_friendly),
          near_schools: Boolean(p.near_schools),
          family_friendly: Boolean(p.family_friendly),
        });
        setEditListingImages(imageUrls);
        let galleryReadOnly = Boolean(user?.id && p.listed_by && p.listed_by !== user.id && p.isCoHost);
        if (!galleryReadOnly && user?.id && p.listed_by && p.listed_by !== user.id && agent?.id) {
          const { data: approvedCo } = await supabase
            .from("co_agent_requests")
            .select("id")
            .eq("property_id", propertyId)
            .eq("agent_id", agent.id)
            .eq("status", "approved")
            .maybeSingle();
          if (approvedCo) galleryReadOnly = true;
        }
        setEditGalleryReadOnly(galleryReadOnly);
        setEditFormOpen(true);
        setEditWarningOpen(false);
        setPendingEditProperty(null);
      } catch {
        toast.error("Could not open the edit form. Please try again.");
        setEditPropertyId(null);
        setEditListingImages([]);
      }
    },
    [supabase, user?.id, agent?.id],
  );

  useEffect(() => {
    if (!user?.id) return;
    const pending = pendingEditPropertyIdRef.current;
    if (!pending) return;
    if (propertiesLoadVersion === 0) return;
    const p = properties.find((x) => x.id === pending);
    if (p) {
      pendingEditPropertyIdRef.current = null;
      const sp = new URLSearchParams(searchQueryString);
      sp.delete("editProperty");
      sp.set("tab", "listings");
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      void openEditFormFromProperty(p);
      return;
    }
    pendingEditPropertyIdRef.current = null;
    const sp = new URLSearchParams(searchQueryString);
    if (sp.has("editProperty")) {
      sp.delete("editProperty");
      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [propertiesLoadVersion, properties, user?.id, openEditFormFromProperty, pathname, router, searchQueryString]);

  const beginEditListing = useCallback(
    async (p: PropertyRow) => {
      if (!agent) return;
      const { data: pa } = await supabase
        .from("property_agents")
        .select("agent_id")
        .eq("property_id", p.id);
      const others = (pa ?? []).filter((row) => (row as { agent_id: string }).agent_id !== agent.id);
      if (others.length > 0) {
        setPendingEditProperty(p);
        setEditWarningOpen(true);
      } else {
        openEditFormFromProperty(p);
      }
    },
    [agent, supabase, openEditFormFromProperty],
  );

  const saveEditListing = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editPropertyId) return;
      if (!computeListingCompleteness(editForm, editListingImages).requiredComplete) {
        toast.error("Complete required fields to publish");
        return;
      }
      setEditFormErrors({});
      const errs: Record<string, string> = {};
      const perr = validateListingPriceDisplay(editForm.price);
      if (perr) errs.price = perr;
      if (editForm.listing_type === "both") {
        const rerr = validateListingPriceDisplay(editForm.rent_price);
        if (rerr) errs.rent_price = rerr;
      }
      if (!editForm.location.trim()) errs.location = "Location is required.";
      const sqe = validateSqft(editForm.sqft);
      if (sqe) errs.sqft = sqe;
      const be = validateBedsBaths(editForm.beds, "Beds");
      if (be) errs.beds = be;
      const ba = validateBedsBaths(editForm.baths, "Baths");
      if (ba) errs.baths = ba;
      if (editForm.property_type === "Presale") {
        if (!editForm.developer_name.trim()) errs.developer_name = "Developer name is required.";
        if (!editForm.turnover_date.trim()) errs.turnover_date = "Expected turnover date is required.";
        if (editForm.unit_types.length === 0) errs.unit_types = "Select at least one unit type.";
      }
      if (Object.keys(errs).length > 0) {
        setEditFormErrors(errs);
        return;
      }
      setSavingEdit(true);
      try {
        const beds = Number(editForm.beds.replace(/\D/g, "")) || 0;
        const baths = Number(editForm.baths.replace(/\D/g, "")) || 0;
        const imageUrls =
          editListingImages.length > 0 ? editListingImages : [DEFAULT_LISTING_IMAGE];
        const isPs = editForm.property_type === "Presale";
        const lt = editForm.listing_type;
        const rentForApi =
          lt === "both"
            ? String(parseListingPricePesos(editForm.rent_price) ?? "")
            : lt === "rent"
              ? String(parseListingPricePesos(editForm.price) ?? "")
              : null;
        const body: Record<string, unknown> = {
          propertyId: editPropertyId,
          name: editForm.name.trim() || null,
          location: editForm.location.trim(),
          price: String(parseListingPricePesos(editForm.price) ?? ""),
          beds,
          baths,
          sqft: editForm.sqft.replace(/\D/g, ""),
          property_type: editForm.property_type,
          status: listingStatusForApi(isPs, lt),
          listing_type: listingTypeColumnForApi(isPs, lt),
          rent_price: rentForApi,
          listing_status: editForm.listing_status,
          description: editForm.description.trim() || null,
          is_presale: isPs,
          developer_name: isPs ? editForm.developer_name.trim() : null,
          turnover_date: isPs ? editForm.turnover_date.trim() : null,
          unit_types: isPs ? editForm.unit_types : [],
          lat: editForm.lat,
          lng: editForm.lng,
          formatted_address: editForm.formatted_address,
          place_id: editForm.place_id,
          city: editForm.placeCity,
          region: editForm.placeRegion,
          neighborhood: editForm.placeNeighborhood,
          pet_friendly: editForm.pet_friendly,
          near_schools: editForm.near_schools,
          family_friendly: editForm.family_friendly,
        };
        if (!editGalleryReadOnly) {
          body.imageUrls = imageUrls;
        }
        const res = await fetch("/api/agent/update-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          duplicate?: boolean;
          existing?: {
            id: string;
            name: string | null;
            location: string;
            agent_name: string;
            agent_id: string | null;
          };
          error?: { message?: string };
        };
        if (!res.ok) {
          toast.error(json?.error?.message ?? "Could not save listing.");
          return;
        }
        const warning = (json as { warning?: { type?: string; message?: string } } | null)?.warning;
        if (warning?.type === "possible_duplicate") {
          toast("Listing updated", {
            description:
              "We noticed a similar listing already exists. We've flagged this for review just in case — your changes are live.",
            duration: 6000,
          });
        } else {
          toast.success("Listing updated successfully");
        }
        setEditFormErrors({});
        editListingPhotosLoadIdRef.current += 1;
        setEditFormOpen(false);
        setEditPropertyId(null);
        setEditListingImages([]);
        setEditGalleryReadOnly(false);
        await loadData();
      } finally {
        setSavingEdit(false);
      }
    },
    [editPropertyId, editForm, editListingImages, editGalleryReadOnly, loadData],
  );

  const runCreateListingInsert = async () => {
    if (!user?.id) return;
    const priceNum = parseListingPricePesos(listingForm.price);
    setSaving(true);
    const trimmedLocation = listingForm.location.trim();
    const beds = Number(listingForm.beds.replace(/\D/g, "")) || 0;
    const baths = Number(listingForm.baths.replace(/\D/g, "")) || 0;
    const mainImageUrl = listingForm.listingImageUrls[0]?.trim() || DEFAULT_LISTING_IMAGE;
    const isPs = listingForm.property_type === "Presale";
    const lt = listingForm.listing_type;
    const rentNum = parseListingPricePesos(listingForm.rent_price);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const createBody = {
      name: listingForm.name.trim() || null,
      location: trimmedLocation,
      city: listingForm.placeCity,
      region: listingForm.placeRegion,
      neighborhood: listingForm.placeNeighborhood,
      formatted_address: listingForm.formatted_address,
      place_id: listingForm.place_id,
      lat: listingForm.lat,
      lng: listingForm.lng,
      price: priceNum != null ? String(priceNum) : "",
      listing_type: listingTypeColumnForApi(isPs, lt),
      rent_price:
        !isPs && lt === "both"
          ? rentNum != null
            ? String(rentNum)
            : null
          : !isPs && lt === "rent"
            ? priceNum != null
              ? String(priceNum)
              : null
            : null,
      sqft: listingForm.sqft.replace(/\D/g, ""),
      beds,
      baths,
      image_url: mainImageUrl,
      status: listingStatusForApi(isPs, lt),
      property_type: listingForm.property_type,
      pet_friendly: listingForm.pet_friendly,
      near_schools: listingForm.near_schools,
      family_friendly: listingForm.family_friendly,
      description: listingForm.description.trim() || null,
      is_presale: isPs,
      developer_name: isPs ? listingForm.developer_name.trim() : null,
      turnover_date: isPs ? listingForm.turnover_date.trim() : null,
      unit_types: isPs ? listingForm.unit_types : [],
      expires_at: expiresAt,
      expiry_notified_at: null,
      source_url: listingForm.source_url?.trim() || null,
      source_hash: listingForm.source_hash?.trim() || null,
    };
    const res = await fetch("/api/agent/create-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(createBody),
    });
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    setSaving(false);
    if (!res.ok) {
      const errObj = parsed as { error?: string } | null;
      const msg = typeof errObj?.error === "string" ? errObj.error : "Could not create listing.";
      if (/row-level security|violates row-level security policy/i.test(msg)) {
        setListingLimitModalKind("owned");
        setListingLimitModalOpen(true);
      } else {
        toast.error(msg, { duration: 5000 });
      }
      return;
    }
    const okJson = parsed as {
      ok?: boolean;
      id?: string;
      property_id?: string;
      warning?: { type?: string; message?: string };
    };
    const newId = okJson?.property_id ?? okJson?.id;
    if (!newId) {
      toast.error("Could not create listing.", { duration: 5000 });
      return;
    }
    if (listingForm.listingImageUrls.length > 1) {
      const extras = listingForm.listingImageUrls.slice(1).map((url, i) => ({
        property_id: newId,
        url,
        sort_order: i,
      }));
      const { error: phErr } = await supabase.from("property_photos").insert(extras);
      if (phErr) {
        toast.error(`Listing saved, but extra photos failed: ${phErr.message}`, { duration: 5000 });
      }
    }
    setListingOpen(false);
    setListingForm({
      location: "",
      name: "",
      price: "",
      rent_price: "",
      beds: "2",
      baths: "2",
      sqft: "1000",
      description: "",
      listingImageUrls: [],
      property_type: "Condo",
      listing_type: "sale",
      developer_name: "",
      turnover_date: "",
      unit_types: [],
      source_url: null,
      source_hash: null,
      formatted_address: null,
      place_id: null,
      lat: null,
      lng: null,
      placeCity: null,
      placeRegion: null,
      placeNeighborhood: null,
      pet_friendly: false,
      near_schools: false,
      family_friendly: false,
    });
    setListingFormErrors({});
    await loadData();
    if (okJson?.warning?.type === "possible_duplicate") {
      toast("Listing created", {
        description:
          "We noticed a similar listing already exists. We've flagged this for review just in case — your listing is live.",
        duration: 6000,
      });
    } else {
      toast.success("Listing created");
    }
    navigateAgentTab("listings");
  };

  const createListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!computeListingCompleteness(listingForm, listingForm.listingImageUrls).requiredComplete) {
      toast.error("Complete required fields to publish");
      return;
    }
    if (ownedListingCount >= listingLimit) {
      setListingOpen(false);
      setListingLimitModalKind("owned");
      setListingLimitModalOpen(true);
      return;
    }
    setListingFormErrors({});
    const errs: Record<string, string> = {};
    const pr = validateListingPriceDisplay(listingForm.price);
    if (pr) errs.price = pr;
    if (listingForm.listing_type === "both") {
      const rr = validateListingPriceDisplay(listingForm.rent_price);
      if (rr) errs.rent_price = rr;
    }
    if (!listingForm.location.trim()) errs.location = "Location is required.";
    const sqe = validateSqft(listingForm.sqft);
    if (sqe) errs.sqft = sqe;
    const be = validateBedsBaths(listingForm.beds, "Beds");
    if (be) errs.beds = be;
    const ba = validateBedsBaths(listingForm.baths, "Baths");
    if (ba) errs.baths = ba;
    if (listingForm.property_type === "Presale") {
      if (!listingForm.developer_name.trim()) errs.developer_name = "Developer name is required.";
      if (!listingForm.turnover_date.trim()) errs.turnover_date = "Expected turnover date is required.";
      if (listingForm.unit_types.length === 0) errs.unit_types = "Select at least one unit type.";
    }
    if (Object.keys(errs).length > 0) {
      setListingFormErrors(errs);
      return;
    }
    setListingPublishDisclosureOpen(true);
  };

  if (authLoading || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm font-semibold text-[#2C2C2C]/60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#6B9E6E]" />
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!agent) {
    if (isTeamMemberView && teamMemberSetupError) {
      return (
        <div className="min-h-screen bg-[#FAF8F4] px-4 py-16 font-sans">
          <div className="mx-auto max-w-lg rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Team dashboard</h1>
            <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/65">{teamMemberSetupError}</p>
            <p className="mt-3 text-sm text-[#2C2C2C]/55">
              Ask your supervising agent to send a new invite, or contact support if this persists.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#FAF8F4] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Agent dashboard</h1>
          <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
            No agent profile is linked to this account yet.
          </p>
          <Link
            href="/register/agent"
            className="mt-6 inline-flex rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
          >
            Become an Agent
          </Link>
        </div>
      </div>
    );
  }

  const allTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <House className="h-[18px] w-[18px]" /> },
    { id: "pipeline", label: "Pipeline", icon: <GitBranch className="h-[18px] w-[18px]" /> },
    { id: "messages", label: "Messages", icon: <MessageSquare className="h-[18px] w-[18px]" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
    { id: "listings", label: "Listings", icon: <LayoutList className="h-[18px] w-[18px]" /> },
    { id: "profile", label: "Public profile", icon: <UserCircle className="h-[18px] w-[18px]" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="h-[18px] w-[18px]" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="h-[18px] w-[18px]" /> },
  ];
  const teamMemberNavTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "pipeline", label: "Pipeline", icon: <GitBranch className="h-[18px] w-[18px]" /> },
    { id: "messages", label: "Messages", icon: <MessageSquare className="h-[18px] w-[18px]" /> },
    { id: "documents", label: "Documents", icon: <FileText className="h-[18px] w-[18px]" /> },
  ];
  const tabs = isTeamMemberView
    ? teamMemberNavTabs
    : identityVerified
      ? allTabs
      : allTabs.filter((t) => t.id !== "pipeline" && t.id !== "listings");

  const mobilePrimaryTabIds: Tab[] = isTeamMemberView
    ? ["pipeline", "messages", "documents"]
    : identityVerified
      ? ["pipeline", "messages"]
      : ["overview"];
  const mobileMoreTabIds: Tab[] = isTeamMemberView
    ? []
    : identityVerified
      ? ["overview", "profile", "listings", "analytics", "billing", "notifications"]
      : ["profile", "listings", "analytics", "billing", "notifications"];

  const viewingsAgentUserId = isTeamMemberView ? agent.user_id : user.id;

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-[calc(4rem+env(safe-area-inset-bottom))] md:flex md:h-[100dvh] md:max-h-[100dvh] md:flex-col md:overflow-hidden md:pb-0">
      {hasTutorialDemoData && !isTeamMemberView ? (
        <div
          role="note"
          className="flex shrink-0 items-center justify-between gap-3 border-l-4 border-[#D4A843] bg-[#D4A843]/10 px-3 py-3 text-sm font-semibold text-[#2C2C2C] md:px-4"
        >
          <div className="flex min-w-0 items-start gap-2">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#B8942E]" aria-hidden />
            <p className="min-w-0 leading-snug">These are sample listings to help you explore. Remove anytime.</p>
          </div>
          <button
            type="button"
            disabled={removeSampleBusy}
            onClick={() => void removeTutorialSampleData()}
            className="shrink-0 rounded-full border border-[#6B9E6E] bg-transparent px-3 py-1 text-xs font-bold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/10 disabled:opacity-50"
          >
            {removeSampleBusy ? "Removing…" : "Remove sample data"}
          </button>
        </div>
      ) : null}
      <AgentViewingsProvider
        agentUserId={viewingsAgentUserId}
        supabase={supabase}
        refetchRef={agentViewingsRefetchRef}
      >
      {/* Legacy PostLoginModal (agent-overview) — kept commented; agent onboarding uses AgentTourOverlay. */}
      <div className="flex w-full min-h-0 flex-1 flex-col md:flex-row md:overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          data-tour="agent-sidebar"
          className={cn(
            "hidden shrink-0 border-r border-[rgba(0,0,0,0.06)] bg-[#FAF8F4] md:sticky md:top-0 md:flex md:h-full md:max-h-full md:min-h-0 md:flex-col md:overflow-hidden md:px-2 md:py-5",
            tab === "messages" ? "w-[208px]" : "w-[180px]",
          )}
        >
          <div className="flex flex-col min-h-0">
            <div className="mb-5 flex items-center gap-2 px-1">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-[#D4A843]/35">
                {agent.image_url ? (
                  <SupabasePublicImage src={agent.image_url} alt="" fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/20 text-sm font-bold text-[#2C2C2C]">
                    {agent.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold leading-tight text-[#2C2C2C]">{agent.name}</p>
                <VerifiedAgentBadge show={agent.verification_status === "verified"} />
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              {!isTeamMemberView ? (
                tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigateAgentTab(t.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold transition",
                      t.id === "analytics" && "opacity-55 hover:opacity-80",
                      tab === t.id
                        ? "bg-[#6B9E6E]/15 text-[#2C2C2C] ring-1 ring-[#D4A843]/25"
                        : "text-[#2C2C2C]/65 hover:bg-white/80",
                    )}
                  >
                    <span className="relative inline-flex text-[#6B9E6E]">
                      {t.icon}
                      {t.id === "pipeline" && pipelineTabUnreadCount > 0 ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]"
                          aria-hidden
                        />
                      ) : null}
                      {t.id === "messages" && streamMessagesUnreadTotal > 0 ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]"
                          aria-hidden
                        />
                      ) : null}
                      {t.id === "notifications" && unreadNotificationsCount > 0 ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    {t.label}
                  </button>
                ))
              ) : (
                tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigateAgentTab(t.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold transition",
                      t.id === "analytics" && "opacity-55 hover:opacity-80",
                      tab === t.id
                        ? "bg-[#6B9E6E]/15 text-[#2C2C2C] ring-1 ring-[#D4A843]/25"
                        : "text-[#2C2C2C]/65 hover:bg-white/80",
                    )}
                  >
                    <span className="relative inline-flex text-[#6B9E6E]">
                      {t.icon}
                      {t.id === "pipeline" && streamMessagesUnreadTotal > 0 ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]"
                          aria-hidden
                        />
                      ) : null}
                      {t.id === "messages" && streamMessagesUnreadTotal > 0 ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    {t.label}
                  </button>
                ))
              )}
            </nav>
            {identityVerified && !isTeamMemberView ? <AgentTourSidebarHelp /> : null}
          </div>

          <AgentSidebarCalendarStrip setCalendarModalOpen={setCalendarModalOpen} />
          <div className="mt-3 px-2">
            <Link
              href={`/agents/${encodeURIComponent(agent.id)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center gap-2 rounded-xl border border-[#2C2C2C]/10 bg-white px-2.5 py-2 text-sm font-semibold text-[#2C2C2C]/70 transition hover:bg-[#FAF8F4]"
            >
              <span className="text-[#6B9E6E]">
                <ExternalLink className="h-[18px] w-[18px]" aria-hidden />
              </span>
              View public profile
            </Link>
          </div>
          <Link
            href="/"
            className="mt-auto px-2 py-2 text-sm font-semibold text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
          >
            ← Back to site
          </Link>
        </aside>

        <AgentCalendarModal open={calendarModalOpen} onClose={() => setCalendarModalOpen(false)} />

        <main
          className={cn(
            "min-w-0 flex-1 md:flex md:h-full md:min-h-0 md:flex-col",
            tab === "messages"
              ? "px-0 py-0 md:overflow-hidden md:px-0 md:py-0"
              : tab === "pipeline"
                ? "px-4 py-3 md:overflow-y-auto md:px-8 md:py-5 md:pb-5"
                : "px-4 py-6 md:overflow-y-auto md:px-8 md:py-10 md:pb-10",
          )}
        >
          {isTeamMemberView ? (
            <p className="mb-4 rounded-xl border border-[#6B9E6E]/35 bg-[#6B9E6E]/10 px-4 py-3 font-sans text-sm font-semibold text-[#2C2C2C]">
              You are logged in as a team member of {agent.name}.
            </p>
          ) : null}
          {null}

          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
              {tab === "overview" && (
                <OverviewTab
                  agent={agent}
                  accountApproved={agent.status === "approved"}
                  identityVerified={agent.verification_status === "verified"}
                  leads={leads}
                  properties={properties}
                  ownedListingCount={ownedListingCount}
                  coListedCount={coListedCount}
                  profileComplete={profileComplete}
                  unreadNotificationsCount={unreadNotificationsCount}
                  pendingDealDocumentsCount={pendingDealDocumentsCount}
                  yesterdayNewLeadsCount={yesterdayNewLeadsCount}
                  yesterdayPendingDocumentsCount={yesterdayPendingDocumentsCount}
                  yesterdayUnreadNotificationsCount={yesterdayUnreadNotificationsCount}
                  listingLimit={listingLimit}
                  coListLimit={coListLimit}
                  atListingLimit={atListingLimit}
                  atCoListLimit={atCoListLimit}
                  onNavigateTab={(next) => {
                    navigateAgentTab(next);
                    setMoreDrawerOpen(false);
                  }}
                />
              )}
              {tab === "pipeline" && (identityVerified || isTeamMemberView) && (
                <AgentPipelineTab
                  leads={leads.map((l) => ({
                    id: l.id,
                    name: l.name,
                    email: l.email,
                    client_id: l.client_id ?? null,
                    client_avatar_url: l.client_avatar_url ?? null,
                    pipeline_stage: (l.pipeline_stage ?? "lead") as PipelineStageId,
                    property_id: l.property_id ?? null,
                    viewing_request_id: l.viewing_request_id ?? null,
                    created_at: l.created_at,
                    updated_at: l.updated_at ?? null,
                    closed_date: l.closed_date ?? null,
                    closed_at: l.closed_at ?? null,
                    closed_by: l.closed_by ?? null,
                    closure_confirmed_by_client: l.closure_confirmed_by_client ?? null,
                    pipeline_position: l.pipeline_position ?? null,
                    closing_notes: l.closing_notes ?? null,
                    new_lead_seen_at: l.new_lead_seen_at ?? null,
                    new_viewing_request_seen_at: l.new_viewing_request_seen_at ?? null,
                  }))}
                  archivedLeads={pipelineArchivedTabRows}
                  propertyLabel={pipelinePropertyLabel}
                  supabase={supabase}
                  pipelineAgentId={agent.id}
                  leadsAgentUserId={isTeamMemberView ? agent.user_id : user.id}
                  messagingAgentUserId={isTeamMemberView ? null : user.id}
                  clientDocsSharedWithUserId={isTeamMemberView ? agent.user_id : undefined}
                  viewingRequestMetaByLeadId={viewingRequestMetaByLeadId}
                  onOpenMessagesForClient={(clientUserId) => {
                    if (!user?.id) return;
                    setStreamChannelId(streamDmChannelId(user.id, clientUserId));
                    navigateAgentTab("messages");
                  }}
                  onRefresh={refreshAfterPipelineChange}
                  onOpenLeadDetails={(leadId) => {
                    const row = [...leads, ...archivedLeads].find((x) => x.id === leadId);
                    if (row) setSelectedLead(row);
                  }}
                />
              )}
              {tab === "messages" && user && (
                <div
                  data-tour="messages-panel"
                  className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                >
                  <AgentMessagesInbox initialChannelId={streamChannelId} />
                </div>
              )}
              {tab === "documents" && isTeamMemberView && (
                <AgentDashboardDocumentsTab leads={leads} supabase={supabase} />
              )}
              {tab === "analytics" && (
                <AgentAnalyticsTab leads={leads} viewings={viewings} agent={agent} />
              )}
              {tab === "profile" && user && agent && !isTeamMemberView && (
                <ProfileTab
                  agent={agent}
                  listingTier={agent.listing_tier}
                  ownedListingCount={ownedListingCount}
                  responseRatePct={responseRatePct}
                  profileForm={profileForm}
                  setProfileForm={setProfileForm}
                  onSave={saveProfile}
                  saving={saving}
                  onUpload={uploadAvatar}
                  supabase={supabase}
                  userId={user.id}
                  onAvailabilitySaved={loadData}
                  onAvailabilityMessage={(msg) => {
                    if (!msg.trim()) return;
                    toast.success(msg);
                  }}
                />
              )}
              {tab === "listings" && identityVerified && (
                <ListingsTab
                  properties={properties}
                  ownedListingCount={ownedListingCount}
                  coListedCount={coListedCount}
                  listingOpen={listingOpen}
                  setListingOpen={(open) => {
                    setListingOpen(open);
                    if (!open) setListingFormErrors({});
                  }}
                  listingForm={listingForm}
                  setListingForm={setListingForm}
                  listingFormErrors={listingFormErrors}
                  onSubmit={createListing}
                  saving={saving}
                  listingLimit={listingLimit}
                  coListLimit={coListLimit}
                  onOpenNewListing={openNewListingFlow}
                  onDeleteProperty={deleteListing}
                  deletingPropertyId={deletingPropertyId}
                  onLeaveListing={leaveListing}
                  leavingPropertyId={leavingPropertyId}
                  onEditListing={beginEditListing}
                  userId={user.id}
                  canAddListing={agent?.verification_status === "verified"}
                  onListingRefresh={loadData}
                />
              )}
              {tab === "notifications" && user && (
                <AgentNotificationsTab userId={user.id} supabase={supabase} />
              )}
              {tab === "billing" && user && agent && (
                <AgentBillingTab
                  agentId={agent.id}
                  tier={agent.listing_tier}
                  supabase={supabase}
                  ownedListingCount={ownedListingCount}
                  coListedCount={coListedCount}
                  paymentBannerTier={paymentBannerTier}
                  onDismissPaymentBanner={() => setPaymentBannerTier(null)}
                />
              )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile bottom bar — Home, Pipeline/Messages (or team member set), More */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-0 border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => {
            setMoreDrawerOpen(false);
            router.push("/");
          }}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 text-[10px] font-bold text-[#2C2C2C]/45"
        >
          <span className="text-[#2C2C2C]/45">
            <House className="h-5 w-5" aria-hidden />
          </span>
          Home
        </button>
        {mobilePrimaryTabIds.map((tid) => {
          const t = tabs.find((x) => x.id === tid)!;
          const active = tab === tid;
          return (
            <button
              key={tid}
              type="button"
              onClick={() => {
                navigateAgentTab(tid);
                setMoreDrawerOpen(false);
              }}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 text-[10px] font-bold ${
                active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"
              }`}
            >
              {!isTeamMemberView && tid === "pipeline" && pipelineTabUnreadCount > 0 ? (
                <span
                  className="pointer-events-none absolute right-2 top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]/95"
                  aria-hidden
                />
              ) : null}
              {t.id === "messages" && streamMessagesUnreadTotal > 0 ? (
                <span
                  className="pointer-events-none absolute right-2 top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]/95"
                  aria-hidden
                />
              ) : null}
              <span className={active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>
                <span className="relative inline-flex">
                  <span className="inline-flex [&_svg]:h-5 [&_svg]:w-5">{t.icon}</span>
                  {isTeamMemberView && tid === "pipeline" && streamMessagesUnreadTotal > 0 ? (
                    <span
                      className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#6B9E6E] ring-[1.5px] ring-[#FAF8F4]/95"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </span>
              <span className="max-w-[4.5rem] truncate">{t.label}</span>
            </button>
          );
        })}
        {mobileMoreTabIds.length > 0 ? (
          <button
            type="button"
            onClick={() => setMoreDrawerOpen(true)}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 text-[10px] font-bold ${
              moreDrawerOpen || mobileMoreTabIds.includes(tab) ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"
            }`}
          >
            <span
              className={
                moreDrawerOpen || mobileMoreTabIds.includes(tab) ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"
              }
            >
              <MoreHorizontal className="h-5 w-5" />
            </span>
            More
          </button>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}
      </nav>

      <AnimatePresence>
        {moreDrawerOpen ? (
          <motion.div
            key="more-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[45] md:hidden"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={() => setMoreDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 380 }}
              className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-center text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">More</p>
              <div className="mx-auto mt-3 max-w-md space-y-1">
                {mobileMoreTabIds.map((tid) => {
                  const t = tabs.find((x) => x.id === tid)!;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        navigateAgentTab(t.id);
                        setMoreDrawerOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                        tab === t.id ? "bg-[#6B9E6E]/15 text-[#6B9E6E]" : "text-[#2C2C2C]/75 hover:bg-white/80"
                      }`}
                    >
                      <span className={tab === t.id ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>{t.icon}</span>
                      <span className="min-w-0 flex-1 text-left">{t.label}</span>
                      {tid === "notifications" && unreadNotificationsCount > 0 ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E]" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {listingLimitModalOpen ? (
          <ListingLimitUpgradeModal
            onClose={() => setListingLimitModalOpen(false)}
            limitKind={listingLimitModalKind}
            tier={agent.listing_tier}
            ownedLimit={listingLimit}
            coListLimit={coListLimit}
          />
        ) : null}
      </AnimatePresence>

      <Dialog
        open={duplicateListingModal != null}
        onOpenChange={(open) => {
          if (!open) setDuplicateListingModal(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>This property may already be listed</DialogTitle>
          </DialogHeader>
          {duplicateListingModal ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{duplicateListingModal.existing.agent_name}</span> is the
              primary agent for a listing at this location. You can request to co-list with them, or cancel and
              double-check the address.
            </p>
          ) : null}
          <DialogFooter className="sm:justify-end sm:gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
              onClick={() => setDuplicateListingModal(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={duplicateCoListBusy || !duplicateListingModal}
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#6B9E6E] px-4 text-sm font-semibold text-white shadow hover:bg-[#5d8a60] disabled:opacity-50"
              onClick={async () => {
                if (!duplicateListingModal || !user?.id) return;
                setDuplicateCoListBusy(true);
                try {
                  const { data: myAgent, error: agentLookupErr } = await supabase
                    .from("agents")
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();
                  if (agentLookupErr || !myAgent) {
                    toast.error("Could not resolve your agent profile.", { duration: 5000 });
                    return;
                  }
                  const agentId = (myAgent as { id: string }).id;
                  const { error: insErr } = await supabase.from("co_agent_requests").insert({
                    property_id: duplicateListingModal.existing.id,
                    agent_id: agentId,
                    status: "pending",
                  });
                  if (insErr) {
                    if (insErr.code === "23505") {
                      toast.success(`Co-list request sent to ${duplicateListingModal.existing.agent_name}`);
                      setDuplicateListingModal(null);
                      return;
                    }
                    toast.error(insErr.message, { duration: 5000 });
                    return;
                  }
                  toast.success(`Co-list request sent to ${duplicateListingModal.existing.agent_name}`);
                  setDuplicateListingModal(null);
                } finally {
                  setDuplicateCoListBusy(false);
                }
              }}
            >
              {duplicateCoListBusy ? "Sending…" : "Request co-list"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {listingPublishDisclosureOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => setListingPublishDisclosureOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-6 shadow-2xl"
            >
              <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Publish listing</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/75">
                By publishing this listing you confirm that the property information is accurate and complete, you are
                authorized to list this property on behalf of the owner, and you agree to BahayGo Terms of Service and
                listing guidelines. BahayGo is not responsible for inaccurate or fraudulent listings.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setListingPublishDisclosureOpen(false)}
                  className="flex-1 rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setListingPublishDisclosureOpen(false);
                    void runCreateListingInsert();
                  }}
                  className="flex-1 rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#6B9E6E]"
                >
                  I Agree and Publish
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editWarningOpen && pendingEditProperty ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onClick={() => {
              setEditWarningOpen(false);
              setPendingEditProperty(null);
            }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-6 shadow-2xl"
            >
              <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Edit Shared Listing</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/75">
                You are about to edit a listing that other agents may be connected to. All co-agents will be notified
                of your changes. Providing false or misleading information may result in account suspension. By continuing
                you confirm these changes are accurate.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditWarningOpen(false);
                    setPendingEditProperty(null);
                  }}
                  className="flex-1 rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void openEditFormFromProperty(pendingEditProperty);
                  }}
                  className="flex-1 rounded-full bg-[#D4A843] px-4 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
                >
                  I Understand, Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editFormOpen && editPropertyId ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => {
              editListingPhotosLoadIdRef.current += 1;
              setEditFormOpen(false);
              setEditPropertyId(null);
              setEditListingImages([]);
              setEditFormErrors({});
              setEditGalleryReadOnly(false);
            }}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onSubmit={saveEditListing}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Edit listing</h2>
                <button
                  type="button"
                  onClick={() => {
                    editListingPhotosLoadIdRef.current += 1;
                    setEditFormOpen(false);
                    setEditPropertyId(null);
                    setEditListingImages([]);
                    setEditFormErrors({});
                    setEditGalleryReadOnly(false);
                  }}
                  className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Property name
                  <input
                    value={editForm.name}
                    maxLength={60}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                  <p
                    className={`mt-0.5 text-xs ${
                      editForm.name.length >= 60
                        ? "text-red-600"
                        : editForm.name.length > 50
                          ? "text-orange-500"
                          : "text-gray-500"
                    }`}
                  >
                    {editForm.name.length}/60
                  </p>
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  {editForm.listing_type === "both"
                    ? "Sale price (₱)"
                    : editForm.listing_type === "rent"
                      ? "Monthly rent (₱)"
                      : "Price (₱)"}
                  <input
                    required
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, price: formatPriceInputDigits(e.target.value) }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                    placeholder="₱12,000,000"
                  />
                </label>
                {editFormErrors.price ? (
                  <p className="text-sm font-semibold text-red-600">{editFormErrors.price}</p>
                ) : null}
                {editForm.listing_type === "both" ? (
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Monthly rent (₱)
                    <input
                      required
                      value={editForm.rent_price}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          rent_price: formatPriceInputDigits(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                      placeholder="₱45,000"
                    />
                  </label>
                ) : null}
                {editFormErrors.rent_price ? (
                  <p className="text-sm font-semibold text-red-600">{editFormErrors.rent_price}</p>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Location
                  <GooglePlacesInput
                    required
                    value={editForm.location}
                    onChange={onEditListingLocationChange}
                    onPlaceSelected={onEditListingPlaceSelected}
                    placeholder="Search address or neighborhood…"
                    className="mt-1 w-full"
                    inputClassName="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                    addressMapPreview
                    mapPreviewInstanceId="agent-listing-edit-address-map"
                    mapPreviewCenter={
                      editForm.lat != null && editForm.lng != null
                        ? { lat: editForm.lat, lng: editForm.lng }
                        : null
                    }
                  />
                </label>
                {editFormErrors.location ? (
                  <p className="text-sm font-semibold text-red-600">{editFormErrors.location}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Beds
                    <input
                      inputMode="numeric"
                      value={editForm.beds}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          beds: formatDigitsOnly(e.target.value, 2),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Baths
                    <input
                      inputMode="numeric"
                      value={editForm.baths}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          baths: formatDigitsOnly(e.target.value, 2),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                    />
                  </label>
                </div>
                {editFormErrors.beds || editFormErrors.baths ? (
                  <p className="text-sm font-semibold text-red-600">
                    {[editFormErrors.beds, editFormErrors.baths].filter(Boolean).join(" ")}
                  </p>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Sqft
                  <input
                    inputMode="numeric"
                    value={editForm.sqft}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, sqft: formatDigitsOnly(e.target.value, 6) }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
                {editFormErrors.sqft ? (
                  <p className="text-sm font-semibold text-red-600">{editFormErrors.sqft}</p>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Property type
                  <select
                    required
                    value={editForm.property_type}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditForm((f) => ({
                        ...f,
                        property_type: v,
                        listing_type: v === "Presale" ? "sale" : f.listing_type,
                      }));
                    }}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  >
                    {listingPropertyTypeOptionsForEdit(editForm.property_type, editForm.property_type === "Presale").map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <div className="rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Features</p>
                  <div className="mt-2 space-y-2.5">
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-[#2C2C2C]">
                      <input
                        type="checkbox"
                        checked={editForm.pet_friendly}
                        onChange={(e) => setEditForm((f) => ({ ...f, pet_friendly: e.target.checked }))}
                        className="mt-0.5 rounded border-[#2C2C2C]/25"
                      />
                      <span>
                        Pet-friendly
                        <span className="mt-0.5 block text-[11px] font-medium text-[#2C2C2C]/50">
                          Suitable for tenants or buyers with pets.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-[#2C2C2C]">
                      <input
                        type="checkbox"
                        checked={editForm.near_schools}
                        onChange={(e) => setEditForm((f) => ({ ...f, near_schools: e.target.checked }))}
                        className="mt-0.5 rounded border-[#2C2C2C]/25"
                      />
                      <span>
                        Near schools
                        <span className="mt-0.5 block text-[11px] font-medium text-[#2C2C2C]/50">
                          Walking distance or short commute to schools.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-[#2C2C2C]">
                      <input
                        type="checkbox"
                        checked={editForm.family_friendly}
                        onChange={(e) => setEditForm((f) => ({ ...f, family_friendly: e.target.checked }))}
                        className="mt-0.5 rounded border-[#2C2C2C]/25"
                      />
                      <span>
                        Family-friendly
                        <span className="mt-0.5 block text-[11px] font-medium text-[#2C2C2C]/50">
                          3+ bedrooms or has a play area / family-oriented layout.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                {editForm.property_type === "Presale" ? (
                  <div className="space-y-3 rounded-xl border border-[#D4A843]/25 bg-[#FAF8F4]/80 p-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                      Developer name
                      <input
                        value={editForm.developer_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, developer_name: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                        required
                      />
                    </label>
                    {editFormErrors.developer_name ? (
                      <p className="text-sm font-semibold text-red-600">{editFormErrors.developer_name}</p>
                    ) : null}
                    <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                      Expected turnover date
                      <input
                        type="date"
                        value={editForm.turnover_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, turnover_date: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                        required
                      />
                    </label>
                    {editFormErrors.turnover_date ? (
                      <p className="text-sm font-semibold text-red-600">{editFormErrors.turnover_date}</p>
                    ) : null}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Unit types</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PRESALE_UNIT_TYPE_OPTIONS.map((u) => (
                          <label key={u} className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#2C2C2C]">
                            <input
                              type="checkbox"
                              checked={editForm.unit_types.includes(u)}
                              onChange={() =>
                                setEditForm((f) => ({
                                  ...f,
                                  unit_types: f.unit_types.includes(u)
                                    ? f.unit_types.filter((x) => x !== u)
                                    : [...f.unit_types, u],
                                }))
                              }
                              className="rounded border-[#2C2C2C]/20"
                            />
                            {u}
                          </label>
                        ))}
                      </div>
                    </div>
                    {editFormErrors.unit_types ? (
                      <p className="text-sm font-semibold text-red-600">{editFormErrors.unit_types}</p>
                    ) : null}
                  </div>
                ) : null}
                <div
                  className={`rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2 ${
                    editForm.property_type === "Presale" ? "opacity-50" : ""
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    For Sale / For Rent / Sale &amp; Rent
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={editForm.property_type === "Presale"}
                      onClick={() => setEditForm((f) => ({ ...f, listing_type: "sale" }))}
                      className={`rounded-full py-2 text-[11px] font-bold ${
                        editForm.listing_type === "sale"
                          ? "bg-[#6B9E6E] text-white"
                          : "bg-[#FAF8F4] text-[#2C2C2C]/45"
                      }`}
                    >
                      For Sale
                    </button>
                    <button
                      type="button"
                      disabled={editForm.property_type === "Presale"}
                      onClick={() => setEditForm((f) => ({ ...f, listing_type: "rent" }))}
                      className={`rounded-full py-2 text-[11px] font-bold ${
                        editForm.listing_type === "rent"
                          ? "bg-[#6B9E6E] text-white"
                          : "bg-[#FAF8F4] text-[#2C2C2C]/45"
                      }`}
                    >
                      For Rent
                    </button>
                    <button
                      type="button"
                      disabled={editForm.property_type === "Presale"}
                      onClick={() => setEditForm((f) => ({ ...f, listing_type: "both" }))}
                      className={`rounded-full py-2 text-[11px] font-bold leading-tight ${
                        editForm.listing_type === "both"
                          ? "bg-[#6B9E6E] text-white"
                          : "bg-[#FAF8F4] text-[#2C2C2C]/45"
                      }`}
                    >
                      Sale &amp; Rent
                    </button>
                  </div>
                </div>
                {editGalleryReadOnly ? (
                  <p className="rounded-lg border border-[#D4A843]/30 bg-[#FAF8F4] px-3 py-2 text-xs font-semibold text-[#2C2C2C]/70">
                    Only the primary agent can edit listing photos.
                  </p>
                ) : null}
                <CloudinaryUpload
                  value={editListingImages}
                  onUpload={setEditListingImages}
                  maxFiles={10}
                  disabled={savingEdit || editGalleryReadOnly}
                  disabledTooltip={
                    editGalleryReadOnly ? "Only the primary agent can edit listing photos." : undefined
                  }
                  listingPropertyId={editGalleryReadOnly ? undefined : (editPropertyId ?? undefined)}
                />
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Description
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Status
                  <select
                    value={editForm.listing_status}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        listing_status: e.target.value as EditListingForm["listing_status"],
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  >
                    <option value="active">Active</option>
                    <option value="under_offer">Under Offer</option>
                    <option value="sold">Sold</option>
                    <option value="off_market">Off Market</option>
                  </select>
                </label>
                </div>
                <ListingCompletenessAside completeness={editListingCompleteness} />
              </div>
              <button
                type="submit"
                disabled={savingEdit || !editListingCompleteness.requiredComplete}
                title={
                  !editListingCompleteness.requiredComplete
                    ? "Complete required fields to publish"
                    : undefined
                }
                className="mt-6 w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLead && user ? (
          <AgentLeadSlideOver
            lead={selectedLead}
            agentUserId={user.id}
            agentAvatarUrl={agent.image_url}
            agentName={agent.name}
            onClose={() => setSelectedLead(null)}
            onStageChange={updateLeadStage}
          />
        ) : null}
      </AnimatePresence>
      </AgentViewingsProvider>
    </div>
  );
}

function OverviewTab({
  agent,
  accountApproved,
  identityVerified,
  leads,
  properties,
  ownedListingCount,
  coListedCount,
  profileComplete,
  unreadNotificationsCount,
  pendingDealDocumentsCount,
  yesterdayNewLeadsCount,
  yesterdayPendingDocumentsCount,
  yesterdayUnreadNotificationsCount,
  listingLimit,
  coListLimit,
  atListingLimit,
  atCoListLimit,
  onNavigateTab,
}: {
  agent: AgentRow;
  accountApproved: boolean;
  identityVerified: boolean;
  leads: LeadRow[];
  properties: PropertyRow[];
  ownedListingCount: number;
  coListedCount: number;
  profileComplete: { pct: number; checks: { ok: boolean; label: string }[] };
  unreadNotificationsCount: number;
  pendingDealDocumentsCount: number;
  yesterdayNewLeadsCount: number;
  yesterdayPendingDocumentsCount: number;
  yesterdayUnreadNotificationsCount: number;
  listingLimit: number;
  coListLimit: number;
  atListingLimit: boolean;
  atCoListLimit: boolean;
  onNavigateTab: (tab: Tab) => void;
}) {
  const firstName = useMemo(() => {
    const t = (agent.name ?? "").trim();
    if (!t) return "there";
    return t.split(/\s+/)[0] ?? "there";
  }, [agent.name]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }, []);

  const agentScoreOutOfTen = useMemo(() => {
    const s = agent.score;
    return typeof s === "number" && Number.isFinite(s) ? Math.max(0, Math.min(10, s)) : 0;
  }, [agent.score]);

  const ring = useMemo(() => {
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.max(0, Math.min(1, agentScoreOutOfTen / 10));
    return {
      radius,
      circumference,
      dashOffset: circumference * (1 - pct),
    };
  }, [agentScoreOutOfTen]);

  const listingsCount = useMemo(() => properties.length, [properties.length]);

  const hasUnrespondedLeadsOver24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return leads.some((l) => {
      const stage = String(l.stage ?? "").trim().toLowerCase();
      if (stage !== "new") return false;
      const t = new Date(l.created_at).getTime();
      return Number.isFinite(t) && t < cutoff;
    });
  }, [leads]);

  const actionItems = useMemo(() => {
    const items: { label: string; tab: Tab }[] = [];
    const closings = typeof agent.closings === "number" && Number.isFinite(agent.closings) ? agent.closings : 0;
    const verified = agent.verification_status === "verified";
    const profilePct = profileComplete.pct ?? 0;

    if (closings === 0) items.push({ label: "Close your first deal to boost your score", tab: "pipeline" });
    if (!verified) items.push({ label: "Complete PRC verification", tab: "overview" });
    if (profilePct < 100) items.push({ label: "Complete your profile", tab: "profile" });
    if (listingsCount < 3) items.push({ label: "Add more listings to increase visibility", tab: "listings" });
    if (hasUnrespondedLeadsOver24h) items.push({ label: "You have unresponded leads", tab: "pipeline" });

    return items.slice(0, 3);
  }, [agent.closings, agent.verification_status, profileComplete.pct, listingsCount, hasUnrespondedLeadsOver24h]);

  const newLeadsToday = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    return leads.filter((l) => {
      const t = new Date(l.created_at);
      return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    }).length;
  }, [leads]);

  const renderMomentum = useCallback((delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) {
      return <span className="text-gray-400">same as yesterday</span>;
    }
    if (delta > 0) {
      return <span className="font-bold text-[#6B9E6E]">↑ +{delta} from yesterday</span>;
    }
    return <span className="font-bold text-red-600">↓ {delta} from yesterday</span>;
  }, []);

  const actionsAwayFromFive = useMemo(() => {
    if (agentScoreOutOfTen >= 5) return 0;
    const need = 5 - agentScoreOutOfTen;
    const pts = [1.5, 0.8, 0.5, 0.3].slice().sort((a, b) => b - a);
    let remaining = need;
    let n = 0;
    for (const p of pts) {
      while (remaining > 1e-9 && remaining - p > -1e-9) {
        remaining -= p;
        n += 1;
        if (n > 99) return 99;
      }
      if (remaining <= 1e-9) break;
    }
    // If still not reached (e.g. score is fractional and smaller steps required), pad with smallest action.
    if (remaining > 1e-9) {
      n += Math.ceil(remaining / 0.3);
    }
    return Math.max(1, n);
  }, [agentScoreOutOfTen]);

  const pipelineSnapshot = useMemo(() => {
    const active = leads
      .filter((l) => String(l.stage ?? "").trim().toLowerCase() !== "declined")
      .filter((l) => String(l.pipeline_stage ?? "lead").trim().toLowerCase() !== "closed")
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return active.slice(0, 2);
  }, [leads]);

  const propertyLabelForLead = useCallback(
    (l: LeadRow): string => {
      const explicit = (l.property_interest ?? "").trim();
      if (explicit) return explicit;
      const pid = l.property_id;
      if (pid) {
        const p = properties.find((x) => x.id === pid);
        if (p) return (p.name?.trim() || p.location || "Property").trim();
      }
      return "Property";
    },
    [properties],
  );

  const phpPriceLabelForLead = useCallback(
    (l: LeadRow): string | null => {
      const pid = l.property_id;
      if (!pid) return null;
      const p = properties.find((x) => x.id === pid);
      if (!p) return null;
      const raw = (p as unknown as { price?: unknown }).price;
      const n =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(String(raw).replace(/[^\d.]/g, ""))
            : Number.NaN;
      if (!Number.isFinite(n) || n <= 0) return null;
      try {
        return new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP",
          maximumFractionDigits: 0,
        }).format(n);
      } catch {
        return `₱${Math.round(n).toLocaleString()}`;
      }
    },
    [properties],
  );

  const pipelineStageBadgeClass = useCallback((raw: string | null | undefined): string => {
    const s = String(raw ?? "lead").trim().toLowerCase();
    if (s === "viewing") return "bg-purple-50 text-purple-700";
    if (s === "offer") return "bg-yellow-50 text-yellow-700";
    return "bg-blue-50 text-blue-700";
  }, []);

  const nextStepLabel = useCallback((raw: string | null | undefined): string => {
    const s = String(raw ?? "lead").trim().toLowerCase();
    if (s === "viewing") return "Prepare viewing documents";
    if (s === "offer") return "Send contract";
    if (s === "reservation") return "Confirm reservation details";
    return "Follow up with client";
  }, []);

  const stageIcon = useCallback((raw: string | null | undefined) => {
    const s = String(raw ?? "lead").trim().toLowerCase();
    if (s === "viewing") return <Eye className="h-3 w-3" aria-hidden />;
    if (s === "offer") return <FileText className="h-3 w-3" aria-hidden />;
    if (s === "declined") return <X className="h-3 w-3" aria-hidden />;
    return <User className="h-3 w-3" aria-hidden />;
  }, []);

  const pipelineProgressPct = useCallback((raw: string | null | undefined): number => {
    const s = String(raw ?? "lead").trim().toLowerCase();
    if (s === "viewing") return 40;
    if (s === "offer") return 60;
    if (s === "reservation") return 80;
    if (s === "closed") return 100;
    return 20;
  }, []);

  const formatRelative = useCallback((iso: string | null | undefined): string => {
    const t = iso ? new Date(iso).getTime() : Number.NaN;
    if (!Number.isFinite(t)) return "—";
    const ms = Date.now() - t;
    const min = Math.max(0, Math.floor(ms / (60 * 1000)));
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const day = Math.floor(hr / 24);
    return `${day} day${day === 1 ? "" : "s"} ago`;
  }, []);

  return (
    <div>
      {/* Top motivator bar */}
      {agentScoreOutOfTen < 5 ? (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-8 rounded-2xl bg-[#6B9E6E] px-5 py-3 text-sm font-medium text-white"
        >
          You are {actionsAwayFromFive} actions away from reaching 5.0
        </motion.div>
      ) : null}

      {/* Section 1 - Daily Briefing Header */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mb-8"
      >
        <p className="text-sm font-semibold text-[#2C2C2C]">{greeting},</p>
        <h1 className="mt-1 font-serif text-[32px] font-bold leading-tight text-[#2C2C2C]">{firstName}</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]">{todayLabel}</p>
      </motion.section>

      {/* Section 2 - Agent Score Ring */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="mb-10 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 140 140" className="h-40 w-40">
                <circle
                  cx="70"
                  cy="70"
                  r={ring.radius}
                  stroke="#E5E5E5"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={ring.radius}
                  stroke="#6B9E6E"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={ring.circumference}
                  strokeDashoffset={ring.dashOffset}
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-serif text-4xl font-bold text-[#2C2C2C]">{agentScoreOutOfTen.toFixed(1)}</p>
                <p className="mt-1 text-xs font-semibold text-gray-500">/ 10</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Agent Score</p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Score breakdown</p>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-3 rounded-2xl border border-[#6B9E6E] bg-[#F0F7F0] px-4 py-3 shadow-sm">
                <span className="rounded-full bg-[#6B9E6E] px-2 py-0.5 text-xs font-bold text-white">+1.5 pts</span>
                <span className="text-sm font-semibold text-[#2C2C2C]">— Close a deal</span>
                <span className="ml-auto rounded-full bg-[#D4A843] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Fastest way
                </span>
              </div>
              {[
                { pts: "+0.8 pts", label: "Respond within 5 mins" },
                { pts: "+0.5 pts", label: "Complete your profile" },
                { pts: "+0.3 pts", label: "Add more listings" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="rounded-full bg-[#6B9E6E] px-2 py-0.5 text-xs font-bold text-white">
                    {row.pts}
                  </span>
                  <span className="text-sm font-semibold text-[#2C2C2C]">— {row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Section 3 - Today at a Glance */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="mb-8"
      >
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Today at a glance</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-full border border-[#6B9E6E33] bg-[#F0F7F0] px-4 py-2 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-2 text-[#4A7C4E]">
              <Users className="h-4 w-4" aria-hidden />
              <span className="text-lg font-bold tabular-nums">{newLeadsToday}</span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#4A7C4E]">New Leads today</p>
            <p className="mt-0.5 text-xs">{renderMomentum(newLeadsToday - (yesterdayNewLeadsCount || 0))}</p>
          </div>
          <div className="rounded-full border border-[#D4A84333] bg-[#FDF8EE] px-4 py-2 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-2 text-[#A07830]">
              <FileText className="h-4 w-4" aria-hidden />
              <span className="text-lg font-bold tabular-nums">{pendingDealDocumentsCount}</span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#A07830]">Pending Documents</p>
            <p className="mt-0.5 text-xs">
              {renderMomentum(pendingDealDocumentsCount - (yesterdayPendingDocumentsCount || 0))}
            </p>
          </div>
          <div className="rounded-full border border-[#D4A84333] bg-[#FDF8EE] px-4 py-2 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-2 text-[#A07830]">
              <Bell className="h-4 w-4" aria-hidden />
              <span className="text-lg font-bold tabular-nums">{unreadNotificationsCount}</span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#A07830]">Unread Notifications</p>
            <p className="mt-0.5 text-xs">
              {renderMomentum(unreadNotificationsCount - (yesterdayUnreadNotificationsCount || 0))}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Section 4 - Pipeline Snapshot */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.4 }}
        className="mb-8 space-y-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pipeline Snapshot</p>
          <button
            type="button"
            onClick={() => onNavigateTab("pipeline")}
            className="text-sm font-semibold text-[#6B9E6E] hover:underline"
          >
            Manage Deals →
          </button>
        </div>
        {pipelineSnapshot.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">No active leads yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pipelineSnapshot.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onNavigateTab("pipeline")}
                className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#2C2C2C]">{l.name}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">
                      {propertyLabelForLead(l)}
                    </p>
                    {phpPriceLabelForLead(l) ? (
                      <p className="mt-1 text-xs font-semibold text-[#D4A843]">{phpPriceLabelForLead(l)}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold text-gray-400">
                      Last activity {formatRelative(l.updated_at ?? l.created_at)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#6B9E6E]">
                      Next step: {nextStepLabel(l.pipeline_stage)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
                      pipelineStageBadgeClass(l.pipeline_stage),
                    )}
                  >
                    {stageIcon(l.pipeline_stage)}
                    {String(l.pipeline_stage ?? "lead").trim() || "lead"}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#E5E5E5]">
                  <div
                    className="h-2 rounded-full bg-[#6B9E6E] animate-pulse"
                    style={{ width: `${pipelineProgressPct(l.pipeline_stage)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.section>

      {/* Section 5 - Score History Chart */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.5 }}
        className="mb-8"
      >
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">YOUR SCORE OVER TIME</p>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(() => {
                  const now = new Date();
                  const months: { label: string; score: number }[] = [];
                  for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const label = d.toLocaleDateString(undefined, { month: "short" });
                    const score = Math.max(0, Number((agentScoreOutOfTen - 0.3 * i).toFixed(1)));
                    months.push({ label, score });
                  }
                  return months;
                })()}
                margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#6B6B6B", fontWeight: 600 }}
                />
                <Bar dataKey="score" fill="#6B9E6E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Your score increases when you close deals, respond fast, and stay active.
          </p>
        </div>
      </motion.section>

      {/* Section 6 - Agent Profile Preview Card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.6 }}
        className="mb-8"
      >
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">HOW CLIENTS SEE YOU</p>
        <div className="max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-black/10">
              {agent.image_url ? (
                <SupabasePublicImage src={agent.image_url} alt="" fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/20 text-lg font-bold text-[#2C2C2C]/60">
                  {(agent.name?.trim() || "A").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-lg font-semibold text-[#2C2C2C]">{agent.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <VerifiedAgentBadge show={agent.verification_status === "verified"} />
                <span className="text-xs font-semibold text-[#2C2C2C]/60">
                  {agentScoreOutOfTen.toFixed(1)} out of 10
                </span>
              </div>
            </div>
          </div>

          {splitCsv(agent.specialties).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {splitCsv(agent.specialties)
                .slice(0, 6)
                .map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70"
                  >
                    {s}
                  </span>
                ))}
            </div>
          ) : null}

          {splitServiceAreas(agent.service_areas).length > 0 ? (
            <p className="mt-4 text-sm font-semibold text-[#2C2C2C]/55">
              {splitServiceAreas(agent.service_areas).slice(0, 2).join(" · ")}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab("overview")}
          className="mt-4 rounded-full border border-[#6B9E6E] px-5 py-2 text-sm font-medium text-[#6B9E6E] transition hover:bg-[#6B9E6E] hover:text-white"
        >
          Improve your profile
        </button>
      </motion.section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-[#2C2C2C]">{value}</p>
      {hint ? <p className="mt-1 text-[10px] font-semibold text-[#D4A843]">{hint}</p> : null}
    </div>
  );
}

function propertyExpiryBadgeInfo(expiresAt: string | null | undefined): {
  label: string;
  className: string;
  showRenew: boolean;
} | null {
  if (expiresAt == null || String(expiresAt).trim() === "") return null;
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return null;
  const now = Date.now();
  const daysLeft = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
  if (end < now) {
    return { label: "Expired - Renew now", className: "bg-red-100 text-red-900", showRenew: true };
  }
  if (daysLeft <= 6) {
    const d = Math.max(1, daysLeft);
    return {
      label: `Expires in ${d} days ⚠️`,
      className: "bg-red-100 text-red-900",
      showRenew: true,
    };
  }
  if (daysLeft <= 14) {
    return { label: "Expiring soon", className: "bg-amber-100 text-amber-900", showRenew: true };
  }
  return { label: `Expires in ${daysLeft} days`, className: "bg-emerald-100 text-emerald-900", showRenew: false };
}

function mapAiPropertyTypeToForm(raw: unknown): (typeof LISTING_PROPERTY_TYPE_OPTIONS)[number] {
  const k = String(raw ?? "condo")
    .toLowerCase()
    .trim();
  const map: Record<string, (typeof LISTING_PROPERTY_TYPE_OPTIONS)[number]> = {
    condo: "Condo",
    house: "House",
    apartment: "Apartment",
    townhouse: "Townhouse",
    commercial: "Commercial",
    warehouse: "Warehouse",
    office: "Office",
    lot: "Lot",
    land: "Lot",
    villa: "House",
    studio: "Condo",
    presale: "Condo",
  };
  return map[k] ?? "Condo";
}

function ListingsTab({
  properties,
  ownedListingCount,
  coListedCount,
  listingOpen,
  setListingOpen,
  listingForm,
  setListingForm,
  listingFormErrors,
  onSubmit,
  saving,
  listingLimit,
  coListLimit,
  onOpenNewListing,
  onDeleteProperty,
  deletingPropertyId,
  onLeaveListing,
  leavingPropertyId,
  onEditListing,
  userId,
  canAddListing,
  onListingRefresh,
}: {
  properties: PropertyRow[];
  ownedListingCount: number;
  coListedCount: number;
  listingOpen: boolean;
  setListingOpen: (v: boolean) => void;
  listingForm: {
    location: string;
    name: string;
    price: string;
    rent_price: string;
    beds: string;
    baths: string;
    sqft: string;
    description: string;
    listingImageUrls: string[];
    property_type: string;
    listing_type: "sale" | "rent" | "both";
    developer_name: string;
    turnover_date: string;
    unit_types: string[];
    source_url: string | null;
    source_hash: string | null;
    formatted_address: string | null;
    place_id: string | null;
    lat: number | null;
    lng: number | null;
    placeCity: string | null;
    placeRegion: string | null;
    placeNeighborhood: string | null;
    pet_friendly: boolean;
    near_schools: boolean;
    family_friendly: boolean;
  };
  setListingForm: React.Dispatch<React.SetStateAction<typeof listingForm>>;
  listingFormErrors: Record<string, string>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  listingLimit: number;
  coListLimit: number;
  onOpenNewListing: () => void;
  onDeleteProperty: (id: string) => void | Promise<void>;
  deletingPropertyId: string | null;
  onLeaveListing: (id: string) => void | Promise<void>;
  leavingPropertyId: string | null;
  onEditListing: (p: PropertyRow) => void | Promise<void>;
  userId: string;
  canAddListing: boolean;
  onListingRefresh: () => void | Promise<void>;
}) {
  const ownedCap = Number.isFinite(listingLimit) ? String(listingLimit) : "∞";
  const coCap = Number.isFinite(coListLimit) ? String(coListLimit) : "∞";
  const [listingKindFilter, setListingKindFilter] = useState<"all" | "sale" | "rent" | "presale">("all");
  const [listingEntryMode, setListingEntryMode] = useState<"quick" | "manual">("quick");
  const [quickPasteText, setQuickPasteText] = useState("");
  const [analyzingListing, setAnalyzingListing] = useState(false);
  const [showAnalyzeBanner, setShowAnalyzeBanner] = useState(false);
  const listingFormFieldsRef = useRef<HTMLDivElement | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [importListingOpen, setImportListingOpen] = useState(false);
  const [showRemovedListings, setShowRemovedListings] = useState(false);
  const propertiesForKindFilter = useMemo(
    () =>
      showRemovedListings ? properties : properties.filter((p) => !isPropertyListingRemoved(p)),
    [properties, showRemovedListings],
  );
  const visibleProperties = useMemo(() => {
    if (listingKindFilter === "presale") return propertiesForKindFilter.filter((p) => p.is_presale);
    if (listingKindFilter === "sale")
      return propertiesForKindFilter.filter(
        (p) => (p.status === "for_sale" || p.status === "both") && !p.is_presale,
      );
    if (listingKindFilter === "rent")
      return propertiesForKindFilter.filter((p) => p.status === "for_rent" || p.status === "both");
    return propertiesForKindFilter;
  }, [propertiesForKindFilter, listingKindFilter]);

  const listingCompleteness = useMemo(
    () => computeListingCompleteness(listingForm, listingForm.listingImageUrls),
    [listingForm],
  );

  const onNewListingLocationChange = useCallback((v: string) => {
    setListingForm((f) => ({
      ...f,
      location: v,
      formatted_address: null,
      place_id: null,
      lat: null,
      lng: null,
      placeCity: null,
      placeRegion: null,
      placeNeighborhood: null,
    }));
  }, [setListingForm]);

  const onNewListingPlaceSelected = useCallback(
    (payload: GooglePlaceSelectedPayload) => {
      setListingForm((f) => ({
        ...f,
        location: payload.location,
        formatted_address: payload.formatted_address,
        place_id: payload.place_id,
        lat: payload.lat,
        lng: payload.lng,
        placeCity: payload.city,
        placeRegion: payload.region,
        placeNeighborhood: payload.neighborhood,
      }));
    },
    [setListingForm],
  );

  useEffect(() => {
    if (listingOpen) {
      setShowAnalyzeBanner(false);
      setQuickPasteText("");
    }
  }, [listingOpen]);

  const renewListing = async (propertyId: string) => {
    setRenewingId(propertyId);
    try {
      const res = await fetch("/api/agent/renew-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ property_id: propertyId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not renew");
        return;
      }
      toast.success("Listing renewed for 60 days!");
      await onListingRefresh();
    } finally {
      setRenewingId(null);
    }
  };

  const analyzeListing = async () => {
    const text = quickPasteText.trim();
    if (!text) {
      toast.error("Paste listing details first.");
      return;
    }
    setAnalyzingListing(true);
    setShowAnalyzeBanner(false);
    try {
      const res = await fetch("/api/agent/analyze-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: Record<string, unknown>;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Analysis failed");
        return;
      }
      const d = json.data ?? {};
      const priceNum =
        typeof d.price === "number" && Number.isFinite(d.price)
          ? Math.round(d.price)
          : Number.parseInt(String(d.price ?? "").replace(/\D/g, ""), 10);
      const bedsN =
        typeof d.beds === "number" && Number.isFinite(d.beds)
          ? Math.min(20, Math.max(0, Math.round(d.beds)))
          : 2;
      const bathsN =
        typeof d.baths === "number" && Number.isFinite(d.baths)
          ? Math.min(20, Math.max(0, Math.round(d.baths)))
          : 2;
      const sqftN =
        typeof d.sqft === "number" && Number.isFinite(d.sqft)
          ? Math.round(d.sqft)
          : 1000;
      const rawLt = String(d.listing_type ?? "sale").toLowerCase().trim();
      const listingType: "sale" | "rent" | "both" =
        rawLt === "rent" ? "rent" : rawLt === "both" ? "both" : "sale";
      const propType = mapAiPropertyTypeToForm(d.property_type);

      setListingForm((f) => ({
        ...f,
        name: typeof d.name === "string" ? d.name : f.name,
        location: typeof d.location === "string" ? d.location : f.location,
        formatted_address: null,
        place_id: null,
        lat: null,
        lng: null,
        placeCity: null,
        placeRegion: null,
        placeNeighborhood: null,
        price:
          Number.isFinite(priceNum) && priceNum > 0
            ? formatPriceInputDigits(String(priceNum))
            : f.price,
        beds: String(bedsN),
        baths: String(bathsN),
        sqft: String(sqftN),
        description: typeof d.description === "string" ? d.description : f.description,
        property_type: propType,
        listing_type: listingType,
        developer_name:
          typeof d.developer_name === "string" && d.developer_name.trim()
            ? d.developer_name.trim()
            : f.developer_name,
        turnover_date:
          typeof d.turnover_date === "string" && d.turnover_date.trim()
            ? d.turnover_date.trim().slice(0, 10)
            : f.turnover_date,
      }));
      setShowAnalyzeBanner(true);
      requestAnimationFrame(() => {
        listingFormFieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } finally {
      setAnalyzingListing(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Listings</h1>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
            Owned {ownedListingCount}/{ownedCap} · Co-lists {coListedCount}/{coCap}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "sale" as const, label: "For Sale" },
                { id: "rent" as const, label: "For Rent" },
                { id: "presale" as const, label: "Presale" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setListingKindFilter(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  listingKindFilter === t.id
                    ? "bg-[#6B9E6E] text-white"
                    : "bg-[#FAF8F4] text-[#2C2C2C]/55 ring-1 ring-black/10 hover:bg-white"
                }`}
              >
                {t.label}
              </button>
            ))}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-500">
              <input
                type="checkbox"
                checked={showRemovedListings}
                onChange={(e) => setShowRemovedListings(e.target.checked)}
                className="rounded border-gray-300 text-[#6B9E6E] focus:ring-[#6B9E6E]"
              />
              Show removed
            </label>
          </div>
        </div>
        {canAddListing ? (
          <button
            type="button"
            onClick={onOpenNewListing}
            className="rounded-full bg-[#D4A843] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
          >
            Add New Listing
          </button>
        ) : (
          <p className="max-w-sm rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-4 py-3 text-xs font-semibold leading-relaxed text-[#2C2C2C]/55">
            Get verified to post listings.{" "}
            <Link href="/settings?tab=verification" className="font-semibold text-[#6B9E6E] underline">
              Settings → Verification
            </Link>
          </p>
        )}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProperties.map((p) => {
          const removed = isPropertyListingRemoved(p) || p.availability_state === "removed";
          const av = normalizePropertyAvailabilityState(p.availability_state);
          const showAvailabilityPill = !removed && av !== "available";
          return (
          <div
            key={p.id}
            className={cn(
              "relative overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm transition hover:shadow-md",
              removed && "opacity-50",
            )}
          >
            {removed ? (
              <div className="block cursor-default">
                <div className="relative h-40 w-full bg-black/5">
                  <Image
                    src={p.image_url}
                    alt=""
                    fill
                    className="object-cover grayscale"
                    sizes="400px"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 px-2">
                    <span className="rounded-full bg-gray-900/85 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-100">
                      Removed
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {p.status === "both" ? (
                    <div className="space-y-0.5">
                      <p className="truncate font-serif text-base font-bold text-gray-400">
                        Sale {formatListingPricePhp(p.price, "for_sale")}
                      </p>
                      <p className="truncate font-serif text-sm font-bold text-gray-400">
                        Rent {formatListingPricePhp(p.rent_price ?? "", "for_rent")}
                      </p>
                    </div>
                  ) : (
                    <p className="truncate font-serif text-lg font-bold text-gray-400">
                      {formatListingPricePhp(p.price, p.status === "for_rent" ? "for_rent" : "for_sale")}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-gray-400">
                    {(p.name ?? "").trim() || p.location}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-400">
                    {(p.beds ? `${p.beds} beds` : "Studio")} · {p.baths} baths · {p.sqft} sqft
                  </p>
                  <p className="mt-1 flex items-start gap-1 truncate text-xs text-gray-400">
                    <span className="min-w-0 flex-1 truncate">{p.location}</span>
                  </p>
                </div>
              </div>
            ) : (
            <Link href={`/properties/${encodeURIComponent(p.id)}`} className="block">
              <div className="relative h-40 w-full bg-black/5">
                <Image src={p.image_url} alt="" fill className="object-cover" sizes="400px" />
                {showAvailabilityPill ? (
                  <span
                    className={cn(
                      "absolute right-2 top-2 z-[5] rounded-full px-2 py-1 text-[10px] font-bold shadow-sm",
                      av === "reserved" ? "bg-[#D4A843]/95 text-[#2C2C2C]" : "bg-gray-900/85 text-gray-100",
                    )}
                  >
                    {av === "reserved" ? "Reserved" : av === "closed" ? "Closed" : "Unavailable"}
                  </span>
                ) : null}
                {p.is_presale ? (
                  <span className="absolute left-2 top-2 rounded-full bg-[#D4A843] px-2 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                    Presale
                  </span>
                ) : p.status === "both" ? (
                  <span className="absolute left-2 top-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-[#6B9E6E] px-2 py-1 text-[10px] font-bold text-white shadow-sm">
                      For Sale
                    </span>
                    <span className="rounded-full bg-[#3d6b78] px-2 py-1 text-[10px] font-bold text-white shadow-sm">
                      For Rent
                    </span>
                  </span>
                ) : (
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${
                      p.status === "for_rent" ? "bg-[#3d6b78] text-white" : "bg-[#6B9E6E] text-white"
                    }`}
                  >
                    {p.status === "for_rent" ? "For Rent" : "For Sale"}
                  </span>
                )}
                {(() => {
                  const exp = propertyExpiryBadgeInfo(p.expires_at);
                  return exp ? (
                    <span
                      className={`absolute left-2 top-10 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[9px] font-bold shadow-sm ${exp.className}`}
                    >
                      {exp.label}
                    </span>
                  ) : null;
                })()}
                {p.isCoHost ? (
                  <span className="absolute bottom-2 left-2 rounded-full bg-[#D4A843] px-2 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                    Co-Agent
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                {p.status === "both" ? (
                  <div className="space-y-0.5">
                    <p className="truncate font-serif text-base font-bold text-[#2C2C2C]">
                      Sale {formatListingPricePhp(p.price, "for_sale")}
                    </p>
                    <p className="truncate font-serif text-sm font-bold text-[#2C2C2C]/85">
                      Rent {formatListingPricePhp(p.rent_price ?? "", "for_rent")}
                    </p>
                  </div>
                ) : (
                  <p className="truncate font-serif text-lg font-bold text-[#2C2C2C]">
                    {formatListingPricePhp(p.price, p.status === "for_rent" ? "for_rent" : "for_sale")}
                  </p>
                )}

                <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-[#2C2C2C]">
                  {(p.name ?? "").trim() || p.location}
                </p>
                <p className="mt-1 truncate text-xs text-[#6B6B6B]">
                  {(p.beds ? `${p.beds} beds` : "Studio")} · {p.baths} baths · {p.sqft} sqft
                </p>
                <p className="mt-1 flex items-start gap-1 truncate text-xs text-[#6B6B6B]">
                  <span className="min-w-0 flex-1 truncate">{p.location}</span>
                </p>
              </div>
            </Link>
            )}
            {!p.isCoHost && !removed && propertyExpiryBadgeInfo(p.expires_at)?.showRenew ? (
              <div className="px-4 pb-2">
                <button
                  type="button"
                  disabled={renewingId === p.id || !canAddListing}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void renewListing(p.id);
                  }}
                  className="w-full rounded-full bg-[#6B9E6E] py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5a8a5d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {renewingId === p.id ? "Renewing…" : "Renew"}
                </button>
              </div>
            ) : null}
            {!p.isCoHost ? (
              <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <div
                  title={
                    removed
                      ? "Listing removed from public site"
                      : !canAddListing
                        ? "Get verified to manage your listings"
                        : undefined
                  }
                  className={!canAddListing || removed ? "cursor-not-allowed" : undefined}
                >
                  <button
                    type="button"
                    disabled={removed}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void onEditListing(p);
                    }}
                    className={`rounded-full border border-[#6B9E6E]/25 bg-white/95 px-3 py-1.5 text-xs font-bold text-[#2C2C2C] shadow-sm hover:bg-[#6B9E6E]/12 ${
                      !canAddListing || removed ? "cursor-not-allowed opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    Edit
                  </button>
                </div>
                <div
                  title={!canAddListing ? "Get verified to manage your listings" : undefined}
                  className={!canAddListing ? "cursor-not-allowed" : undefined}
                >
                  <button
                    type="button"
                    disabled={deletingPropertyId === p.id || removed}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void onDeleteProperty(p.id);
                    }}
                    className={`rounded-full border border-red-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 ${
                      !canAddListing || removed ? "cursor-not-allowed opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    {deletingPropertyId === p.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute right-2 top-2 z-10">
                <button
                  type="button"
                  disabled={leavingPropertyId === p.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void onLeaveListing(p.id);
                  }}
                  className="rounded-full border border-[#2C2C2C]/20 bg-white/95 px-3 py-1.5 text-xs font-bold text-[#2C2C2C] shadow-sm hover:bg-[#2C2C2C]/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {leavingPropertyId === p.id ? "Leaving…" : "Leave listing"}
                </button>
              </div>
            )}
          </div>
          );
        })}
      </div>

      <AnimatePresence>
        {listingOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setListingOpen(false)}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onSubmit={onSubmit}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#FAF8F4] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">New listing</h2>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setImportListingOpen(true)}
                    className="rounded-full border border-[#6B9E6E]/35 bg-white px-3 py-1.5 text-xs font-bold text-[#6B9E6E] shadow-sm hover:bg-[#FAF8F4]"
                  >
                    Import Listing
                  </button>
                  <button type="button" onClick={() => setListingOpen(false)} className="rounded-full p-2 hover:bg-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <ImportListingModal
                open={importListingOpen}
                onClose={() => setImportListingOpen(false)}
                onApply={(patch) => setListingForm((f) => ({ ...f, ...patch }))}
              />
              <div className="mt-4 flex rounded-xl border border-[#2C2C2C]/15 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setListingEntryMode("quick")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                    listingEntryMode === "quick" ? "bg-[#6B9E6E] text-white shadow-sm" : "text-[#2C2C2C]/55"
                  }`}
                >
                  Quick Add
                </button>
                <button
                  type="button"
                  onClick={() => setListingEntryMode("manual")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                    listingEntryMode === "manual" ? "bg-[#6B9E6E] text-white shadow-sm" : "text-[#2C2C2C]/55"
                  }`}
                >
                  Manual
                </button>
              </div>
              {listingEntryMode === "quick" ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Paste details
                    <textarea
                      value={quickPasteText}
                      onChange={(e) => setQuickPasteText(e.target.value)}
                      rows={6}
                      placeholder={
                        "Paste your listing details here…\ne.g. 2BR condo BGC Taguig 45k/month fully furnished 2 bath 65sqm near mercato"
                      }
                      className="mt-1 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/50"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={analyzingListing}
                    onClick={() => void analyzeListing()}
                    className="w-full rounded-xl bg-[#6B9E6E] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#5a8a5d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {analyzingListing ? "Analyzing…" : "Analyze Listing"}
                  </button>
                </div>
              ) : null}
              {showAnalyzeBanner ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-900">
                  ✅ Listing analyzed! Review the details below and add your photos.
                </div>
              ) : null}
              <div
                ref={listingFormFieldsRef}
                className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start"
              >
                <div className="min-w-0 flex-1 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Location
                  <GooglePlacesInput
                    required
                    value={listingForm.location}
                    onChange={onNewListingLocationChange}
                    onPlaceSelected={onNewListingPlaceSelected}
                    placeholder="Search address or neighborhood…"
                    className="mt-1 w-full"
                    inputClassName="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                    addressMapPreview
                    mapPreviewInstanceId="agent-listing-new-address-map"
                    mapPreviewCenter={
                      listingForm.lat != null && listingForm.lng != null
                        ? { lat: listingForm.lat, lng: listingForm.lng }
                        : null
                    }
                  />
                </label>
                {listingFormErrors.location ? (
                  <p className="text-sm font-semibold text-red-600">{listingFormErrors.location}</p>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Title (optional)
                  <input
                    value={listingForm.name}
                    maxLength={60}
                    onChange={(e) => setListingForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                  <p
                    className={`mt-0.5 text-xs ${
                      listingForm.name.length >= 60
                        ? "text-red-600"
                        : listingForm.name.length > 50
                          ? "text-orange-500"
                          : "text-gray-500"
                    }`}
                  >
                    {listingForm.name.length}/60
                  </p>
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  {listingForm.listing_type === "both"
                    ? "Sale price (₱)"
                    : listingForm.listing_type === "rent"
                      ? "Monthly rent (₱)"
                      : "Price (₱)"}
                  <input
                    required
                    value={listingForm.price}
                    onChange={(e) =>
                      setListingForm((f) => ({ ...f, price: formatPriceInputDigits(e.target.value) }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                    placeholder="₱1,500,000"
                  />
                </label>
                {listingFormErrors.price ? (
                  <p className="text-sm font-semibold text-red-600">{listingFormErrors.price}</p>
                ) : null}
                {listingForm.listing_type === "both" ? (
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Monthly rent (₱)
                    <input
                      required
                      value={listingForm.rent_price}
                      onChange={(e) =>
                        setListingForm((f) => ({
                          ...f,
                          rent_price: formatPriceInputDigits(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                      placeholder="₱45,000"
                    />
                  </label>
                ) : null}
                {listingFormErrors.rent_price ? (
                  <p className="text-sm font-semibold text-red-600">{listingFormErrors.rent_price}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Beds
                    <input
                      inputMode="numeric"
                      value={listingForm.beds}
                      onChange={(e) =>
                        setListingForm((f) => ({
                          ...f,
                          beds: formatDigitsOnly(e.target.value, 2),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Baths
                    <input
                      inputMode="numeric"
                      value={listingForm.baths}
                      onChange={(e) =>
                        setListingForm((f) => ({
                          ...f,
                          baths: formatDigitsOnly(e.target.value, 2),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                    />
                  </label>
                </div>
                {listingFormErrors.beds || listingFormErrors.baths ? (
                  <p className="text-sm font-semibold text-red-600">
                    {[listingFormErrors.beds, listingFormErrors.baths].filter(Boolean).join(" ")}
                  </p>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Sqft
                  <input
                    inputMode="numeric"
                    value={listingForm.sqft}
                    onChange={(e) =>
                      setListingForm((f) => ({ ...f, sqft: formatDigitsOnly(e.target.value, 6) }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </label>
                {listingFormErrors.sqft ? (
                  <p className="text-sm font-semibold text-red-600">{listingFormErrors.sqft}</p>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Property type
                  <select
                    required
                    value={listingForm.property_type}
                    onChange={(e) => {
                      const v = e.target.value;
                      setListingForm((f) => ({
                        ...f,
                        property_type: v,
                        listing_type: v === "Presale" ? "sale" : f.listing_type,
                      }));
                    }}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    {LISTING_PROPERTY_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Features</p>
                  <div className="mt-2 space-y-2.5">
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-[#2C2C2C]">
                      <input
                        type="checkbox"
                        checked={listingForm.pet_friendly}
                        onChange={(e) => setListingForm((f) => ({ ...f, pet_friendly: e.target.checked }))}
                        className="mt-0.5 rounded border-[#2C2C2C]/25"
                      />
                      <span>
                        Pet-friendly
                        <span className="mt-0.5 block text-[11px] font-medium text-[#2C2C2C]/50">
                          Suitable for tenants or buyers with pets.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-[#2C2C2C]">
                      <input
                        type="checkbox"
                        checked={listingForm.near_schools}
                        onChange={(e) => setListingForm((f) => ({ ...f, near_schools: e.target.checked }))}
                        className="mt-0.5 rounded border-[#2C2C2C]/25"
                      />
                      <span>
                        Near schools
                        <span className="mt-0.5 block text-[11px] font-medium text-[#2C2C2C]/50">
                          Walking distance or short commute to schools.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold text-[#2C2C2C]">
                      <input
                        type="checkbox"
                        checked={listingForm.family_friendly}
                        onChange={(e) => setListingForm((f) => ({ ...f, family_friendly: e.target.checked }))}
                        className="mt-0.5 rounded border-[#2C2C2C]/25"
                      />
                      <span>
                        Family-friendly
                        <span className="mt-0.5 block text-[11px] font-medium text-[#2C2C2C]/50">
                          3+ bedrooms or has a play area / family-oriented layout.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                {listingForm.property_type === "Presale" ? (
                  <div className="space-y-3 rounded-xl border border-[#D4A843]/25 bg-[#FAF8F4]/80 p-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                      Developer name
                      <input
                        value={listingForm.developer_name}
                        onChange={(e) => setListingForm((f) => ({ ...f, developer_name: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                      />
                    </label>
                    {listingFormErrors.developer_name ? (
                      <p className="text-sm font-semibold text-red-600">{listingFormErrors.developer_name}</p>
                    ) : null}
                    <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                      Expected turnover date
                      <input
                        type="date"
                        value={listingForm.turnover_date}
                        onChange={(e) => setListingForm((f) => ({ ...f, turnover_date: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                      />
                    </label>
                    {listingFormErrors.turnover_date ? (
                      <p className="text-sm font-semibold text-red-600">{listingFormErrors.turnover_date}</p>
                    ) : null}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Unit types</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PRESALE_UNIT_TYPE_OPTIONS.map((u) => (
                          <label key={u} className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#2C2C2C]">
                            <input
                              type="checkbox"
                              checked={listingForm.unit_types.includes(u)}
                              onChange={() =>
                                setListingForm((f) => ({
                                  ...f,
                                  unit_types: f.unit_types.includes(u)
                                    ? f.unit_types.filter((x) => x !== u)
                                    : [...f.unit_types, u],
                                }))
                              }
                              className="rounded border-[#2C2C2C]/20"
                            />
                            {u}
                          </label>
                        ))}
                      </div>
                    </div>
                    {listingFormErrors.unit_types ? (
                      <p className="text-sm font-semibold text-red-600">{listingFormErrors.unit_types}</p>
                    ) : null}
                  </div>
                ) : null}
                <label
                  className={`text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45 ${
                    listingForm.property_type === "Presale" ? "opacity-50" : ""
                  }`}
                >
                  Listing type
                  <select
                    value={listingForm.listing_type}
                    disabled={listingForm.property_type === "Presale"}
                    onChange={(e) =>
                      setListingForm((f) => ({
                        ...f,
                        listing_type: e.target.value as "sale" | "rent" | "both",
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <option value="sale">For sale</option>
                    <option value="rent">For rent</option>
                    <option value="both">Sale and rent</option>
                  </select>
                </label>
                <CloudinaryUpload
                  value={listingForm.listingImageUrls}
                  onUpload={(urls) => setListingForm((f) => ({ ...f, listingImageUrls: urls }))}
                  maxFiles={10}
                  disabled={saving}
                />
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Description
                  <textarea
                    value={listingForm.description}
                    onChange={(e) => setListingForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </label>
                </div>
                <ListingCompletenessAside completeness={listingCompleteness} />
              </div>
              <button
                type="submit"
                disabled={saving || !listingCompleteness.requiredComplete}
                title={
                  !listingCompleteness.requiredComplete ? "Complete required fields to publish" : undefined
                }
                className="mt-6 w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save listing"}
              </button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type ProfileFormState = {
  name: string;
  phone: string;
  bio: string;
  age: string;
  yearsExperience: string;
  languages: string[];
  specialties: string[];
  serviceAreaTags: string[];
  serviceAreaDraft: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  website: string;
};

function toggleProfileMulti(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function ProfileTab({
  agent,
  listingTier,
  ownedListingCount,
  responseRatePct,
  profileForm,
  setProfileForm,
  onSave,
  saving,
  onUpload,
  supabase,
  userId,
  onAvailabilitySaved,
  onAvailabilityMessage,
}: {
  agent: AgentRow;
  listingTier?: string | null;
  ownedListingCount: number;
  responseRatePct: number;
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  onUpload: (file: File) => void;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  userId: string;
  onAvailabilitySaved: () => void | Promise<void>;
  onAvailabilityMessage: (msg: string) => void;
}) {
  const [availSaving, setAvailSaving] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showAvailableNow = isAgentAvailableNow(agent.availability);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { count, error } = await supabase
        .from("agent_followers")
        .select("id", { head: true, count: "exact" })
        .eq("agent_id", agent.id);
      if (cancelled) return;
      setFollowersCount(error ? null : count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [agent.id, supabase]);

  const autosaveProfile = useCallback(
    (toastLabel = "Saved") => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        // Reuse existing validation + persistence logic through the parent `onSave`.
        // We intentionally submit the whole profile form to avoid partial update drift.
        const ev = { preventDefault() {} } as unknown as React.FormEvent;
        void (async () => {
          await onSave(ev);
          toast.success(toastLabel, { duration: 1200 });
        })();
      }, 350);
    },
    [onSave],
  );

  const setAvailableNow = async (on: boolean) => {
    setAvailSaving(true);
    onAvailabilityMessage("");
    const { error } = await supabase
      .from("agents")
      .update({ availability: on ? AGENT_AVAILABILITY_NOW : AGENT_AVAILABILITY_OFFLINE })
      .eq("user_id", userId);
    setAvailSaving(false);
    if (error) {
      toast.error(error.message);
      onAvailabilityMessage("");
      return;
    }
    onAvailabilityMessage(on ? "You’re shown as Available Now on listings." : "You’re shown as Offline. Last seen was updated.");
    await onAvailabilitySaved();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Public profile</h1>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
            How you appear on BahayGo listings and your agent page. Fields save as you go.
          </p>
        </div>
        <Link
          href={`/agents/${encodeURIComponent(agent.id)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4]"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden />
          Preview public profile
        </Link>
      </div>

      <div className="w-full max-w-[380px] rounded-2xl border border-[#2C2C2C]/8 bg-white p-4 shadow-md">
        <div className="relative mx-auto h-24 w-24">
          <div className="group relative h-full w-full overflow-hidden rounded-full bg-[#FAF8F4] ring-2 ring-white">
            {agent.image_url ? (
              <SupabasePublicImage src={agent.image_url} alt={agent.name} fill sizes="96px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-3xl font-bold text-[#2C2C2C]/25">
                {agent.name.slice(0, 1)}
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              Change photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
            </label>
          </div>
          {agent.verification_status === "verified" ? (
            <span
              className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#D4A843] shadow-md ring-2 ring-white"
              title="Verified"
            >
              <Check className="h-4 w-4 text-white" aria-hidden />
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-3 py-1 text-[11px] font-bold text-[#8a6d32]">
            {normalizeListingTier(listingTier) === "featured" ? "Gold Agent" : normalizeListingTier(listingTier) === "pro" ? "Silver Agent" : "Agent"}
          </span>
        </div>

        <div className="mt-3 text-center">
          <input
            value={profileForm.name}
            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
            onBlur={() => autosaveProfile("Saved")}
            className="w-full bg-transparent text-center font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] focus-visible:outline-none"
            aria-label="Name"
          />
          <p className="mt-0.5 text-sm font-semibold text-[#2C2C2C]/55">Real Estate Agent</p>
        </div>

        <button
          type="button"
          className="mx-auto mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C]"
          onClick={() => {
            // reveal service areas editor by focusing draft input below
            const el = document.getElementById("profile-service-areas");
            (el as HTMLInputElement | null)?.focus?.();
          }}
        >
          <MapPin className="h-3.5 w-3.5 text-[#6B9E6E]" aria-hidden />
          <span className="max-w-[18rem] truncate">
            {profileForm.serviceAreaTags[0] ? profileForm.serviceAreaTags[0] : "Add location"}
          </span>
          <Pencil className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </button>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-[#2C2C2C] tabular-nums">{followersCount ?? "—"}</p>
            <p className="text-[11px] font-semibold text-[#2C2C2C]/45">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#2C2C2C] tabular-nums">{ownedListingCount}</p>
            <p className="text-[11px] font-semibold text-[#2C2C2C]/45">Properties</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#6B9E6E] tabular-nums">{responseRatePct}%</p>
            <p className="text-[11px] font-semibold text-[#2C2C2C]/45">Response Rate</p>
          </div>
        </div>

        <div className="mt-4">
          <textarea
            value={profileForm.bio}
            onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value.slice(0, 280) }))}
            onBlur={() => autosaveProfile("Saved")}
            rows={4}
            maxLength={280}
            placeholder="Write a short bio (280 chars)…"
            className="w-full resize-none rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2 text-sm font-medium text-[#2C2C2C]/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
            aria-label="Bio"
          />
          <p className="mt-1 text-right text-[11px] font-semibold text-[#2C2C2C]/45">{profileForm.bio.length}/280</p>
        </div>

        <div className="mt-4 border-t border-[#2C2C2C]/10 pt-4">
          <p className="text-center text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Specialties</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {SPECIALTY_OPTIONS.map((spec) => {
              const on = profileForm.specialties.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => {
                    setProfileForm((f) => ({ ...f, specialties: toggleProfileMulti(f.specialties, spec) }));
                    autosaveProfile("Saved");
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold transition",
                    on
                      ? "bg-[#D4A843] text-[#2C2C2C]"
                      : "border border-[#2C2C2C]/15 bg-[#FAF8F4] text-[#2C2C2C]/75 hover:bg-white",
                  )}
                >
                  {spec}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 border-t border-[#2C2C2C]/10 pt-4">
          <p className="text-center text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Languages</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {LANGUAGE_OPTIONS.map((lang) => {
              const on = profileForm.languages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setProfileForm((f) => ({ ...f, languages: toggleProfileMulti(f.languages, lang) }));
                    autosaveProfile("Saved");
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold transition",
                    on
                      ? "bg-[#6B9E6E] text-white"
                      : "border border-[#2C2C2C]/15 bg-[#FAF8F4] text-[#2C2C2C]/75 hover:bg-white",
                  )}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 border-t border-[#2C2C2C]/10 pt-4">
          <p className="text-center text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Connect</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[
              { key: "linkedin", icon: <User className="h-4 w-4" />, label: "LinkedIn", value: profileForm.linkedin, set: (v: string) => setProfileForm((f) => ({ ...f, linkedin: v })) },
              { key: "facebook", icon: <User className="h-4 w-4" />, label: "Facebook", value: profileForm.facebook, set: (v: string) => setProfileForm((f) => ({ ...f, facebook: v })) },
              { key: "instagram", icon: <User className="h-4 w-4" />, label: "Instagram", value: profileForm.instagram, set: (v: string) => setProfileForm((f) => ({ ...f, instagram: v })) },
              { key: "website", icon: <Globe className="h-4 w-4" />, label: "Website", value: profileForm.website, set: (v: string) => setProfileForm((f) => ({ ...f, website: v })) },
              { key: "phone", icon: <Phone className="h-4 w-4" />, label: "Phone", value: profileForm.phone, set: (v: string) => setProfileForm((f) => ({ ...f, phone: v })) },
            ].map((it) => (
              <div key={it.key} className="w-full">
                <label className="flex items-center gap-2 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2 text-xs font-semibold text-[#2C2C2C]/70">
                  <span className="text-[#6B9E6E]">{it.icon}</span>
                  <span className="w-24">{it.label}</span>
                  <input
                    value={it.value}
                    onChange={(e) => it.set(e.target.value)}
                    onBlur={() => autosaveProfile("Saved")}
                    placeholder={it.key === "phone" ? "+63…" : "https://…"}
                    className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#2C2C2C]/70 placeholder:text-[#2C2C2C]/35 focus-visible:outline-none"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-[#2C2C2C]/10 pt-4">
          <p className="text-center text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Location</p>
          <div className="mt-2">
            <ServiceAreasMultiInput
              id="profile-service-areas"
              values={profileForm.serviceAreaTags}
              onChange={(values) => {
                setProfileForm((f) => ({ ...f, serviceAreaTags: values }));
                autosaveProfile("Saved");
              }}
              draft={profileForm.serviceAreaDraft}
              onDraftChange={(v) => setProfileForm((f) => ({ ...f, serviceAreaDraft: v }))}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-[#2C2C2C]/10 pt-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#2C2C2C]">Show as Available Now</p>
              <p className="mt-0.5 text-xs font-semibold text-[#2C2C2C]/55">
                Controls how you appear on listings.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showAvailableNow}
              disabled={availSaving}
              onClick={() => void setAvailableNow(!showAvailableNow)}
              className={`relative h-9 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 disabled:opacity-50 ${
                showAvailableNow ? "bg-[#6B9E6E]" : "bg-[#2C2C2C]/20"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                  showAvailableNow ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <AgentAvailabilitySchedule
        key={JSON.stringify(agent.availability_schedule ?? {})}
        agent={agent}
        supabase={supabase}
        userId={userId}
        onSaved={onAvailabilitySaved}
      />
    </div>
  );
}

function AgentNotificationsTab({
  userId,
  supabase,
}: {
  userId: string;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentById, setParentById] = useState<Record<string, NotificationListItem>>({});
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, created_at, type, title, body, read_at, metadata, dismissed_by_agent, parent_id, property_name, reply_message")
        .eq("user_id", userId)
        .eq("dismissed_by_agent", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setRows((data ?? []) as NotificationListItem[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  useEffect(() => {
    const parentIds = [...new Set(rows.map((r) => (r as unknown as { parent_id?: string | null }).parent_id).filter((x): x is string => Boolean(x)))];
    if (parentIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, created_at, type, title, body, read_at, metadata, property_name")
        .in("id", parentIds);
      if (cancelled) return;
      const map: Record<string, NotificationListItem> = {};
      for (const row of (data ?? []) as NotificationListItem[]) {
        map[row.id] = row;
      }
      setParentById((prev) => ({ ...prev, ...map }));
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, supabase]);

  const markRead = async (n: NotificationListItem, navigateTo?: string | null) => {
    if (!n.read_at) {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id)
        .eq("user_id", userId);
      if (error) return;
      setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    const href = navigateTo ?? resolveNotificationLink(n.metadata ?? null);
    if (href) router.push(href);
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Notifications</h1>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Updates from BahayGo and your activity.</p>
      {loading ? (
        <p className="mt-8 text-sm font-semibold text-[#2C2C2C]/45">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center text-sm font-semibold text-[#2C2C2C]/45 shadow-sm">
          No notifications yet
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((n) => (
            <li key={n.id}>
              {(n.type ?? "").toLowerCase() === "client_reply" ? (
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-900">
                          {((n as unknown as { property_name?: string | null }).property_name ?? "").trim() ||
                            (n.metadata && typeof n.metadata.property_name === "string" ? n.metadata.property_name : "") ||
                            "Property"}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-[#2C2C2C]/45">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 font-bold text-[#2C2C2C]">Client Reply</p>
                      <p className="mt-1 text-sm font-medium text-[#2C2C2C]/70">
                        {((n as unknown as { reply_message?: string | null }).reply_message ?? n.body ?? "").toString()}
                      </p>
                      {(() => {
                        const pid = (n as unknown as { parent_id?: string | null }).parent_id ?? "";
                        const parent = pid ? parentById[pid] : null;
                        if (!parent) return null;
                        return (
                          <div className="mt-3 rounded-xl border border-gray-200 bg-[#FAF8F4] p-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/55">
                              Original message
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#2C2C2C]">{parent.title}</p>
                            {parent.body ? (
                              <p className="mt-1 text-sm font-medium text-[#2C2C2C]/70">{parent.body}</p>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="shrink-0">
                      <button
                        type="button"
                        aria-label="Dismiss notification"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("notifications")
                            .update({ dismissed_by_agent: true })
                            .eq("id", n.id)
                            .eq("user_id", userId);
                          if (!error) setRows((prev) => prev.filter((x) => x.id !== n.id));
                        }}
                        className="rounded-full p-2 text-[#2C2C2C]/45 hover:bg-gray-100 hover:text-[#2C2C2C]/70"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    {replyOpenId === n.id ? (
                      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Reply back…"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm outline-none"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={replyBusy}
                            onClick={() => {
                              setReplyOpenId(null);
                              setReplyText("");
                            }}
                            className="rounded-full px-4 py-2 text-sm font-bold text-[#2C2C2C]/60 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={replyBusy || !replyText.trim()}
                            onClick={async () => {
                              setReplyBusy(true);
                              try {
                                const res = await fetch("/api/agent/notification-reply-back", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({
                                    reply_to_notification_id: n.id,
                                    message: replyText.trim(),
                                  }),
                                });
                                if (res.ok) {
                                  setReplyOpenId(null);
                                  setReplyText("");
                                }
                              } finally {
                                setReplyBusy(false);
                              }
                            }}
                            className="rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {replyBusy ? "…" : "Send"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyOpenId(n.id);
                          setReplyText("");
                        }}
                        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow-sm hover:bg-gray-50"
                      >
                        Reply Back
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <NotificationCard n={n} onMarkRead={markRead} />
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { error } = await supabase
                        .from("notifications")
                        .update({ dismissed_by_agent: true })
                        .eq("id", n.id)
                        .eq("user_id", userId);
                      if (!error) setRows((prev) => prev.filter((x) => x.id !== n.id));
                    }}
                    className="absolute right-3 top-3 rounded-full p-1.5 text-[#2C2C2C]/45 hover:bg-gray-100 hover:text-[#2C2C2C]/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
