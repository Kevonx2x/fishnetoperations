"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { Heart, LayoutGrid, MapPin, Pin as LucidePin, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { usePropertyEngagementForProperties } from "@/hooks/use-property-engagement";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { recordRecentlyViewedPropertyId } from "@/lib/recently-viewed";
import { CoListVerificationRequiredModal } from "@/components/marketplace/co-list-verification-required-modal";
import { ViewingAgentPickerModal } from "@/components/marketplace/viewing-agent-picker-modal";
import { ViewingRequestModal } from "@/components/marketplace/viewing-request-modal";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";
import { AgentContactOptionsModal } from "@/components/marketplace/agent-contact-options-modal";
import { AgentAvailabilityBadge } from "@/components/marketplace/agent-availability-badge";
import { ListingLimitUpgradeModal } from "@/components/marketplace/listing-limit-upgrade-modal";
import { CoListRequestModal } from "@/components/marketplace/co-list-request-modal";
import { useAuth } from "@/contexts/auth-context";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { coListLimitForTier, listingLimitForTier } from "@/lib/agent-listing-limits";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { GalleryNavButton } from "@/components/ui/gallery-nav-button";
import { cn } from "@/lib/utils";
import {
  propertyDetailAvailabilityBanner,
  propertyEngagementLooksUnavailable,
} from "@/lib/property-availability";
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  Pin,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useMarkerRef,
} from "@vis.gl/react-google-maps";
import { toast } from "sonner";
import { resolveListingAgentUserId } from "@/lib/resolve-listing-agent-user-id";
import { clientMessagesHref } from "@/lib/messenger/client-messages-path";
import { startMessengerConversation } from "@/lib/messenger/start-conversation-client";
import { PropertyMobileStickyActions } from "@/components/marketplace/property-mobile-sticky-actions";
import { BahayGoPropertyPageMobile } from "@/components/marketplace/bahaygo-property-page-mobile";
import { BahayGoPropertyPageDesktop } from "@/components/marketplace/bahaygo-property-page-desktop";
import { useMobileStickyFooter } from "@/contexts/mobile-chrome-context";
import { MOBILE_CONTENT_PAD_WITH_STICKY_ACTIONS_CLASS } from "@/lib/mobile-bottom-nav-layout";

type ListingAgentProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
} | null;

const LISTING_IMAGE_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" as const;

type PropertyRow = {
  id: string;
  created_at: string;
  name: string | null;
  location: string;
  price: string;
  status: "for_sale" | "for_rent" | "sold" | "rented" | "both";
  listing_type?: "sale" | "rent" | "both" | null;
  rent_price?: string | null;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  listed_by: string | null;
  property_type: string | null;
  lat: number | null;
  lng: number | null;
  formatted_address?: string | null;
  description: string | null;
  is_presale?: boolean;
  developer_name?: string | null;
  turnover_date?: string | null;
  unit_types?: string[] | null;
  listing_agent: ListingAgentProfile;
  property_agents?: { agent: unknown }[];
  property_photos?: { url: string; sort_order: number }[];
  availability_state?: string | null;
  deleted_at?: string | null;
  is_demo?: boolean | null;
};

function formatPresaleTurnoverMonthYear(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function listingAgentUserId(property: PropertyRow, agents: MarketplaceAgent[]): string | null {
  if (property.listed_by) {
    const match = agents.find((a) => a.userId === property.listed_by);
    if (match) return property.listed_by;
  }
  return agents[0]?.userId ?? null;
}

function buildAllPhotos(property: PropertyRow): string[] {
  return (property.property_photos ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((x) => String(x.url || "").trim())
    .filter((u) => u.length > 0);
}

function isValidMapCoordinate(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export default function PropertyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const isAdminViewer = profile?.role === "admin" || profile?.role === "ops_admin";

  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [selectedViewingAgentUserId, setSelectedViewingAgentUserId] = useState<string | null>(null);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactModalAgent, setContactModalAgent] = useState<MarketplaceAgent | null>(null);
  const [listingLimitModalOpen, setListingLimitModalOpen] = useState(false);
  const [coAgentMsg, setCoAgentMsg] = useState<string | null>(null);
  const [coAgentSubmitting, setCoAgentSubmitting] = useState(false);
  const [coAgentConfirmOpen, setCoAgentConfirmOpen] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [myAgent, setMyAgent] = useState<{
    id: string;
    listing_tier: string | null;
    status: string;
    verified: boolean | null;
    license_number: string | null;
    verification_status: string | null;
  } | null>(null);
  const [myCoListCount, setMyCoListCount] = useState(0);
  const [hasPendingCoRequest, setHasPendingCoRequest] = useState(false);
  const [presaleName, setPresaleName] = useState("");
  const [presaleEmail, setPresaleEmail] = useState("");
  const [presalePhone, setPresalePhone] = useState("");
  const [presaleUnit, setPresaleUnit] = useState("");
  const [presaleBusy, setPresaleBusy] = useState(false);
  const [presaleMsg, setPresaleMsg] = useState<string | null>(null);
  const [messageBusy, setMessageBusy] = useState(false);

  useEffect(() => {
    if (showVerificationModal) {
      console.log("Modal should be open");
    }
  }, [showVerificationModal]);

  const { engagement } = usePropertyEngagementForProperties(property ? [property] : []);

  const agentEngagementLocked = profile?.role === "agent";

  useEffect(() => {
    if (typeof window === "undefined" || !property) return;
    if (window.location.hash !== "#agents-section") return;
    const t = window.setTimeout(() => {
      document.getElementById("agents-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 2000);
    return () => window.clearTimeout(t);
  }, [property?.id]);

  const isLoggedIn = !authLoading && !!user;
  const ownedListingLimit = listingLimitForTier(myAgent?.listing_tier);
  const coListLimit = coListLimitForTier(myAgent?.listing_tier);
  const atCoListLimit = myCoListCount >= coListLimit;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          id, created_at, name, location, price, rent_price, listing_type, status, sqft, beds, baths, image_url, listed_by, property_type, lat, lng, formatted_address, description,
          is_presale, developer_name, turnover_date, unit_types, availability_state, deleted_at, is_demo,
          property_photos (url, sort_order),
          listing_agent:profiles!listed_by (id, full_name, avatar_url),
          property_agents (
            agent:agents (
              id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at,
              verified, status,
              agencies (id, company_name, logo_url),
              profiles(email, phone)
            )
          )
        `,
        )
        .eq("id", id)
        .or(publicListingExpiryOrFilter())
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setProperty(null);
      } else {
        const next = (data ?? null) as unknown as PropertyRow | null;
        if (
          next &&
          next.is_demo === true &&
          !isAdminViewer &&
          !(user?.id && next.listed_by && user.id === next.listed_by)
        ) {
          setProperty(null);
          setError("This listing is not available.");
        } else if (next) {
          // Avatar source of truth is profiles.avatar_url; keep a safety-net fallback for legacy agent photos.
          if (
            next.listed_by &&
            next.listing_agent &&
            !String(next.listing_agent.avatar_url ?? "").trim()
          ) {
            try {
              const { data: agentRow } = await supabase
                .from("agents")
                .select("image_url")
                .eq("user_id", next.listed_by)
                .maybeSingle();
              const fallback = (agentRow?.image_url as string | null | undefined)?.trim() || "";
              if (fallback && next.listing_agent) {
                (next.listing_agent as { avatar_url?: string | null }).avatar_url = fallback;
              }
            } catch {
              /* ignore */
            }
          }
          setProperty(next);
          if (next.id) recordRecentlyViewedPropertyId(next.id);
        } else {
          setProperty(null);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id, profile?.role, isAdminViewer]);

  useEffect(() => {
    if (!user?.id || authLoading) {
      setMyAgent(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, listing_tier, status, verified, license_number, verification_status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setMyAgent(
          data
            ? (data as {
                id: string;
                listing_tier: string | null;
                status: string;
                verified: boolean | null;
                license_number: string | null;
                verification_status: string | null;
              })
            : null,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (!user?.id || !myAgent?.id) {
      setMyCoListCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: ownedRows }, { data: paRows }] = await Promise.all([
        supabase.from("properties").select("id").eq("listed_by", user.id),
        supabase.from("property_agents").select("property_id").eq("agent_id", myAgent.id),
      ]);
      if (cancelled) return;
      const ownedIds = new Set((ownedRows ?? []).map((p) => p.id));
      const coCount = (paRows ?? []).filter((row) => !ownedIds.has(row.property_id)).length;
      setMyCoListCount(coCount);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, myAgent?.id]);

  useEffect(() => {
    if (!property?.id || !myAgent?.id) {
      setHasPendingCoRequest(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("co_agent_requests")
        .select("id")
        .eq("property_id", property.id)
        .eq("agent_id", myAgent.id)
        .eq("status", "pending")
        .maybeSingle();
      if (!cancelled) setHasPendingCoRequest(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [property?.id, myAgent?.id]);

  const allPhotos = useMemo(() => (property ? buildAllPhotos(property) : []), [property]);
  /** When there are no `property_photos` rows, hero uses `properties.image_url` if set; otherwise a gray block. */
  const noGalleryFallbackHeroSrc = useMemo(() => {
    if (!property || allPhotos.length > 0) return "";
    const u = String(property.image_url ?? "").trim();
    if (!u) return "";
    return u;
  }, [property, allPhotos.length]);
  /** Hero image URL; thumbnails call setActivePhoto(url). */
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (allPhotos.length === 0) {
      setActivePhoto(null);
      return;
    }
    setActivePhoto((prev) => {
      const norm = (s: string) => String(s).trim();
      if (prev && allPhotos.some((u) => norm(String(u)) === norm(prev))) return prev;
      return norm(String(allPhotos[0]));
    });
  }, [property?.id, allPhotos]);

  const heroIndex = useMemo(() => {
    if (allPhotos.length === 0 || !activePhoto) return 0;
    const idx = allPhotos.findIndex((u) => String(u).trim() === String(activePhoto).trim());
    return idx >= 0 ? idx : 0;
  }, [allPhotos, activePhoto]);

  const heroDisplaySrc = useMemo(() => {
    if (allPhotos.length === 0) return "";
    const raw =
      activePhoto && allPhotos.some((u) => String(u).trim() === String(activePhoto).trim())
        ? activePhoto
        : allPhotos[0];
    return String(raw).trim();
  }, [allPhotos, activePhoto]);

  const openLightbox = useCallback(
    (startIndex?: number) => {
      if (allPhotos.length === 0) return;
      const n = allPhotos.length;
      let i = heroIndex;
      if (typeof startIndex === "number" && Number.isFinite(startIndex)) {
        const r = Math.trunc(startIndex);
        if (r >= 0 && r < n) i = r;
      }
      setLightboxInitialIndex(i);
      setLightboxOpen(true);
    },
    [allPhotos.length, heroIndex],
  );

  const goPrevPhoto = useCallback(() => {
    if (allPhotos.length < 2) return;
    const i = heroIndex;
    if (i <= 0) return;
    setActivePhoto(String(allPhotos[i - 1]).trim());
  }, [allPhotos, heroIndex]);

  const goNextPhoto = useCallback(() => {
    if (allPhotos.length < 2) return;
    const i = heroIndex;
    if (i >= allPhotos.length - 1) return;
    setActivePhoto(String(allPhotos[i + 1]).trim());
  }, [allPhotos, heroIndex]);

  useEffect(() => {
    if (!property || allPhotos.length < 2 || lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevPhoto();
      } else {
        e.preventDefault();
        goNextPhoto();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [property, allPhotos.length, lightboxOpen, goPrevPhoto, goNextPhoto]);

  const connectedAgents = useMemo(() => {
    if (!property) return [];
    const raw = property.property_agents ?? [];
    const mapped = raw
      .map((row) => row.agent)
      .filter(Boolean)
      .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]));
    const seen = new Set<string>();
    return mapped.filter((a) => {
      if (!a.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [property]);

  const listingAgent = useMemo(() => {
    if (!property?.listed_by) return connectedAgents[0] ?? null;
    return connectedAgents.find((a) => a.userId === property.listed_by) ?? connectedAgents[0] ?? null;
  }, [property?.listed_by, connectedAgents]);

  const isConnectedAsAgent = useMemo(() => {
    if (!myAgent?.id) return false;
    return connectedAgents.some((a) => a.id === myAgent.id);
  }, [myAgent?.id, connectedAgents]);

  /** True when the signed-in user is the listing owner (listed_by) or a connected agent on this property. */
  const isListingAgentUser = useMemo(() => {
    if (!user?.id || !property) return false;
    if (property.listed_by && user.id === property.listed_by) return true;
    return connectedAgents.some((a) => a.userId === user.id);
  }, [user?.id, property?.listed_by, connectedAgents]);

  const showCoAgentPendingBanner = useMemo(() => {
    if (!isLoggedIn || profile?.role !== "agent" || !myAgent) return false;
    if (isConnectedAsAgent) return false;
    return hasPendingCoRequest;
  }, [isLoggedIn, profile?.role, myAgent, isConnectedAsAgent, hasPendingCoRequest]);

  const showCoAgentRequestButton = useMemo(() => {
    if (!isLoggedIn || profile?.role !== "agent" || !myAgent) return false;
    if (property?.listed_by && user?.id === property.listed_by) return false;
    if (myAgent.status !== "approved" || !myAgent.license_number?.trim()) return false;
    if (myAgent.verification_status !== "verified") return false;
    if (isConnectedAsAgent) return false;
    if (hasPendingCoRequest) return false;
    return true;
  }, [isLoggedIn, profile?.role, myAgent, isConnectedAsAgent, hasPendingCoRequest, property?.listed_by, user?.id]);

  const showCoListNeedsVerificationPanel = useMemo(() => {
    if (!isLoggedIn || profile?.role !== "agent" || !myAgent) return false;
    if (property?.listed_by && user?.id === property.listed_by) return false;
    if (myAgent.status !== "approved" || !myAgent.license_number?.trim()) return false;
    if (myAgent.verification_status === "verified") return false;
    if (isConnectedAsAgent) return false;
    if (hasPendingCoRequest) return false;
    return true;
  }, [isLoggedIn, profile?.role, myAgent, isConnectedAsAgent, hasPendingCoRequest, property?.listed_by, user?.id]);

  const requestCoAgentJoin = async (message: string) => {
    if (!property?.id || !myAgent?.id) return;
    if (myAgent.verification_status !== "verified") return;
    setCoAgentMsg(null);
    if (atCoListLimit) {
      setCoAgentConfirmOpen(false);
      setListingLimitModalOpen(true);
      return;
    }
    setCoAgentSubmitting(true);
    const { error } = await supabase.from("co_agent_requests").insert({
      property_id: property.id,
      agent_id: myAgent.id,
    });
    setCoAgentSubmitting(false);
    if (error) {
      setCoAgentMsg(error.message);
      return;
    }
    setHasPendingCoRequest(true);
    setCoAgentConfirmOpen(false);
    void fetch("/api/notify-co-agent-request", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property.id, message: message.trim() ? message.trim() : undefined }),
    }).catch(() => {});
    toast.success("Co-list request sent");
  };

  const similar = useMemo(() => {
    // lightweight similar list: same inferred type or just top few newest
    return [] as PropertyRow[];
  }, []);

  const hideListingClientActions = useMemo(
    () => (property ? propertyEngagementLooksUnavailable(property) : false),
    [property],
  );

  const availabilityBanner = useMemo(
    () => (property ? propertyDetailAvailabilityBanner(property.availability_state) : null),
    [property],
  );

  const onRequestViewing = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      setSignInPromptOpen(true);
      return;
    }
    if (connectedAgents.length === 0) return;
    if (connectedAgents.length === 1) {
      setSelectedViewingAgentUserId(connectedAgents[0].userId);
      setShowViewingModal(true);
      return;
    }
    setShowAgentPicker(true);
  }, [authLoading, connectedAgents, user]);

  const showMobileStickyActions = Boolean(
    property &&
      !isListingAgentUser &&
      !property.is_presale &&
      !hideListingClientActions,
  );

  const { setStickyFooter } = useMobileStickyFooter();

  const onMessageAgent = useCallback(async () => {
    if (authLoading || messageBusy) return;
    if (!user) {
      setSignInPromptOpen(true);
      return;
    }
    if (connectedAgents.length === 0) return;

    const agentUserId = listingAgentUserId(property!, connectedAgents);
    if (!agentUserId || user.id === agentUserId) return;

    if (profile?.role === "agent") {
      const agent = listingAgent ?? connectedAgents[0];
      if (agent) {
        setContactModalAgent(agent);
        setShowContactModal(true);
      }
      return;
    }

    setMessageBusy(true);
    try {
      const result = await startMessengerConversation({
        otherUserId: agentUserId,
        propertyId: property!.id,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(clientMessagesHref(result.conversationId));
    } finally {
      setMessageBusy(false);
    }
  }, [
    authLoading,
    connectedAgents,
    listingAgent,
    messageBusy,
    profile?.role,
    property,
    router,
    user,
  ]);

  useEffect(() => {
    if (!showMobileStickyActions) {
      setStickyFooter(null);
      return;
    }
    setStickyFooter(
      <PropertyMobileStickyActions
        variant="editorial"
        onScheduleViewing={onRequestViewing}
        scheduleDisabled={authLoading || connectedAgents.length === 0}
      />,
    );
  }, [
    authLoading,
    connectedAgents.length,
    onRequestViewing,
    setStickyFooter,
    showMobileStickyActions,
  ]);

  useEffect(() => () => setStickyFooter(null), [setStickyFooter]);

  useEffect(() => {
    if (!property?.is_presale || typeof window === "undefined") return;
    if (window.location.hash !== "#presale-interest") return;
    window.requestAnimationFrame(() => {
      document.getElementById("presale-interest")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [property?.id, property?.is_presale]);

  const submitPresaleInterest = async () => {
    if (!property?.listed_by) {
      setPresaleMsg("Listing owner not available.");
      return;
    }
    setPresaleMsg(null);
    if (!presaleName.trim() || !presaleEmail.trim()) {
      setPresaleMsg("Please enter your name and email.");
      return;
    }
    if (!presaleUnit.trim()) {
      setPresaleMsg("Please select a preferred unit type.");
      return;
    }
    setPresaleBusy(true);
    try {
      const agentUserId = await resolveListingAgentUserId(supabase, property.id);
      if (!agentUserId) {
        setPresaleMsg("This listing has no assigned agent. Interest cannot be submitted.");
        return;
      }
      const { error } = await supabase.from("leads").insert({
        name: presaleName.trim(),
        email: presaleEmail.trim(),
        phone: presalePhone.trim() ? presalePhone.trim() : null,
        property_id: property.id,
        agent_id: agentUserId,
        property_interest: property.name?.trim() || property.location,
        message: `Preferred unit type: ${presaleUnit.trim()}`,
        source: "presale_interest",
        stage: "new",
        client_id: null,
        broker_id: null,
      });
      if (error) throw error;
      setPresaleMsg("Thanks â€” weâ€™ll be in touch shortly.");
      setPresaleName("");
      setPresaleEmail("");
      setPresalePhone("");
      setPresaleUnit("");
    } catch (e) {
      setPresaleMsg(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setPresaleBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-12 max-md:bg-[#FAF8F4] max-md:pb-0">
      <MaddenTopNav compactMobileHome />

      <main
        className={cn(
          "mx-auto max-w-6xl px-4 pb-12 pt-2 md:pt-4",
          showMobileStickyActions ? MOBILE_CONTENT_PAD_WITH_STICKY_ACTIONS_CLASS : "max-md:pb-20",
        )}
      >
        <div className="mb-2 hidden text-xs font-semibold text-[#2C2C2C]/65 md:mb-4 md:block md:text-sm">
          <Link href="/" className="hover:text-[#2C2C2C]">Home</Link> <span>Â·</span>{" "}
          <span className="text-[#2C2C2C]">Property</span>
        </div>

        {loading && <div className="h-80 rounded-2xl animate-pulse bg-black/5 lg:h-[500px]" />}

        {!loading && error && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldnâ€™t load property</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        )}

        {!loading && !error && !property && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center">
            <p className="font-serif text-lg font-bold text-[#2C2C2C]">Listing unavailable</p>
            <p className="mt-2 text-sm text-[#2C2C2C]/60">
              This property is no longer listed or may have expired.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5d8a60]"
            >
              Back to home
            </Link>
          </div>
        )}

        {!loading && !error && property && (
          <>
            <div className="md:hidden">
              <BahayGoPropertyPageMobile
                property={property}
                allPhotos={allPhotos}
                heroIndex={heroIndex}
                heroDisplaySrc={heroDisplaySrc}
                fallbackHeroSrc={noGalleryFallbackHeroSrc}
                onPrevPhoto={goPrevPhoto}
                onNextPhoto={goNextPhoto}
                onSelectPhoto={(i) => setActivePhoto(String(allPhotos[i]).trim())}
                onOpenLightbox={openLightbox}
                engagement={engagement}
                agentEngagementLocked={agentEngagementLocked}
                hideListingClientActions={hideListingClientActions}
                availabilityBanner={availabilityBanner}
                listingAgent={listingAgent}
                connectedAgents={connectedAgents}
                isListingAgentUser={isListingAgentUser}
                onCheckAvailability={onRequestViewing}
                onMessageAgent={() => void onMessageAgent()}
                messageBusy={messageBusy}
                authLoading={authLoading}
                locationSection={<PropertyDetailLocationSection property={property} />}
                presaleSection={
                  property.is_presale ? (
                    <div className="rounded-2xl border border-[#D4A843]/25 bg-[#FFF9F0] p-4 shadow-sm">
                      <h2 className="font-serif text-lg font-semibold text-[#2C2C2C]">Register interest</h2>
                      <p className="mt-1 text-xs font-medium text-[#888888]">
                        Leave your details and preferred unit. The listing agent will follow up.
                      </p>
                      {!hideListingClientActions ? (
                        <>
                          <div className="mt-3 space-y-2">
                            <label className="block text-xs font-semibold text-[#888888]">
                              Name
                              <input
                                value={presaleName}
                                onChange={(e) => setPresaleName(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C]"
                                autoComplete="name"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-[#888888]">
                              Email
                              <input
                                type="email"
                                value={presaleEmail}
                                onChange={(e) => setPresaleEmail(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C]"
                                autoComplete="email"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-[#888888]">
                              Phone
                              <input
                                type="tel"
                                value={presalePhone}
                                onChange={(e) => setPresalePhone(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C]"
                                autoComplete="tel"
                              />
                            </label>
                            <label className="block text-xs font-semibold text-[#888888]">
                              Preferred unit type
                              <select
                                value={presaleUnit}
                                onChange={(e) => setPresaleUnit(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C]"
                              >
                                <option value="">Selectâ€¦</option>
                                {(property.unit_types && property.unit_types.length > 0
                                  ? property.unit_types
                                  : ["Studio", "1BR", "2BR", "3BR", "4BR+"]
                                ).map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {presaleMsg ? (
                            <p
                              className={`mt-2 text-xs font-semibold ${
                                presaleMsg.startsWith("Thanks") ? "text-[#6B9E6E]" : "text-red-700"
                              }`}
                            >
                              {presaleMsg}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void submitPresaleInterest()}
                            disabled={presaleBusy || !property.listed_by}
                            className="mt-4 w-full rounded-xl bg-[#6B9E6E] px-5 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                          >
                            {presaleBusy ? "Sendingâ€¦" : "Register interest"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null
                }
                agentAsideSection={
                  <>
                    {isListingAgentUser ? (
                      <Link
                        href={`/dashboard/agent?tab=listings&editProperty=${encodeURIComponent(property.id)}`}
                        className="flex w-full items-center justify-center rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-semibold text-white shadow-md"
                      >
                        Edit listing
                      </Link>
                    ) : null}
                    {showCoAgentPendingBanner ? (
                      <div className="rounded-xl border border-[#D4A843]/35 bg-[#FFF9F0] px-4 py-3 text-xs font-semibold text-[#484848]">
                        Co-list request sent â€” pending review.
                      </div>
                    ) : null}
                    {showCoAgentRequestButton && !hideListingClientActions ? (
                      <button
                        type="button"
                        onClick={() => setCoAgentConfirmOpen(true)}
                        className="w-full rounded-xl border-2 border-[#2C2C2C] bg-white py-3 text-sm font-bold text-[#2C2C2C]"
                      >
                        Request to co-list
                      </button>
                    ) : null}
                    {showCoListNeedsVerificationPanel && !hideListingClientActions ? (
                      <button
                        type="button"
                        onClick={() => setShowVerificationModal(true)}
                        className="w-full rounded-xl border border-[#6B9E6E]/40 bg-white py-3 text-sm font-semibold text-[#6B9E6E]"
                      >
                        Complete verification to co-list â†’
                      </button>
                    ) : null}
                  </>
                }
              />
            </div>

            <BahayGoPropertyPageDesktop
              property={property}
              allPhotos={allPhotos}
              heroIndex={heroIndex}
              heroDisplaySrc={heroDisplaySrc}
              fallbackHeroSrc={noGalleryFallbackHeroSrc}
              onPrevPhoto={goPrevPhoto}
              onNextPhoto={goNextPhoto}
              onSelectPhoto={(i) => setActivePhoto(String(allPhotos[i]).trim())}
              onOpenLightbox={openLightbox}
              engagement={engagement}
              agentEngagementLocked={agentEngagementLocked}
              hideListingClientActions={hideListingClientActions}
              availabilityBanner={availabilityBanner}
              listingAgent={listingAgent}
              isListingAgentUser={isListingAgentUser}
              onCheckAvailability={onRequestViewing}
              onMessageAgent={() => void onMessageAgent()}
              messageBusy={messageBusy}
              authLoading={authLoading}
              locationSection={<PropertyDetailLocationSection property={property} />}
              presaleSection={
                property.is_presale ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8">
                    <h2 className="font-serif text-2xl font-semibold text-[#2C2C2C]">Presale development</h2>
                    {property.developer_name?.trim() ? (
                      <p className="mt-3 text-sm text-neutral-600">
                        <span className="font-semibold text-[#2C2C2C]">Developer: </span>
                        {property.developer_name.trim()}
                      </p>
                    ) : null}
                    {property.turnover_date ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        <span className="font-semibold text-[#2C2C2C]">Expected turnover: </span>
                        {formatPresaleTurnoverMonthYear(property.turnover_date)}
                      </p>
                    ) : null}
                    {property.unit_types && property.unit_types.length > 0 ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        <span className="font-semibold text-[#2C2C2C]">Available units: </span>
                        {property.unit_types.join(", ")}
                      </p>
                    ) : null}
                    {!hideListingClientActions ? (
                      <>
                        <p className="mt-6 font-serif text-lg font-semibold text-[#2C2C2C]">Register interest</p>
                        <p className="mt-1 text-sm text-neutral-600">
                          Leave your details and preferred unit. The listing agent will follow up.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs font-semibold text-neutral-500">
                            Name
                            <input
                              value={presaleName}
                              onChange={(e) => setPresaleName(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                              autoComplete="name"
                            />
                          </label>
                          <label className="block text-xs font-semibold text-neutral-500">
                            Email
                            <input
                              type="email"
                              value={presaleEmail}
                              onChange={(e) => setPresaleEmail(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                              autoComplete="email"
                            />
                          </label>
                          <label className="block text-xs font-semibold text-neutral-500">
                            Phone
                            <input
                              type="tel"
                              value={presalePhone}
                              onChange={(e) => setPresalePhone(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                              autoComplete="tel"
                            />
                          </label>
                          <label className="block text-xs font-semibold text-neutral-500">
                            Preferred unit type
                            <select
                              value={presaleUnit}
                              onChange={(e) => setPresaleUnit(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                            >
                              <option value="">Selectâ€¦</option>
                              {(property.unit_types && property.unit_types.length > 0
                                ? property.unit_types
                                : ["Studio", "1BR", "2BR", "3BR", "4BR+"]
                              ).map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {presaleMsg ? (
                          <p
                            className={`mt-3 text-sm font-semibold ${
                              presaleMsg.startsWith("Thanks") ? "text-[#6B9E6E]" : "text-red-700"
                            }`}
                          >
                            {presaleMsg}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void submitPresaleInterest()}
                          disabled={presaleBusy || !property.listed_by}
                          className="mt-4 rounded-xl bg-[#2C2C2C] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                        >
                          {presaleBusy ? "Sendingâ€¦" : "Register interest"}
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null
              }
              agentAsideSection={
                <>
                  {showCoAgentPendingBanner ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                      Co-list request sent â€” pending review.
                    </div>
                  ) : null}
                  {showCoAgentRequestButton && !hideListingClientActions ? (
                    <button
                      type="button"
                      onClick={() => setCoAgentConfirmOpen(true)}
                      className="w-full rounded-xl border-2 border-[#2C2C2C] bg-white py-3 text-sm font-bold text-[#2C2C2C]"
                    >
                      Request to co-list
                    </button>
                  ) : null}
                  {showCoListNeedsVerificationPanel && !hideListingClientActions ? (
                    <button
                      type="button"
                      onClick={() => setShowVerificationModal(true)}
                      className="w-full rounded-xl border border-neutral-300 bg-white py-3 text-sm font-semibold text-[#2C2C2C]"
                    >
                      Complete verification to co-list â†’
                    </button>
                  ) : null}
                </>
              }
            />
          </>
        )}

        {!loading && !error && property && (
          <>
            <ViewingAgentPickerModal
              open={showAgentPicker}
              onOpenChange={setShowAgentPicker}
              agents={connectedAgents}
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
                if (!open) setSelectedViewingAgentUserId(null);
              }}
              propertyId={property.id}
              propertyTitle={property.name?.trim() || property.location}
              agentUserId={selectedViewingAgentUserId ?? listingAgentUserId(property, connectedAgents)}
            />
            {lightboxOpen && allPhotos.length > 0 ? (
              <PropertyPhotoLightbox
                photos={allPhotos}
                initialIndex={lightboxInitialIndex}
                galleryLabel={property.name?.trim() || property.location}
                onClose={() => setLightboxOpen(false)}
              />
            ) : null}
            <SignInViewingPromptModal open={signInPromptOpen} onOpenChange={setSignInPromptOpen} />
            <AgentContactOptionsModal
              open={showContactModal}
              onOpenChange={(o) => {
                setShowContactModal(o);
                if (!o) setContactModalAgent(null);
              }}
              agent={contactModalAgent}
              propertyId={property.id}
              propertyTitle={property.name?.trim() || property.location}
            />
            {listingLimitModalOpen ? (
              <ListingLimitUpgradeModal
                onClose={() => setListingLimitModalOpen(false)}
                limitKind="coList"
                tier={myAgent?.listing_tier}
                ownedLimit={ownedListingLimit}
                coListLimit={coListLimit}
              />
            ) : null}
            <CoListVerificationRequiredModal
              open={showVerificationModal}
              onClose={() => setShowVerificationModal(false)}
            />
            <CoListRequestModal
              open={coAgentConfirmOpen}
              onClose={() => setCoAgentConfirmOpen(false)}
              propertyTitle={property.name?.trim() || property.location}
              submitting={coAgentSubmitting}
              error={coAgentMsg}
              onSubmit={(message) => requestCoAgentJoin(message)}
            />
          </>
        )}

        {!loading && !error && property && similar.length > 0 && (
          <section className="mt-8">
            <p className="text-sm font-semibold text-[#2C2C2C]">Similar properties</p>
          </section>
        )}
      </main>
    </div>
  );
}

const SAGE_MAP_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56"><path fill="#6B9E6E" stroke="#3d6b40" stroke-width="1.5" d="M22 4C13.2 4 6.3 10.6 6.3 19c0 11.2 15.7 31.8 15.7 31.8S37.7 30.2 37.7 19C37.7 10.6 30.8 4 22 4zm0 24.5a9.5 9.5 0 110-19 9.5 9.5 0 010 19z"/></svg>`,
);

function PropertyDetailLocationSection({ property }: { property: PropertyRow }) {
  const subtitle =
    (typeof property.formatted_address === "string" && property.formatted_address.trim()) ||
    property.location;
  const displayTitle = (property.name?.trim() || property.location).trim();
  const infoAddress =
    (typeof property.formatted_address === "string" && property.formatted_address.trim()) ||
    property.location;
  const hasCoords = isValidMapCoordinate(property.lat) && isValidMapCoordinate(property.lng);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  const showMapEmbed = Boolean(apiKey && hasCoords);
  const useAdvancedMarker = Boolean(mapId);

  return (
    <section className="w-full max-md:mt-0 md:mt-8" aria-labelledby="property-detail-location-heading">
      <h2
        id="property-detail-location-heading"
        className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]"
      >
        Location
      </h2>
      <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
      <div
        className={cn(
          "relative mt-4 w-full overflow-hidden rounded-2xl ring-1 ring-[#2C2C2C]/[0.045]",
          "h-[280px] md:h-auto md:aspect-video",
          !showMapEmbed && "bg-[#6B9E6E]/5",
        )}
      >
        {showMapEmbed ? (
          <div className="absolute inset-0">
            <APIProvider apiKey={apiKey}>
              <Map
                {...(useAdvancedMarker ? { mapId } : {})}
                defaultCenter={{ lat: property.lat as number, lng: property.lng as number }}
                defaultZoom={16}
                gestureHandling="greedy"
                mapTypeId="roadmap"
                className="h-full w-full"
              >
                {useAdvancedMarker ? (
                  <PropertyLocationAdvancedMarkerWithInfoWindow
                    lat={property.lat as number}
                    lng={property.lng as number}
                    title={displayTitle}
                    addressLine={infoAddress}
                  />
                ) : (
                  <PropertyLocationMarkerWithInfoWindow
                    lat={property.lat as number}
                    lng={property.lng as number}
                    title={displayTitle}
                    addressLine={infoAddress}
                  />
                )}
              </Map>
            </APIProvider>
          </div>
        ) : (
          <div className="flex h-full min-h-[280px] w-full flex-col items-center justify-center px-6 text-center md:min-h-0 md:py-10">
            <MapPin className="h-10 w-10 text-[#6B9E6E]/60" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 max-w-sm text-sm text-gray-600">
              {!hasCoords
                ? "Map will appear once the agent verifies the location."
                : "Map preview isnâ€™t available right now."}
            </p>
            <p className="mt-2 text-xs font-medium text-[#2C2C2C]/70">{property.location}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PropertyLocationAdvancedMarkerWithInfoWindow({
  lat,
  lng,
  title,
  addressLine,
}: {
  lat: number;
  lng: number;
  title: string;
  addressLine: string;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat, lng }}
        title={title}
        clickable
        onClick={() => setInfoOpen(true)}
      >
        <Pin background="#6B9E6E" borderColor="#3d6b40" glyphColor="#ffffff" />
      </AdvancedMarker>
      {infoOpen && marker ? (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="max-w-[220px] px-1 py-0.5">
            <p className="text-sm font-semibold text-[#2C2C2C]">{title}</p>
            <p className="mt-1 text-xs leading-snug text-gray-600">{addressLine}</p>
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}

function PropertyLocationMarkerWithInfoWindow({
  lat,
  lng,
  title,
  addressLine,
}: {
  lat: number;
  lng: number;
  title: string;
  addressLine: string;
}) {
  const mapReady = useApiIsLoaded();
  const [markerRef, marker] = useMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  const icon = useMemo((): google.maps.Icon | google.maps.Symbol | string | undefined => {
    if (!mapReady || typeof google === "undefined") return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${SAGE_MAP_PIN_SVG}`,
      scaledSize: new google.maps.Size(44, 56),
      anchor: new google.maps.Point(22, 56),
    };
  }, [mapReady]);

  return (
    <>
      <Marker
        ref={markerRef}
        position={{ lat, lng }}
        title={title}
        onClick={() => setInfoOpen(true)}
        {...(icon ? { icon } : {})}
      />
      {infoOpen && marker ? (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="max-w-[220px] px-1 py-0.5">
            <p className="text-sm font-semibold text-[#2C2C2C]">{title}</p>
            <p className="mt-1 text-xs leading-snug text-gray-600">{addressLine}</p>
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}

function PropertyPhotoLightbox({
  photos,
  initialIndex,
  galleryLabel,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  galleryLabel: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, goPrev, goNext]);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 48) return;
    if (dx > 0) goPrev();
    else goNext();
  };

  if (typeof document === "undefined") return null;

  const currentSrc = String(photos[index] ?? photos[0] ?? "").trim();
  const countLabel = photos.length > 0 ? `${index + 1} of ${photos.length}` : "";

  const shell = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={galleryLabel ? `${galleryLabel} â€” ${countLabel}` : countLabel}
    >
      <div className="relative z-30 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4">
        <div aria-hidden />
        <p className="min-w-0 text-center text-base font-semibold tabular-nums text-white">{countLabel}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-12 w-12" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 w-full touch-pan-x">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-black"
          aria-label="Close gallery"
          onClick={onClose}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-14 pb-8 pt-0 sm:px-20"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="pointer-events-auto relative h-full w-full max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.length > 0 ? (
              <Image
                src={currentSrc}
                alt=""
                fill
                className="object-contain"
                sizes="100vw"
                priority
                loading="eager"
              />
            ) : null}
          </div>
        </div>

        {photos.length > 1 ? (
          <>
            <GalleryNavButton
              direction="prev"
              size="lg"
              className="left-2 z-20 sm:left-4"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous photo"
            />
            <GalleryNavButton
              direction="next"
              size="lg"
              className="right-2 z-20 sm:right-4"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next photo"
            />
          </>
        ) : null}
      </div>
    </div>
  );
  return createPortal(shell, document.body);
}
