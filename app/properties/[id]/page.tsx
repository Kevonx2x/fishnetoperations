"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Heart, Pin, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { usePropertyEngagementForProperties } from "@/hooks/use-property-engagement";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { recordRecentlyViewedPropertyId } from "@/lib/recently-viewed";
import { PropertyPageEmptyAgents } from "@/components/marketplace/agent-slot-placeholder";
import { ViewingAgentPickerModal } from "@/components/marketplace/viewing-agent-picker-modal";
import { ViewingRequestModal } from "@/components/marketplace/viewing-request-modal";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";
import { AgentContactOptionsModal } from "@/components/marketplace/agent-contact-options-modal";
import { AgentAvailabilityBadge } from "@/components/marketplace/agent-availability-badge";
import { ListingLimitUpgradeModal } from "@/components/marketplace/listing-limit-upgrade-modal";
import { useAuth } from "@/contexts/auth-context";
import { coListLimitForTier, listingLimitForTier } from "@/lib/agent-listing-limits";
import { formatAgentScore } from "@/lib/format-agent-score";
import { cn } from "@/lib/utils";

type ListingAgentProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
} | null;

type PropertyRow = {
  id: string;
  created_at: string;
  name: string | null;
  location: string;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  listed_by: string | null;
  property_type: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  is_presale?: boolean;
  developer_name?: string | null;
  turnover_date?: string | null;
  unit_types?: string[] | null;
  listing_agent: ListingAgentProfile;
  property_agents?: { agent: unknown }[];
  property_photos?: { url: string; sort_order: number }[];
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

const ROOM_IMAGES = [
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000&h=700&fit=crop",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&h=700&fit=crop",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000&h=700&fit=crop",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1000&h=700&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&h=700&fit=crop",
];

function buildAllPhotos(property: PropertyRow): string[] {
  const fromDb = (property.property_photos ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((x) => x.url)
    .filter(Boolean);
  if (fromDb.length) return fromDb;
  const primary = property.image_url;
  const extras = ROOM_IMAGES.filter((u) => u !== primary);
  return [primary, ...extras.slice(0, 4)];
}

function buildGridSlots(allPhotos: string[]): { main: string | null; small: (string | null)[] } {
  return {
    main: allPhotos[0] ?? null,
    small: Array.from({ length: 4 }, (_, i) => allPhotos[i + 1] ?? null),
  };
}

export default function PropertyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user, profile, loading: authLoading } = useAuth();

  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
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
  const [myAgent, setMyAgent] = useState<{
    id: string;
    listing_tier: string | null;
    status: string;
    verified: boolean | null;
    license_number: string | null;
  } | null>(null);
  const [myCoListCount, setMyCoListCount] = useState(0);
  const [hasPendingCoRequest, setHasPendingCoRequest] = useState(false);
  const [presaleName, setPresaleName] = useState("");
  const [presaleEmail, setPresaleEmail] = useState("");
  const [presalePhone, setPresalePhone] = useState("");
  const [presaleUnit, setPresaleUnit] = useState("");
  const [presaleBusy, setPresaleBusy] = useState(false);
  const [presaleMsg, setPresaleMsg] = useState<string | null>(null);

  const { engagement } = usePropertyEngagementForProperties(property ? [property] : []);

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
          id, created_at, name, location, price, sqft, beds, baths, image_url, listed_by, property_type, lat, lng, description,
          is_presale, developer_name, turnover_date, unit_types,
          property_photos (url, sort_order),
          listing_agent:profiles!listed_by (id, full_name, avatar_url),
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
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setProperty(null);
      } else {
        const next = (data ?? null) as unknown as PropertyRow | null;
        setProperty(next);
        if (next?.id) recordRecentlyViewedPropertyId(next.id);
      }
      setLightboxIndex(0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!user?.id || authLoading) {
      setMyAgent(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, listing_tier, status, verified, license_number")
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
  const gridSlots = useMemo(() => buildGridSlots(allPhotos), [allPhotos]);

  const openLightbox = (index: number) => {
    if (allPhotos.length === 0) return;
    setLightboxIndex(Math.min(Math.max(0, index), allPhotos.length - 1));
    setLightboxOpen(true);
  };
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

  const showCoAgentPendingBanner = useMemo(() => {
    if (!isLoggedIn || profile?.role !== "agent" || !myAgent) return false;
    if (isConnectedAsAgent) return false;
    return hasPendingCoRequest;
  }, [isLoggedIn, profile?.role, myAgent, isConnectedAsAgent, hasPendingCoRequest]);

  const showCoAgentRequestButton = useMemo(() => {
    if (!isLoggedIn || profile?.role !== "agent" || !myAgent) return false;
    if (myAgent.status !== "approved" || !myAgent.verified) return false;
    if (!myAgent.license_number?.trim()) return false;
    if (isConnectedAsAgent) return false;
    if (hasPendingCoRequest) return false;
    return true;
  }, [isLoggedIn, profile?.role, myAgent, isConnectedAsAgent, hasPendingCoRequest]);

  const requestCoAgentJoin = async () => {
    if (!property?.id || !myAgent?.id) return;
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
      body: JSON.stringify({ propertyId: property.id }),
    }).catch(() => {});
  };

  const similar = useMemo(() => {
    // lightweight similar list: same inferred type or just top few newest
    return [] as PropertyRow[];
  }, []);

  const onRequestViewing = () => {
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
  };

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
      const { error } = await supabase.from("leads").insert({
        name: presaleName.trim(),
        email: presaleEmail.trim(),
        phone: presalePhone.trim() ? presalePhone.trim() : null,
        property_id: property.id,
        agent_id: property.listed_by,
        property_interest: property.name?.trim() || property.location,
        message: `Preferred unit type: ${presaleUnit.trim()}`,
        source: "presale_interest",
        stage: "new",
        client_id: null,
        broker_id: null,
      });
      if (error) throw error;
      setPresaleMsg("Thanks — we’ll be in touch shortly.");
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
    <div className="min-h-screen bg-white pb-12">
      <MaddenTopNav />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:pb-12">
        <div className="mb-4 text-sm font-semibold text-[#2C2C2C]/65">
          <Link href="/" className="hover:text-[#2C2C2C]">Home</Link> <span>·</span>{" "}
          <span className="text-[#2C2C2C]">Property</span>
        </div>

        {loading && <div className="h-72 rounded-2xl animate-pulse bg-black/5" />}

        {!loading && error && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load property</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        )}

        {!loading && !error && property && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="space-y-6 lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                <div className="relative flex flex-col gap-2 p-2 md:h-[min(480px,52vh)] md:min-h-[320px] md:flex-row">
                  <div className="relative h-[min(52vh,22rem)] w-full shrink-0 overflow-hidden rounded-xl bg-neutral-200 md:h-full md:w-[60%]">
                    {gridSlots.main ? (
                      <button
                        type="button"
                        onClick={() => openLightbox(0)}
                        className="absolute inset-0 block"
                        aria-label="Open photo 1"
                      >
                        <Image
                          src={gridSlots.main}
                          alt={property.location}
                          fill
                          sizes="(min-width: 768px) 60vw, 100vw"
                          className="object-cover"
                          priority
                        />
                      </button>
                    ) : (
                      <div className="h-full w-full bg-neutral-200" />
                    )}
                    <div className="absolute right-3 top-3 z-10 flex items-start gap-1.5">
                      <div
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 shadow-sm",
                          engagement.isLiked(property.id)
                            ? "border border-red-200 bg-white"
                            : "border border-gray-200 bg-white/80",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => engagement.toggleLike(property.id)}
                          className="rounded-full p-1.5 transition hover:bg-[#FAF8F4]"
                          aria-label={engagement.isLiked(property.id) ? "Unlike" : "Like"}
                        >
                          <Heart
                            className={cn(
                              "h-4 w-4",
                              engagement.isLiked(property.id)
                                ? "fill-red-500 text-red-500"
                                : "text-red-400",
                            )}
                          />
                        </button>
                        {engagement.showEngagementCounts(property.id) ? (
                          <span className="text-[10px] font-bold leading-none text-[#2C2C2C]">
                            {engagement.likeCount(property.id)}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 shadow-sm",
                          engagement.isPinned(property.id)
                            ? "border border-[#D4A843]/40 bg-white"
                            : "border border-gray-200 bg-white/80",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => engagement.togglePin(property.id)}
                          className="rounded-full p-1.5 transition hover:bg-[#FAF8F4]"
                          aria-label={
                            engagement.isPinned(property.id) ? "Unpin from profile" : "Pin to profile"
                          }
                        >
                          <Pin
                            className={cn(
                              "h-4 w-4",
                              engagement.isPinned(property.id)
                                ? "fill-[#D4A843] text-[#D4A843]"
                                : "text-[#D4A843]",
                            )}
                          />
                        </button>
                        {engagement.showEngagementCounts(property.id) ? (
                          <span className="text-[10px] font-bold leading-none text-[#2C2C2C]">
                            {engagement.saveCount(property.id)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {allPhotos.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => openLightbox(0)}
                      className="w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] py-3 text-sm font-bold text-[#2C2C2C] shadow-sm transition hover:bg-[#6B9E6E]/10 md:hidden"
                    >
                      Show all {allPhotos.length} photos
                    </button>
                  ) : null}

                  <div className="hidden h-56 w-full shrink-0 grid-cols-2 grid-rows-2 gap-2 md:grid md:h-full md:w-[40%]">
                    {gridSlots.small.map((url, i) => {
                      const photoIndex = i + 1;
                      const isShowAllCell = i === 3;
                      return (
                        <div
                          key={i}
                          className="relative min-h-0 overflow-hidden rounded-xl bg-neutral-200"
                        >
                          {url ? (
                            <button
                              type="button"
                              onClick={() => openLightbox(photoIndex)}
                              className="absolute inset-0 block"
                              aria-label={`Open photo ${photoIndex + 1}`}
                            >
                              <Image
                                src={url}
                                alt=""
                                fill
                                sizes="(min-width: 768px) 20vw, 50vw"
                                className="object-cover"
                              />
                            </button>
                          ) : null}
                          {isShowAllCell ? (
                            <button
                              type="button"
                              onClick={() => openLightbox(0)}
                              className="absolute inset-0 z-[1] flex items-center justify-center bg-black/45 text-center transition hover:bg-black/55"
                              aria-label="Show all photos"
                            >
                              <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#2C2C2C] shadow-sm">
                                Show all photos
                              </span>
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">
                    Property
                  </p>
                  <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
                    {property.location}
                  </h1>
                  <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">
                    {property.price}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-[#2C2C2C]/70">
                    <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{property.beds} beds</span>
                    <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{property.baths} baths</span>
                    <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{property.sqft} sqft</span>
                    {property.property_type ? (
                      <span className="rounded-full bg-[#D4A843]/18 px-3 py-1 text-[#8a6d32]">
                        {property.property_type}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {property.description?.trim() ? (
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
                  <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">About this property</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#2C2C2C]/80">
                    {property.description.trim()}
                  </p>
                </div>
              ) : null}

              {property.is_presale ? (
                <div className="rounded-2xl border border-[#D4A843]/25 bg-[#FFF9F0] p-5 shadow-sm">
                  <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Presale Development</h2>
                  {property.developer_name?.trim() ? (
                    <p className="mt-3 text-sm font-semibold text-[#2C2C2C]">
                      <span className="text-[#2C2C2C]/55">Developer: </span>
                      {property.developer_name.trim()}
                    </p>
                  ) : null}
                  {property.turnover_date ? (
                    <p className="mt-2 text-sm font-semibold text-[#2C2C2C]">
                      <span className="text-[#2C2C2C]/55">Expected Turnover: </span>
                      {formatPresaleTurnoverMonthYear(property.turnover_date)}
                    </p>
                  ) : null}
                  {property.unit_types && property.unit_types.length > 0 ? (
                    <p className="mt-2 text-sm font-semibold text-[#2C2C2C]">
                      <span className="text-[#2C2C2C]/55">Available Units: </span>
                      {property.unit_types.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

            </section>

            <aside className="lg:sticky lg:top-24 lg:col-span-1 lg:self-start">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Connected Agents</h2>
                {connectedAgents.length === 0 ? (
                  <div className="mt-4">
                    <PropertyPageEmptyAgents />
                  </div>
                ) : (
                  <ul className="mt-4 list-none space-y-4 p-0">
                    {connectedAgents.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm"
                      >
                        <div className="flex gap-3">
                          <Link
                            href={`/agents/${encodeURIComponent(a.id)}`}
                            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10"
                          >
                            <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="48px" textClassName="text-sm" />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/agents/${encodeURIComponent(a.id)}`}
                                className="cursor-pointer text-sm font-semibold text-[#2C2C2C] hover:underline"
                              >
                                {a.name}
                              </Link>
                              {a.verified && a.status === "approved" ? <VerifiedAgentBadge show /> : null}
                              <span className="rounded-md bg-[#2C2C2C]/8 px-2 py-0.5 text-[10px] font-bold text-[#2C2C2C]/80">
                                {formatAgentScore(a.score)}
                              </span>
                            </div>
                            <div className="mt-1">
                              <AgentAvailabilityBadge availability={a.availability} />
                            </div>
                            <div className="mt-2">
                              {myAgent?.id === a.id || user?.id === a.userId ? null : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isLoggedIn) {
                                      setSignInPromptOpen(true);
                                      return;
                                    }
                                    setContactModalAgent(a);
                                    setShowContactModal(true);
                                  }}
                                  className="inline-flex w-full justify-center rounded-lg bg-[#6B9E6E] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#5d8a60] sm:w-auto"
                                >
                                  Contact
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {showCoAgentPendingBanner ? (
                  <div className="mt-4 rounded-xl border border-[#D4A843]/30 bg-[#FAF8F4] p-3">
                    <p className="text-xs font-bold text-[#2C2C2C]">Co-list request pending</p>
                    <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/65">
                      BahayGo admin will review your credentials. You’ll be notified when it’s approved or declined.
                    </p>
                  </div>
                ) : null}
                {showCoAgentRequestButton ? (
                  <div className="mt-4 rounded-xl border border-[#D4A843]/25 bg-[#FAF8F4] p-3">
                    <p className="text-xs font-semibold text-[#2C2C2C]/70">
                      Want to co-list this property? Submit a request for admin approval.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCoAgentMsg(null);
                        setCoAgentConfirmOpen(true);
                      }}
                      disabled={coAgentSubmitting}
                      className="mt-2 w-full rounded-full bg-[#2C2C2C] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Request to Co-List
                    </button>
                    {coAgentMsg ? (
                      <p className="mt-2 text-xs font-semibold text-red-700">{coAgentMsg}</p>
                    ) : null}
                  </div>
                ) : null}

                <div id="presale-interest" className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
                  {property.is_presale ? (
                    <>
                      <p className="font-serif text-base font-bold text-[#2C2C2C]">Register interest</p>
                      <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
                        Leave your details and preferred unit. The listing agent will follow up.
                      </p>
                      <div className="mt-3 space-y-2">
                        <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                          Name
                          <input
                            value={presaleName}
                            onChange={(e) => setPresaleName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                            autoComplete="name"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                          Email
                          <input
                            type="email"
                            value={presaleEmail}
                            onChange={(e) => setPresaleEmail(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                            autoComplete="email"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                          Phone
                          <input
                            type="tel"
                            value={presalePhone}
                            onChange={(e) => setPresalePhone(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                            autoComplete="tel"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                          Preferred unit type
                          <select
                            value={presaleUnit}
                            onChange={(e) => setPresaleUnit(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                          >
                            <option value="">Select…</option>
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
                        className="mt-4 w-full rounded-full bg-[#6B9E6E] px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#5d8a60] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {presaleBusy ? "Sending…" : "Register Interest"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="font-serif text-base font-bold text-[#2C2C2C]">Request a viewing</p>
                      <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
                        Pick a date and time. We’ll notify the listing agent by SMS and email.
                      </p>
                      {listingAgent ? (
                        <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/agents/${encodeURIComponent(listingAgent.id)}`}
                              className="cursor-pointer text-sm font-semibold text-[#2C2C2C] hover:underline"
                            >
                              {listingAgent.name}
                            </Link>
                            <VerifiedAgentBadge show />
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-[#2C2C2C]/60">
                            {listingAgent.company || listingAgent.brokerName}
                          </p>
                          <div className="mt-2">
                            <AgentAvailabilityBadge
                              availability={listingAgent.availability}
                              updatedAt={listingAgent.updatedAt}
                            />
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={onRequestViewing}
                        disabled={authLoading || connectedAgents.length === 0}
                        className="mt-4 w-full rounded-full bg-[#2C2C2C] px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#6B9E6E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {authLoading ? "Loading…" : "Request viewing"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </aside>
          </div>
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
                index={lightboxIndex}
                title={property.name?.trim() || property.location}
                onClose={() => setLightboxOpen(false)}
                onGoTo={(i) => setLightboxIndex(i)}
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
            {coAgentConfirmOpen ? (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/50"
                  aria-label="Close"
                  onClick={() => setCoAgentConfirmOpen(false)}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="co-agent-confirm-title"
                  className="relative z-[201] w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2
                    id="co-agent-confirm-title"
                    className="font-serif text-lg font-bold leading-snug text-[#2C2C2C]"
                  >
                    Request to co-list?
                  </h2>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/75">
                    Request to co-list{" "}
                    <span className="text-[#2C2C2C]">{property.name?.trim() || property.location}</span>? BahayGo
                    admin will review your credentials and approve your request. Once approved you will appear as a
                    listing agent on this property.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCoAgentConfirmOpen(false)}
                      className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold text-[#2C2C2C]/75"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void requestCoAgentJoin()}
                      disabled={coAgentSubmitting}
                      className="rounded-full bg-[#2C2C2C] px-5 py-2 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-60"
                    >
                      {coAgentSubmitting ? "Sending…" : "Confirm"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
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

function PropertyPhotoLightbox({
  photos,
  index,
  title,
  onClose,
  onGoTo,
}: {
  photos: string[];
  index: number;
  title: string;
  onClose: () => void;
  onGoTo: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const shell = (
    <div className="fixed inset-0 z-[210] flex flex-col bg-black" role="presentation">
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-2 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Image src={photos[index] ?? photos[0]} alt="" fill className="object-contain" sizes="100vw" priority />
        </div>
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onGoTo((index - 1 + photos.length) % photos.length)}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-3 text-white hover:bg-black/65"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => onGoTo((index + 1) % photos.length)}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-3 text-white hover:bg-black/65"
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>
      <p className="py-3 text-center text-xs font-semibold text-white/80">
        {index + 1} / {photos.length}
      </p>
    </div>
  );
  return createPortal(shell, document.body);
}
