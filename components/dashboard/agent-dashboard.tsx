"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Check,
  CreditCard,
  GitBranch,
  House,
  Home,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Settings,
    Sparkles,
  Users,
  X,
} from "lucide-react";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { AgentBillingTab } from "@/components/dashboard/agent-billing-tab";
import { AgentAnalyticsTab } from "@/components/dashboard/agent-analytics-tab";
import { AgentLeadSlideOver } from "@/components/dashboard/agent-lead-slideover";
import { AgentPipelineTab, type PipelineStageId } from "@/components/dashboard/agent-pipeline-tab";
import { useAuth } from "@/contexts/auth-context";
import { useGlobalAlert } from "@/contexts/global-alert-context";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
import { formatLicenseDate } from "@/lib/license-expiry";
import {
  coListLimitForTier,
  isUnlimitedCoList,
  isUnlimitedOwned,
  listingLimitForTier,
  normalizeListingTier,
  teamMemberLimitForTier,
  TIER_LABEL,
} from "@/lib/agent-listing-limits";
import { ListingLimitUpgradeModal } from "@/components/marketplace/listing-limit-upgrade-modal";
import { PropertyListingImagesInput } from "@/components/dashboard/property-listing-images-input";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import { PhPhoneInput } from "@/components/ui/ph-phone-input";
import { isPhilippinePhoneMode, validatePhilippinePhoneInput } from "@/lib/phone-ph";
import { formatListingPricePhp } from "@/lib/format-listing-price";
import {
  AGENT_AVAILABILITY_NOW,
  AGENT_AVAILABILITY_OFFLINE,
  isAgentAvailableNow,
} from "@/components/marketplace/agent-availability-badge";
import { AgentAvailabilitySchedule } from "@/components/dashboard/agent-availability-schedule";
import { toast } from "sonner";
import {
  formatDigitsOnly,
  formatPriceInputDigits,
  parseListingPricePesos,
  validateBedsBaths,
  validateListingPriceDisplay,
  validateSqft,
} from "@/lib/validation/listing-form";
import { ServiceAreasMultiInput } from "@/components/ui/service-areas-multi-input";
import {
  NotificationCard,
  resolveNotificationLink,
  type NotificationListItem,
} from "@/components/notifications/notification-list";

type Tab =
  | "overview"
  | "pipeline"
  | "listings"
  | "profile"
  | "analytics"
  | "notifications"
  | "billing";

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
  name: string;
  email: string;
  phone: string | null;
  property_interest: string | null;
  message: string | null;
  stage: string;
  pipeline_stage?: string | null;
  pipeline_position?: number | null;
  closing_notes?: string | null;
  property_id?: string | null;
  created_at: string;
  updated_at?: string;
  client_id: string | null;
};

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
  image_url: string;
  status: "for_sale" | "for_rent";
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

const PRESALE_UNIT_TYPE_OPTIONS = ["Studio", "1BR", "2BR", "3BR", "4BR+"] as const;

const EDIT_LISTING_STATUSES = ["active", "under_offer", "sold", "off_market"] as const;

const DEFAULT_LISTING_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop";

function computeListingCompleteness(
  form: {
    location: string;
    name: string;
    price: string;
    beds: string;
    baths: string;
    sqft: string;
    description: string;
    property_type: string;
  },
  imageUrls: string[],
) {
  const photosOk = imageUrls.filter((u) => u?.trim()).length >= 1;
  const priceOk = !validateListingPriceDisplay(form.price);
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

type EditListingForm = {
  name: string;
  location: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  property_type: string;
  listing_type: "sale" | "rent";
  listing_status: "active" | "under_offer" | "sold" | "off_market";
  description: string;
  developer_name: string;
  turnover_date: string;
  unit_types: string[];
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

export function AgentDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [tab, setTab] = useState<Tab>("overview");
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [paymentBannerTier, setPaymentBannerTier] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get("tab");
    const allowed: Tab[] = [
      "overview",
      "pipeline",
      "listings",
      "profile",
      "analytics",
      "notifications",
      "billing",
    ];
    if (raw === "leads" || raw === "viewings") {
      setTab("pipeline");
    } else if (raw && allowed.includes(raw as Tab)) setTab(raw as Tab);

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
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null);
  const [leavingPropertyId, setLeavingPropertyId] = useState<string | null>(null);

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
  const [editWarningOpen, setEditWarningOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [pendingEditProperty, setPendingEditProperty] = useState<PropertyRow | null>(null);
  const [editPropertyId, setEditPropertyId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditListingForm>({
    name: "",
    location: "",
    price: "",
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
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editListingImages, setEditListingImages] = useState<string[]>([]);
  const [listingForm, setListingForm] = useState({
    location: "",
    name: "",
    price: "",
    beds: "2",
    baths: "2",
    sqft: "1000",
    description: "",
    listingImageUrls: [] as string[],
    property_type: "Condo",
    listing_type: "sale" as "sale" | "rent",
    developer_name: "",
    turnover_date: "",
    unit_types: [] as string[],
  });
  const [listingFormErrors, setListingFormErrors] = useState<Record<string, string>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const editListingCompleteness = useMemo(
    () => computeListingCompleteness(editForm, editListingImages),
    [editForm, editListingImages],
  );

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const { data: a } = await supabase
      .from("agents")
      .select(
        "id, user_id, name, email, phone, bio, license_number, license_expiry, image_url, status, verified, broker_id, specialties, service_areas, social_links, age, years_experience, languages_spoken, response_time, closings, score, listing_tier, availability_schedule, availability, updated_at, verification_status",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    setAgent((a as AgentRow | null) ?? null);
    setLoaded(true);
    if (!a) return;

    if (a.status === "approved" && (a as AgentRow).verification_status === "verified") {
      const [{ data: ld }, { data: owned }, { data: paRows }, vwRes] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "id, name, email, phone, property_interest, message, stage, pipeline_stage, pipeline_position, closing_notes, property_id, created_at, updated_at, client_id",
          )
          .eq("agent_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("properties")
          .select(
            "id, name, location, price, image_url, status, beds, baths, sqft, description, property_type, listing_status, is_presale, developer_name, turnover_date, unit_types, expires_at",
          )
          .eq("listed_by", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("property_agents").select("property_id").eq("agent_id", a.id),
        supabase
          .from("viewing_requests")
          .select("*")
          .eq("agent_user_id", user.id)
          .order("scheduled_at", { ascending: true }),
      ]);
      setLeads((ld as LeadRow[]) ?? []);

      const ownedList = ((owned ?? []) as Record<string, unknown>[]).map((raw) => {
        const p = raw as Record<string, unknown>;
        return {
          id: String(p.id),
          name: (p.name as string | null) ?? null,
          location: String(p.location ?? ""),
          price: p.price as string | number,
          image_url: String(p.image_url ?? ""),
          status: p.status as "for_sale" | "for_rent",
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
            "id, name, location, price, image_url, status, beds, baths, sqft, description, property_type, listing_status, is_presale, developer_name, turnover_date, unit_types, expires_at",
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
            image_url: String(p.image_url ?? ""),
            status: p.status as "for_sale" | "for_rent",
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
      setProperties([]);
      setViewings([]);
    }
  }, [supabase, user?.id]);

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

  useEffect(() => {
    if (!agent?.user_id) return;
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
  }, [agent?.user_id]);

  useEffect(() => {
    if (!agent) return;
    if (agent.verification_status !== "verified" && (tab === "pipeline" || tab === "listings")) {
      setTab("overview");
    }
  }, [agent, tab]);

  useEffect(() => {
    if (!agent) return;
    const sl = (agent.social_links ?? {}) as Record<string, string>;
    const spec = splitCsv(agent.specialties);
    const langs = splitCsv(agent.languages_spoken);
    const areas = splitServiceAreas(agent.service_areas);
    setProfileForm({
      name: agent.name,
      phone: agent.phone ?? "",
      bio: agent.bio ?? "",
      age: agent.age != null ? String(agent.age) : "",
      yearsExperience: agent.years_experience != null ? String(agent.years_experience) : "",
      languages: langs.filter((x) => (LANGUAGE_OPTIONS as readonly string[]).includes(x)),
      specialties: spec.filter((x) => (SPECIALTY_OPTIONS as readonly string[]).includes(x)),
      serviceAreaTags: areas,
      serviceAreaDraft: "",
      instagram: sl.instagram ?? "",
      facebook: sl.facebook ?? "",
      linkedin: sl.linkedin ?? "",
      website: sl.website ?? "",
    });
  }, [agent]);

  const identityVerified = agent?.verification_status === "verified";

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
    if (authLoading || !user?.id || !agent?.id) return;
    void fetch("/api/agent/check-listing-expiry-notifications", {
      method: "POST",
      credentials: "include",
    });
  }, [authLoading, user?.id, agent?.id]);

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

  const newLeadsCount = useMemo(() => leads.filter((l) => l.stage === "new").length, [leads]);

  const pipelinePropertyLabel = useCallback(
    (propertyId: string | null) => {
      if (!propertyId) return "General inquiry";
      const p = properties.find((x) => x.id === propertyId);
      return (p?.name?.trim() || p?.location || "Property").trim() || "Property";
    },
    [properties],
  );

  const mockProfileViews = useMemo(() => 120 + (agent?.id ? agent.id.charCodeAt(0) % 380 : 0), [agent?.id]);
  const mockResponseRate = useMemo(() => 85 + (agent?.id ? agent.id.charCodeAt(1) % 14 : 0), [agent?.id]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !agent) return;
    setSaving(true);
    setMsg("");
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
      setMsg("Bio must be 500 characters or less.");
      return;
    }
    const phTrim = profileForm.phone.trim();
    if (phTrim && isPhilippinePhoneMode(phTrim)) {
      const pe = validatePhilippinePhoneInput(phTrim);
      if (pe) {
        setSaving(false);
        setMsg(pe);
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
      setMsg(error.message);
      return;
    }
    setMsg("Profile saved.");
    await loadData();
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.id || !agent) return;
    setSaving(true);
    setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("agent-avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (upErr) {
      setSaving(false);
      setMsg(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("agent-avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error } = await supabase.from("agents").update({ image_url: url }).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Photo updated.");
    await loadData();
  };

  const updateLeadStage = async (leadId: number, stage: string) => {
    const { error } = await supabase.from("leads").update({ stage }).eq("id", leadId);
    if (error) {
      setMsg(error.message);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    setSelectedLead((s) => (s && s.id === leadId ? { ...s, stage } : s));
  };

  const deleteListing = async (propertyId: string) => {
    if (!user?.id) return;
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setDeletingPropertyId(propertyId);
    const orderedDeletes = [
      { label: "co_agent_requests", run: () => supabase.from("co_agent_requests").delete().eq("property_id", propertyId) },
      { label: "property_agents", run: () => supabase.from("property_agents").delete().eq("property_id", propertyId) },
      { label: "property_photos", run: () => supabase.from("property_photos").delete().eq("property_id", propertyId) },
      { label: "viewing_requests", run: () => supabase.from("viewing_requests").delete().eq("property_id", propertyId) },
      { label: "leads", run: () => supabase.from("leads").delete().eq("property_id", propertyId) },
    ] as const;
    for (const step of orderedDeletes) {
      const { error } = await step.run();
      if (error) {
        setDeletingPropertyId(null);
        setMsg(`Could not delete listing (${step.label}): ${error.message}`);
        return;
      }
    }
    const { error } = await supabase.from("properties").delete().eq("id", propertyId).eq("listed_by", user.id);
    setDeletingPropertyId(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Listing deleted.");
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
      setMsg(error.message);
      return;
    }
    setMsg("You left the listing.");
    await loadData();
  };

  const openEditFormFromProperty = useCallback(
    async (p: PropertyRow) => {
      try {
        const { data: photoRows, error: photoErr } = await supabase
          .from("property_photos")
          .select("url, sort_order")
          .eq("property_id", p.id)
          .order("sort_order", { ascending: true });
        if (photoErr) {
          toast.error("Could not load extra photos. Main image and other fields are still editable.");
        }
        const pt = (p.property_type ?? "House").trim();
        const safeType = EDIT_PROPERTY_TYPES.includes(pt as (typeof EDIT_PROPERTY_TYPES)[number])
          ? pt
          : "House";
        const extras = (photoRows ?? [])
          .map((r: { url: string }) => r.url)
          .filter((u) => typeof u === "string" && u.trim().length > 0 && u !== p.image_url);
        const main =
          typeof p.image_url === "string" && p.image_url.trim().length > 0 ? p.image_url.trim() : "";
        const imageUrls = [main, ...extras].filter(Boolean).slice(0, 10);
        setEditPropertyId(p.id);
        setEditFormErrors({});
        setEditForm({
          name: p.name ?? "",
          location: p.location ?? "",
          price: propertyPriceToFormDisplay(p.price),
          beds: formatDigitsOnly(String(p.beds ?? 0), 2),
          baths: formatDigitsOnly(String(p.baths ?? 0), 2),
          sqft: p.sqft != null ? formatDigitsOnly(String(p.sqft), 6) : "",
          property_type: safeType,
          listing_type: p.status === "for_rent" ? "rent" : "sale",
          listing_status: normalizeEditListingStatus(p.listing_status),
          description: p.description ?? "",
          developer_name: p.developer_name?.trim() ?? "",
          turnover_date: p.turnover_date ? String(p.turnover_date).slice(0, 10) : "",
          unit_types: Array.isArray(p.unit_types) ? [...p.unit_types] : [],
        });
        setEditListingImages(imageUrls);
        setEditFormOpen(true);
        setEditWarningOpen(false);
        setPendingEditProperty(null);
      } catch {
        toast.error("Could not open the edit form. Please try again.");
        setEditPropertyId(null);
        setEditListingImages([]);
      }
    },
    [supabase],
  );

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
        const res = await fetch("/api/agent/update-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            propertyId: editPropertyId,
            name: editForm.name.trim() || null,
            location: editForm.location.trim(),
            price: String(parseListingPricePesos(editForm.price) ?? ""),
            beds,
            baths,
            sqft: editForm.sqft.replace(/\D/g, ""),
            property_type: editForm.property_type,
            status: isPs ? "for_sale" : editForm.listing_type === "sale" ? "for_sale" : "for_rent",
            listing_status: editForm.listing_status,
            description: editForm.description.trim() || null,
            imageUrls,
            is_presale: isPs,
            developer_name: isPs ? editForm.developer_name.trim() : null,
            turnover_date: isPs ? editForm.turnover_date.trim() : null,
            unit_types: isPs ? editForm.unit_types : [],
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          error?: { message?: string };
        };
        if (!res.ok) {
          toast.error(json?.error?.message ?? "Could not save listing.");
          return;
        }
        toast.success("Listing updated successfully");
        setEditFormErrors({});
        setEditFormOpen(false);
        setEditPropertyId(null);
        setEditListingImages([]);
        await loadData();
      } finally {
        setSavingEdit(false);
      }
    },
    [editPropertyId, editForm, editListingImages, loadData],
  );

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
    const priceNum = parseListingPricePesos(listingForm.price);
    setSaving(true);
    setMsg("");
    const beds = Number(listingForm.beds.replace(/\D/g, "")) || 0;
    const baths = Number(listingForm.baths.replace(/\D/g, "")) || 0;
    const mainImageUrl = listingForm.listingImageUrls[0]?.trim() || DEFAULT_LISTING_IMAGE;
    const isPs = listingForm.property_type === "Presale";
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: newProperty, error } = await supabase
      .from("properties")
      .insert({
        name: listingForm.name.trim() || null,
        location: listingForm.location.trim(),
        price: priceNum != null ? String(priceNum) : "",
        sqft: listingForm.sqft.replace(/\D/g, ""),
        beds,
        baths,
        image_url: mainImageUrl,
        status: isPs ? "for_sale" : listingForm.listing_type === "sale" ? "for_sale" : "for_rent",
        listed_by: user.id,
        property_type: listingForm.property_type,
        description: listingForm.description.trim() || null,
        is_presale: isPs,
        developer_name: isPs ? listingForm.developer_name.trim() : null,
        turnover_date: isPs ? listingForm.turnover_date.trim() : null,
        unit_types: isPs ? listingForm.unit_types : [],
        expires_at: expiresAt,
        expiry_notified_at: null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      if (/row-level security|violates row-level security policy/i.test(error.message)) {
        setListingLimitModalKind("owned");
        setListingLimitModalOpen(true);
        setMsg("");
      } else {
        setMsg(error.message);
      }
      return;
    }
    if (newProperty?.id && agent?.id) {
      const { error: linkErr } = await supabase.from("property_agents").insert({
        property_id: newProperty.id,
        agent_id: agent.id,
      });
      if (linkErr && linkErr.code !== "23505") {
        setMsg(`Listing saved, but connected-agent link failed: ${linkErr.message}`);
      }
    }
    if (newProperty?.id && listingForm.listingImageUrls.length > 1) {
      const extras = listingForm.listingImageUrls.slice(1).map((url, i) => ({
        property_id: newProperty.id,
        url,
        sort_order: i,
      }));
      const { error: phErr } = await supabase.from("property_photos").insert(extras);
      if (phErr) {
        setMsg(`Listing saved, but extra photos failed: ${phErr.message}`);
      }
    }
    setListingOpen(false);
    setListingForm({
      location: "",
      name: "",
      price: "",
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
    });
    setListingFormErrors({});
    await loadData();
    setMsg("Listing created.");
    setTab("listings");
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
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: "pipeline", label: "Pipeline", icon: <GitBranch className="h-5 w-5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" /> },
    { id: "listings", label: "Listings", icon: <Home className="h-5 w-5" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="h-5 w-5" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { id: "profile", label: "Profile", icon: <Settings className="h-5 w-5" /> },
  ];
  const tabs = identityVerified
    ? allTabs
    : allTabs.filter((t) => t.id !== "pipeline" && t.id !== "listings");

  const mobilePrimaryTabIds: Tab[] = identityVerified ? ["overview", "pipeline", "listings"] : ["overview"];
  const mobileMoreTabIds: Tab[] = ["analytics", "billing", "profile"];

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[#2C2C2C]/10 bg-[#FAF8F4] md:sticky md:top-0 md:flex md:h-screen md:flex-col md:px-4 md:py-8">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-[#D4A843]/35">
              {agent.image_url ? (
                <SupabasePublicImage src={agent.image_url} alt="" fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/20 text-lg font-bold text-[#2C2C2C]">
                  {agent.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#2C2C2C]">{agent.name}</p>
              <VerifiedAgentBadge show={agent.verification_status === "verified"} />
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  tab === t.id
                    ? "bg-[#6B9E6E]/15 text-[#2C2C2C] ring-1 ring-[#D4A843]/25"
                    : "text-[#2C2C2C]/65 hover:bg-white/80"
                }`}
              >
                <span className="text-[#6B9E6E]">{t.icon}</span>
                {t.label}
                {t.id === "pipeline" && newLeadsCount > 0 ? (
                  <span className="ml-auto rounded-full bg-[#D4A843]/25 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                    {newLeadsCount}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <Link
            href="/"
            className="mt-auto px-3 py-2 text-sm font-semibold text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
          >
            ← Back to site
          </Link>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-10 md:pb-10">
          {msg ? (
            <p className="mb-4 rounded-xl border border-[#D4A843]/30 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]">
              {msg}
            </p>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
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
                  mockProfileViews={mockProfileViews}
                  mockResponseRate={mockResponseRate}
                  listingLimit={listingLimit}
                  coListLimit={coListLimit}
                  atListingLimit={atListingLimit}
                  atCoListLimit={atCoListLimit}
                />
              )}
              {tab === "pipeline" && identityVerified && (
                <AgentPipelineTab
                  leads={leads.map((l) => ({
                    id: l.id,
                    name: l.name,
                    email: l.email,
                    client_id: l.client_id ?? null,
                    pipeline_stage: (l.pipeline_stage ?? "lead") as PipelineStageId,
                    property_id: l.property_id ?? null,
                    created_at: l.created_at,
                    pipeline_position: l.pipeline_position ?? null,
                    closing_notes: l.closing_notes ?? null,
                  }))}
                  propertyLabel={pipelinePropertyLabel}
                  supabase={supabase}
                  onRefresh={loadData}
                  onOpenLeadDetails={(leadId) => {
                    const row = leads.find((x) => x.id === leadId);
                    if (row) setSelectedLead(row);
                  }}
                />
              )}
              {tab === "analytics" && (
                <AgentAnalyticsTab leads={leads} viewings={viewings} agent={agent} />
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
              {tab === "profile" && user && agent && (
                <ProfileTab
                  agent={agent}
                  listingTier={agent.listing_tier}
                  profileForm={profileForm}
                  setProfileForm={setProfileForm}
                  onSave={saveProfile}
                  saving={saving}
                  onUpload={uploadAvatar}
                  supabase={supabase}
                  userId={user.id}
                  onAvailabilitySaved={loadData}
                  onAvailabilityMessage={setMsg}
                />
              )}
              {tab === "profile" && user && !agent && loaded && (
                <p className="text-sm font-semibold text-[#2C2C2C]/55">No agent profile found.</p>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom bar — Home, Overview, Pipeline, Listings, More */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-between gap-0 border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => {
            setMoreDrawerOpen(false);
            router.push("/");
          }}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-bold text-[#2C2C2C]/45"
        >
          <span className="text-[#2C2C2C]/45">
            <House className="h-5 w-5" aria-hidden />
          </span>
          Home
        </button>
        {mobilePrimaryTabIds.map((tid) => {
          const t = tabs.find((x) => x.id === tid)!;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setMoreDrawerOpen(false);
              }}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-bold ${
                tab === t.id ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"
              }`}
            >
              <span className={tab === t.id ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>{t.icon}</span>
              {t.label}
              {t.id === "pipeline" && newLeadsCount > 0 ? (
                <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-[#D4A843]" />
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreDrawerOpen(true)}
          className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-bold ${
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
                        setTab(t.id);
                        setMoreDrawerOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                        tab === t.id ? "bg-[#6B9E6E]/15 text-[#6B9E6E]" : "text-[#2C2C2C]/75 hover:bg-white/80"
                      }`}
                    >
                      <span className={tab === t.id ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>{t.icon}</span>
                      {t.label}
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
              setEditFormOpen(false);
              setEditPropertyId(null);
              setEditListingImages([]);
              setEditFormErrors({});
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
                    setEditFormOpen(false);
                    setEditPropertyId(null);
                    setEditListingImages([]);
                    setEditFormErrors({});
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
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Price (₱)
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
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Location
                  <PhLocationInput
                    required
                    value={editForm.location}
                    onChange={(v) => setEditForm((f) => ({ ...f, location: v }))}
                    placeholder="e.g. BGC, Taguig"
                    className="mt-1 w-full"
                    inputClassName="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
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
                    {EDIT_PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
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
                  <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">For Sale / For Rent</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={editForm.property_type === "Presale"}
                      onClick={() => setEditForm((f) => ({ ...f, listing_type: "sale" }))}
                      className={`flex-1 rounded-full py-2 text-xs font-bold ${
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
                      className={`flex-1 rounded-full py-2 text-xs font-bold ${
                        editForm.listing_type === "rent"
                          ? "bg-[#6B9E6E] text-white"
                          : "bg-[#FAF8F4] text-[#2C2C2C]/45"
                      }`}
                    >
                      For Rent
                    </button>
                  </div>
                </div>
                {user?.id ? (
                  <PropertyListingImagesInput
                    userId={user.id}
                    value={editListingImages}
                    onChange={setEditListingImages}
                    disabled={savingEdit}
                  />
                ) : null}
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
  mockProfileViews,
  mockResponseRate,
  listingLimit,
  coListLimit,
  atListingLimit,
  atCoListLimit,
}: {
  agent: AgentRow;
  accountApproved: boolean;
  identityVerified: boolean;
  leads: LeadRow[];
  properties: PropertyRow[];
  ownedListingCount: number;
  coListedCount: number;
  profileComplete: { pct: number; checks: { ok: boolean; label: string }[] };
  mockProfileViews: number;
  mockResponseRate: number;
  listingLimit: number;
  coListLimit: number;
  atListingLimit: boolean;
  atCoListLimit: boolean;
}) {
  const recent = leads.slice(0, 5);
  const incomplete = profileComplete.pct < 100;
  const totalRepresented = properties.length;
  const ownedCount = properties.filter((p) => !p.isCoHost).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Overview</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Welcome back, {agent.name.split(" ")[0]}.</p>
      </div>

      {!accountApproved ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm font-semibold text-amber-950">
          Your agent application is {agent.status === "pending" ? "pending review" : agent.status}. Dashboard tools
          unlock once you are verified.
        </div>
      ) : null}

      {accountApproved && !identityVerified ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">
            ⚠️ Your account is not verified. Upload your documents to unlock all features.
          </p>
          <Link
            href="/settings?tab=verification"
            className="mt-3 inline-flex rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-bold text-white hover:bg-[#6B9E6E]"
          >
            Complete Verification →
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Leads" value={String(leads.length)} />
        <StatCard label="Owned listings" value={String(ownedCount)} />
        <StatCard label="Profile Views" value={String(mockProfileViews)} hint="mock" />
        <StatCard label="Response Rate" value={`${mockResponseRate}%`} hint="mock" />
      </div>

      {identityVerified ? (
        <p className="text-sm font-semibold text-[#2C2C2C]/75">
          You represent {totalRepresented} propert{totalRepresented === 1 ? "y" : "ies"} total ({ownedCount} owned,{" "}
          {coListedCount} co-listed).
        </p>
      ) : null}

      {identityVerified ? (
        <div
          className={`rounded-2xl border bg-white p-5 shadow-sm ${
            atListingLimit || atCoListLimit ? "border-[#D4A843]/50 ring-1 ring-[#D4A843]/25" : "border-[#2C2C2C]/10"
          }`}
        >
          <p className="text-sm font-bold text-[#2C2C2C]">Plan usage</p>
          <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
            Owned listings and co-listings each use separate slots on your plan.
          </p>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-xs font-bold uppercase tracking-wide ${atListingLimit ? "text-[#8a6d32]" : "text-[#2C2C2C]/80"}`}>
                Owned listings
              </p>
              <p
                className={`text-sm font-bold tabular-nums ${atListingLimit ? "text-[#B8860B]" : "text-[#2C2C2C]/80"}`}
              >
                {ownedListingCount}/{Number.isFinite(listingLimit) ? listingLimit : "∞"} used
              </p>
            </div>
            <div
              className={`mt-2 h-2 w-full overflow-hidden rounded-full ${
                atListingLimit ? "bg-[#D4A843]/25" : "bg-[#EBE6DC]"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  atListingLimit
                    ? "bg-gradient-to-r from-[#D4AF37] to-[#D4A843]"
                    : "bg-gradient-to-r from-[#6B9E6E] to-[#D4A843]/90"
                }`}
                style={{
                  width: `${
                    Number.isFinite(listingLimit) && listingLimit > 0
                      ? Math.min(100, (ownedListingCount / listingLimit) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-xs font-bold uppercase tracking-wide ${atCoListLimit ? "text-[#8a6d32]" : "text-[#2C2C2C]/80"}`}>
                Co-listings
              </p>
              <p
                className={`text-sm font-bold tabular-nums ${atCoListLimit ? "text-[#B8860B]" : "text-[#2C2C2C]/80"}`}
              >
                {coListedCount}/{Number.isFinite(coListLimit) ? coListLimit : "∞"} used
              </p>
            </div>
            <div
              className={`mt-2 h-2 w-full overflow-hidden rounded-full ${
                atCoListLimit ? "bg-[#D4A843]/25" : "bg-[#EBE6DC]"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  atCoListLimit
                    ? "bg-gradient-to-r from-[#D4AF37] to-[#D4A843]"
                    : "bg-gradient-to-r from-[#6B9E6E] to-[#D4A843]/90"
                }`}
                style={{
                  width: `${
                    Number.isFinite(coListLimit) && coListLimit > 0
                      ? Math.min(100, (coListedCount / coListLimit) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {atListingLimit || atCoListLimit ? (
            <p className="mt-3 text-xs font-semibold text-[#8a6d32]">
              You are at a plan limit. Compare tiers on the{" "}
              <Link href="/pricing" className="underline underline-offset-2 hover:text-[#2C2C2C]">
                pricing page
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#2C2C2C]">Profile completeness</p>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#EBE6DC]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6B9E6E] to-[#D4A843] transition-all"
            style={{ width: `${profileComplete.pct}%` }}
          />
        </div>
        <ul className="mt-4 space-y-2">
          {profileComplete.checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm font-semibold text-[#2C2C2C]/75">
              <span className={c.ok ? "text-[#6B9E6E]" : "text-[#2C2C2C]/25"}>
                {c.ok ? <Check className="h-4 w-4" /> : "○"}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        {incomplete && identityVerified ? (
          <p className="mt-4 rounded-xl bg-[#D4A843]/12 px-4 py-3 text-sm font-semibold text-[#8a6d32]">
            Complete your profile to get more leads — add a photo, bio, specialties, and your first listing.
          </p>
        ) : null}
      </div>

      {identityVerified ? (
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-serif text-lg font-bold text-[#2C2C2C]">Recent leads</p>
            <span className="text-xs font-semibold text-[#2C2C2C]/45">Last 5</span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-[#2C2C2C]/45">No leads yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#2C2C2C]/10">
              {recent.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-[#2C2C2C]">{l.name}</p>
                    <p className="text-xs font-semibold text-[#2C2C2C]/45">{l.email}</p>
                  </div>
                  <span className="rounded-full bg-[#6B9E6E]/12 px-2 py-1 text-xs font-bold text-[#2C2C2C]/70">
                    {labelForStage(l.stage)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
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

function mapAiPropertyTypeToForm(raw: unknown): string {
  const k = String(raw ?? "condo")
    .toLowerCase()
    .trim();
  const map: Record<string, string> = {
    condo: "Condo",
    house: "House",
    apartment: "Apartment",
    townhouse: "Townhouse",
    commercial: "Commercial",
    land: "Land",
    presale: "Presale",
    villa: "Villa",
    studio: "Studio",
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
    beds: string;
    baths: string;
    sqft: string;
    description: string;
    listingImageUrls: string[];
    property_type: string;
    listing_type: "sale" | "rent";
    developer_name: string;
    turnover_date: string;
    unit_types: string[];
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
  const visibleProperties = useMemo(() => {
    if (listingKindFilter === "presale") return properties.filter((p) => p.is_presale);
    if (listingKindFilter === "sale")
      return properties.filter((p) => p.status === "for_sale" && !p.is_presale);
    if (listingKindFilter === "rent") return properties.filter((p) => p.status === "for_rent");
    return properties;
  }, [properties, listingKindFilter]);

  const listingCompleteness = useMemo(
    () => computeListingCompleteness(listingForm, listingForm.listingImageUrls),
    [listingForm],
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
      const listingType =
        String(d.listing_type ?? "sale").toLowerCase().trim() === "rent" ? "rent" : "sale";
      const isPs = Boolean(d.is_presale);
      const propType = isPs ? "Presale" : mapAiPropertyTypeToForm(d.property_type);

      setListingForm((f) => ({
        ...f,
        name: typeof d.name === "string" ? d.name : f.name,
        location: typeof d.location === "string" ? d.location : f.location,
        price:
          Number.isFinite(priceNum) && priceNum > 0
            ? formatPriceInputDigits(String(priceNum))
            : f.price,
        beds: String(bedsN),
        baths: String(bathsN),
        sqft: String(sqftN),
        description: typeof d.description === "string" ? d.description : f.description,
        property_type: propType,
        listing_type: propType === "Presale" ? "sale" : listingType,
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
          <div className="mt-4 flex flex-wrap gap-2">
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
        {visibleProperties.map((p) => (
          <div
            key={p.id}
            className="relative overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm transition hover:shadow-md"
          >
            <Link href={`/properties/${encodeURIComponent(p.id)}`} className="block">
              <div className="relative h-40 w-full bg-black/5">
                <Image src={p.image_url} alt="" fill className="object-cover" sizes="400px" />
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${
                    p.is_presale ? "bg-[#D4A843] text-[#2C2C2C]" : "bg-[#6B9E6E] text-white"
                  }`}
                >
                  {p.is_presale ? "Presale" : p.status === "for_rent" ? "For Rent" : "For Sale"}
                </span>
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
                <p className="font-semibold text-[#2C2C2C]">{p.location}</p>
                <p className="mt-1 font-serif text-lg font-bold text-[#2C2C2C]">
                  {formatListingPricePhp(p.price, p.status)}
                </p>
              </div>
            </Link>
            {!p.isCoHost && propertyExpiryBadgeInfo(p.expires_at)?.showRenew ? (
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
                  title={!canAddListing ? "Get verified to manage your listings" : undefined}
                  className={!canAddListing ? "cursor-not-allowed" : undefined}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void onEditListing(p);
                    }}
                    className={`rounded-full border border-[#6B9E6E]/25 bg-white/95 px-3 py-1.5 text-xs font-bold text-[#2C2C2C] shadow-sm hover:bg-[#6B9E6E]/12 ${
                      !canAddListing ? "cursor-not-allowed opacity-40 pointer-events-none" : ""
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
                    disabled={deletingPropertyId === p.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void onDeleteProperty(p.id);
                    }}
                    className={`rounded-full border border-red-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 ${
                      !canAddListing ? "cursor-not-allowed opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    {deletingPropertyId === p.id ? "Deleting…" : "Delete"}
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
        ))}
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
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">New listing</h2>
                <button type="button" onClick={() => setListingOpen(false)} className="rounded-full p-2 hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
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
                  <PhLocationInput
                    required
                    value={listingForm.location}
                    onChange={(v) => setListingForm((f) => ({ ...f, location: v }))}
                    placeholder="e.g. BGC, Taguig"
                    className="mt-1 w-full"
                    inputClassName="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
                {listingFormErrors.location ? (
                  <p className="text-sm font-semibold text-red-600">{listingFormErrors.location}</p>
                ) : null}
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Title (optional)
                  <input
                    value={listingForm.name}
                    onChange={(e) => setListingForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Price
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
                    {EDIT_PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
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
                        listing_type: e.target.value === "rent" ? "rent" : "sale",
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <option value="sale">For sale</option>
                    <option value="rent">For rent</option>
                  </select>
                </label>
                <PropertyListingImagesInput
                  userId={userId}
                  value={listingForm.listingImageUrls}
                  onChange={(urls) => setListingForm((f) => ({ ...f, listingImageUrls: urls }))}
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

type TeamMemberRow = {
  id: string;
  assistant_email: string;
  assistant_name: string | null;
  status: string;
  created_at: string;
};

function MyTeamSection({
  agentId,
  agentName,
  supabase,
  teamMemberLimit,
}: {
  agentId: string;
  agentName: string;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  teamMemberLimit: number;
}) {
  const [rows, setRows] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [assistantDisplayName, setAssistantDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_team_members")
      .select("id, assistant_email, assistant_name, status, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as TeamMemberRow[]);
  }, [agentId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const atTeamLimit = Number.isFinite(teamMemberLimit) && rows.length >= teamMemberLimit;

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (atTeamLimit) {
      toast.error(
        Number.isFinite(teamMemberLimit) && teamMemberLimit === 0
          ? "Your plan does not include team seats. Upgrade on the pricing page to invite assistants."
          : `You've reached your plan limit of ${teamMemberLimit} team member${teamMemberLimit === 1 ? "" : "s"}.`,
      );
      return;
    }
    const em = email.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("agent_team_members").insert({
      agent_id: agentId,
      assistant_email: em,
      assistant_name: assistantDisplayName.trim() || null,
      status: "invited",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      "Invitation saved. If they have a BahayGo account with that email, they’ll get an in-app notification.",
    );
    setEmail("");
    setAssistantDisplayName("");
    void load();
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    const { error } = await supabase.from("agent_team_members").delete().eq("id", id);
    setRemovingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed from team");
    void load();
  };

  return (
    <section className="mt-10 max-w-xl rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/15 text-[#2C2C2C]">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">My Team</h2>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/60">
            Add showing assistants by email. They appear as <span className="text-[#2C2C2C]">Showing Assistant</span>{" "}
            under you. Invites notify them in-app when their email matches a BahayGo account.
          </p>
          <p className="mt-2 text-xs font-semibold text-[#2C2C2C]/50">
            Team seats: {rows.length}/
            {Number.isFinite(teamMemberLimit) ? teamMemberLimit : "∞"} on your plan
            {Number.isFinite(teamMemberLimit) && teamMemberLimit === 0 ? " — upgrade to Pro or higher for seats." : "."}
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void addMember(e)} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="assistant@example.com"
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
            autoComplete="off"
          />
        </label>
        <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Name (optional)
          <input
            value={assistantDisplayName}
            onChange={(e) => setAssistantDisplayName(e.target.value)}
            placeholder="First Last"
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
          />
        </label>
        <button
          type="submit"
          disabled={saving || atTeamLimit}
          className="shrink-0 rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </form>

      <div className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
        {loading ? (
          <p className="text-sm font-semibold text-[#2C2C2C]/50">Loading team…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm font-semibold text-[#2C2C2C]/50">No assistants yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">{r.assistant_email}</p>
                  {r.assistant_name ? (
                    <p className="truncate text-xs font-semibold text-[#2C2C2C]/55">{r.assistant_name}</p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#6B9E6E]">
                    Showing Assistant · {r.status}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removingId === r.id}
                  onClick={() => void remove(r.id)}
                  className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  {removingId === r.id ? "…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-[11px] font-semibold text-[#2C2C2C]/45">
        Listing agent: {agentName}. Permissions for assistants are coming later.
      </p>
    </section>
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
  const showAvailableNow = isAgentAvailableNow(agent.availability);

  const setAvailableNow = async (on: boolean) => {
    setAvailSaving(true);
    onAvailabilityMessage("");
    const { error } = await supabase
      .from("agents")
      .update({ availability: on ? AGENT_AVAILABILITY_NOW : AGENT_AVAILABILITY_OFFLINE })
      .eq("user_id", userId);
    setAvailSaving(false);
    if (error) {
      onAvailabilityMessage(error.message);
      return;
    }
    onAvailabilityMessage(on ? "You’re shown as Available Now on listings." : "You’re shown as Offline. Last seen was updated.");
    await onAvailabilitySaved();
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Profile settings</h1>
      <form onSubmit={onSave} className="mt-8 max-w-xl space-y-5 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Photo</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[#EBE6DC] ring-2 ring-[#D4A843]/30">
              {agent.image_url ? (
                <SupabasePublicImage src={agent.image_url} alt="" fill className="object-cover" sizes="80px" />
              ) : null}
            </div>
            <label className="cursor-pointer rounded-full border border-[#6B9E6E] bg-[#6B9E6E]/10 px-4 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#6B9E6E]/20">
              Upload
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
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-4 py-3">
          <div>
            <p className="text-sm font-bold text-[#2C2C2C]">Show as Available Now</p>
            <p className="mt-0.5 text-xs font-semibold text-[#2C2C2C]/55">
              When off, buyers see you as Offline with last seen time.
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
        <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Name
          <input
            required
            value={profileForm.name}
            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
        </label>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45" htmlFor="agent-dash-phone">
            Phone
          </label>
          <PhPhoneInput
            id="agent-dash-phone"
            value={profileForm.phone}
            onChange={(v) => setProfileForm((f) => ({ ...f, phone: v }))}
            className="mt-1"
            inputClassName="border-black/10 bg-[#FAF8F4] font-semibold"
          />
        </div>
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">License (read-only)</p>
          <p className="mt-1 font-semibold text-[#2C2C2C]">{agent.license_number}</p>
          <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
            Expires: {agent.license_expiry ? formatLicenseDate(agent.license_expiry) : "—"}
          </p>
          <LicenseExpiryBadge licenseExpiry={agent.license_expiry} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
            Age
            <input
              type="number"
              min={18}
              max={80}
              inputMode="numeric"
              value={profileForm.age}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, age: e.target.value.replace(/\D/g, "").slice(0, 2) }))
              }
              placeholder="18–80"
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
            Years of experience
            <input
              type="number"
              min={0}
              max={50}
              inputMode="numeric"
              value={profileForm.yearsExperience}
              onChange={(e) =>
                setProfileForm((f) => ({
                  ...f,
                  yearsExperience: e.target.value.replace(/\D/g, "").slice(0, 2),
                }))
              }
              placeholder="0–50"
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
            />
          </label>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Languages spoken</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((lang) => {
              const on = profileForm.languages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() =>
                    setProfileForm((f) => ({
                      ...f,
                      languages: toggleProfileMulti(f.languages, lang),
                    }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    on
                      ? "bg-[#6B9E6E] text-white"
                      : "border border-[#2C2C2C]/15 bg-[#FAF8F4] text-[#2C2C2C]/75 hover:bg-white"
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Specialties</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map((spec) => {
              const on = profileForm.specialties.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() =>
                    setProfileForm((f) => ({
                      ...f,
                      specialties: toggleProfileMulti(f.specialties, spec),
                    }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    on
                      ? "bg-[#D4A843] text-[#2C2C2C]"
                      : "border border-[#2C2C2C]/15 bg-[#FAF8F4] text-[#2C2C2C]/75 hover:bg-white"
                  }`}
                >
                  {spec}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Service areas</p>
          <div className="mt-2">
            <ServiceAreasMultiInput
              id="profile-service-areas"
              values={profileForm.serviceAreaTags}
              onChange={(values) => setProfileForm((f) => ({ ...f, serviceAreaTags: values }))}
              draft={profileForm.serviceAreaDraft}
              onDraftChange={(v) => setProfileForm((f) => ({ ...f, serviceAreaDraft: v }))}
            />
          </div>
        </div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Bio / About
          <textarea
            value={profileForm.bio}
            onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value.slice(0, 500) }))}
            rows={5}
            maxLength={500}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
          <span className="mt-1 block text-right text-[11px] font-semibold text-[#2C2C2C]/45">
            {profileForm.bio.length}/500
          </span>
        </label>
        <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Social links</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[#2C2C2C]/55 sm:col-span-2">
            Facebook
            <input
              type="url"
              placeholder="https://facebook.com/…"
              value={profileForm.facebook}
              onChange={(e) => setProfileForm((f) => ({ ...f, facebook: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
            />
          </label>
          <label className="text-xs font-semibold text-[#2C2C2C]/55">
            Instagram
            <input
              type="url"
              placeholder="https://instagram.com/…"
              value={profileForm.instagram}
              onChange={(e) => setProfileForm((f) => ({ ...f, instagram: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
            />
          </label>
          <label className="text-xs font-semibold text-[#2C2C2C]/55">
            LinkedIn
            <input
              type="url"
              placeholder="https://linkedin.com/in/…"
              value={profileForm.linkedin}
              onChange={(e) => setProfileForm((f) => ({ ...f, linkedin: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
            />
          </label>
          <label className="text-xs font-semibold text-[#2C2C2C]/55 sm:col-span-2">
            Website (optional)
            <input
              type="url"
              placeholder="https://…"
              value={profileForm.website}
              onChange={(e) => setProfileForm((f) => ({ ...f, website: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      <MyTeamSection
        agentId={agent.id}
        agentName={agent.name}
        supabase={supabase}
        teamMemberLimit={teamMemberLimitForTier(listingTier)}
      />

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, created_at, type, title, body, read_at, metadata")
        .eq("user_id", userId)
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
              <NotificationCard n={n} onMarkRead={markRead} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
