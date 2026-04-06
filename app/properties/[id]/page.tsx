"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Mail, Phone, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { useSavedPropertyIds } from "@/lib/saved-properties";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { recordRecentlyViewedPropertyId } from "@/lib/recently-viewed";
import { PropertyPageEmptyAgents } from "@/components/marketplace/agent-slot-placeholder";
import { ViewingRequestModal } from "@/components/marketplace/viewing-request-modal";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";
import { AgentContactOptionsModal } from "@/components/marketplace/agent-contact-options-modal";
import { AgentAvailabilityBadge } from "@/components/marketplace/agent-availability-badge";
import { ListingLimitUpgradeModal } from "@/components/marketplace/listing-limit-upgrade-modal";
import { useAuth } from "@/contexts/auth-context";
import { listingLimitForTier, normalizeListingTier } from "@/lib/agent-listing-limits";

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
  listing_agent: ListingAgentProfile;
  property_agents?: { agent: unknown }[];
};

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

function buildGallery(property: PropertyRow): string[] {
  const primary = property.image_url;
  const extras = ROOM_IMAGES.filter((u) => u !== primary);
  return [primary, ...extras.slice(0, 4)];
}

export default function PropertyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user, profile, loading: authLoading } = useAuth();

  const saved = useSavedPropertyIds();
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [selectedViewingAgentUserId, setSelectedViewingAgentUserId] = useState<string | null>(null);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactModalAgent, setContactModalAgent] = useState<MarketplaceAgent | null>(null);
  const [listingLimitModalOpen, setListingLimitModalOpen] = useState(false);
  const [coAgentMsg, setCoAgentMsg] = useState<string | null>(null);
  const [coAgentSubmitting, setCoAgentSubmitting] = useState(false);
  const [myAgent, setMyAgent] = useState<{
    id: string;
    listing_tier: string | null;
    status: string;
    verified: boolean | null;
  } | null>(null);
  const [myListingCount, setMyListingCount] = useState(0);
  const [hasPendingCoRequest, setHasPendingCoRequest] = useState(false);

  const isLoggedIn = !authLoading && !!user;
  const listingLimit = listingLimitForTier(myAgent?.listing_tier);
  const atListingLimit = myListingCount >= listingLimit;

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
          id, created_at, name, location, price, sqft, beds, baths, image_url, listed_by, property_type, lat, lng,
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
      setIdx(0);
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
        .select("id, listing_tier, status, verified")
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
      setMyListingCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { count } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("listed_by", user.id);
      if (!cancelled) setMyListingCount(count ?? 0);
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

  const gallery = useMemo(() => (property ? buildGallery(property) : []), [property]);
  const img = gallery[idx] ?? gallery[0];
  const isSaved = property ? saved.has(property.id) : false;

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

  const showCoAgentCta = useMemo(() => {
    if (!isLoggedIn || profile?.role !== "agent" || !myAgent) return false;
    if (myAgent.status !== "approved" || !myAgent.verified) return false;
    if (connectedAgents.some((a) => a.id === myAgent.id)) return false;
    if (hasPendingCoRequest) return false;
    return true;
  }, [isLoggedIn, profile?.role, myAgent, connectedAgents, hasPendingCoRequest]);

  const requestCoAgentJoin = async () => {
    if (!property?.id || !myAgent?.id) return;
    setCoAgentMsg(null);
    if (atListingLimit) {
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
    setCoAgentMsg("Request sent! An admin will review your request.");
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

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-12">
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
            <section className="lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                <div className="relative aspect-[16/9] w-full bg-black/5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={img}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={img ?? property.image_url}
                        alt={property.location}
                        fill
                        sizes="(min-width: 1024px) 900px, 100vw"
                        className="object-cover"
                        priority
                      />
                    </motion.div>
                  </AnimatePresence>

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />

                  {gallery.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIdx((i) => (i - 1 + gallery.length) % gallery.length)}
                        className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
                        aria-label="Previous"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdx((i) => (i + 1) % gallery.length)}
                        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
                        aria-label="Next"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => property && saved.toggle(property.id)}
                    className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-sm"
                    aria-label={isSaved ? "Unsave" : "Save"}
                  >
                    <Heart className={`h-5 w-5 ${isSaved ? "fill-red-500 text-red-500" : "text-[#2C2C2C]"}`} />
                  </button>

                  {gallery.length > 1 && (
                    <div className="absolute bottom-3 left-0 right-0 z-10 px-3">
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {gallery.map((u, i) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setIdx(i)}
                            className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                              i === idx ? "border-[#D4A843]" : "border-white/30"
                            }`}
                          >
                            <Image src={u} alt="" fill sizes="64px" className="object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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

              <div className="mt-6">
                <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Connected Agents</h2>
                {connectedAgents.length === 0 ? (
                  <PropertyPageEmptyAgents />
                ) : (
                  <ul className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-2">
                    {connectedAgents.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm"
                      >
                        <div className="flex gap-3">
                          <Link
                            href={`/agents/${encodeURIComponent(a.id)}`}
                            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10"
                          >
                            <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="56px" textClassName="text-sm" />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/agents/${encodeURIComponent(a.id)}`}
                                className="font-semibold text-[#2C2C2C] hover:underline"
                              >
                                {a.name}
                              </Link>
                              {a.verified && a.status === "approved" ? <VerifiedAgentBadge show /> : null}
                              <span className="rounded-md bg-[#2C2C2C]/8 px-2 py-0.5 text-xs font-bold text-[#2C2C2C]/80">
                                {Math.round(a.score)}
                              </span>
                            </div>
                            {a.brokerName ? (
                              <p className="mt-1 text-xs font-medium text-[#2C2C2C]/55">{a.brokerName}</p>
                            ) : null}
                            {a.responseTime ? (
                              <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/45">
                                Response: {a.responseTime}
                              </p>
                            ) : null}
                            <div className="mt-1">
                              <AgentAvailabilityBadge availability={a.availability} />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-[#2C2C2C]/50">
                              {a.email ? (
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  {a.email}
                                </span>
                              ) : null}
                              {a.phone ? (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  {a.phone}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3">
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
                                className="inline-flex rounded-lg bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#5d8a60]"
                              >
                                Contact
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {showCoAgentCta ? (
                  <div className="mt-6 rounded-2xl border border-[#D4A843]/25 bg-[#FAF8F4] p-4">
                    <p className="text-sm font-semibold text-[#2C2C2C]/70">
                      Represent this listing too? Ask to be added as a connected agent.
                    </p>
                    <button
                      type="button"
                      onClick={() => void requestCoAgentJoin()}
                      disabled={coAgentSubmitting}
                      className="mt-3 inline-flex rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {coAgentSubmitting ? "Sending…" : "I also represent this property"}
                    </button>
                    {coAgentMsg ? (
                      <p
                        className={`mt-2 text-sm font-semibold ${
                          coAgentMsg.startsWith("Request sent") ? "text-[#6B9E6E]" : "text-red-700"
                        }`}
                      >
                        {coAgentMsg}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="lg:col-span-1">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                <p className="font-serif text-lg font-bold text-[#2C2C2C]">Request a viewing</p>
                <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
                  Pick a date and time. We’ll notify the listing agent by SMS and email.
                </p>

                {listingAgent ? (
                  <div className="mt-3 rounded-2xl bg-[#FAF8F4] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[#2C2C2C]">{listingAgent.name}</p>
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
                isProTier={normalizeListingTier(myAgent?.listing_tier) === "pro"}
                listingLimit={listingLimit}
              />
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

function ViewingAgentPickerModal({
  open,
  onOpenChange,
  agents,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: MarketplaceAgent[];
  onSelect: (agent: MarketplaceAgent) => void;
}) {
  if (!open) return null;

  const shell = (
    <div className="fixed inset-0 z-[190] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewing-agent-picker-title"
        className="relative z-[191] mx-4 w-full max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-5 shadow-2xl sm:mx-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="viewing-agent-picker-title" className="pr-2 font-serif text-lg font-bold leading-snug text-[#2C2C2C]">
            Who would you like to schedule with?
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-full p-2 text-[#2C2C2C]/60 transition hover:bg-[#2C2C2C]/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="mt-4 max-h-[min(60dvh,420px)] list-none space-y-2 overflow-y-auto p-0">
          {agents.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-[#2C2C2C]/10 bg-white p-3 text-left transition hover:bg-[#6B9E6E]/10"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                  <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="48px" textClassName="text-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#2C2C2C]">{a.name}</p>
                  <p className="text-xs font-bold text-[#2C2C2C]/55">Score {Math.round(a.score)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(shell, document.body);
}
