"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { HomeTrustStrip } from "@/components/marketplace/home-trust-strip";
import { NewlyListedCard } from "@/components/marketplace/fishnet-home-marketplace";
import { PropertyZoomModal } from "@/components/marketplace/property-zoom-modal";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { hideTutorialDemoPropertiesOrFilter } from "@/lib/tutorial-demo-property-filter";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { usePropertyEngagementForProperties } from "@/hooks/use-property-engagement";

type AgencyRow = {
  id: string;
  company_name: string;
  name: string;
  bio: string | null;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  email: string;
  status: string;
  verified: boolean;
  created_at: string;
  user_id: string;
};

type AgentCard = {
  id: string;
  name: string;
  image_url: string | null;
  verified: boolean;
  score: number;
  listingCount: number;
};

const PROPERTY_SELECT = `
  id, created_at, name, location, price, sqft, beds, baths, image_url, status, listed_by, description, property_type,
  is_presale, developer_name, turnover_date, unit_types, deleted_at, availability_state, listing_type,
  property_photos (url, sort_order),
  property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at, agencies (id, company_name, logo_url), profiles(email, phone)))
`;

export default function AgencyProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user } = useAuth();

  const [agency, setAgency] = useState<AgencyRow | null>(null);
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cardRoomIdx, setCardRoomIdx] = useState<Record<string, number>>({});
  const [zoomProperty, setZoomProperty] = useState<DbProperty | null>(null);

  const { engagement } = usePropertyEngagementForProperties(properties);

  const connectedAgentsByPropertyId = useMemo(() => {
    const map = new Map<string, MarketplaceAgent[]>();
    for (const p of properties) {
      const pas = (p as { property_agents?: { agent?: unknown }[] }).property_agents ?? [];
      const agentsList = pas
        .map((pa) => pa.agent)
        .filter(Boolean)
        .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]));
      map.set(p.id, agentsList);
    }
    return map;
  }, [properties]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    const { data: ag, error } = await supabase
      .from("agencies")
      .select(
        "id, company_name, name, bio, logo_url, website, phone, email, status, verified, created_at, user_id",
      )
      .eq("id", id)
      .eq("status", "approved")
      .eq("verified", true)
      .maybeSingle();

    if (error || !ag) {
      setAgency(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    const agencyRow = ag as AgencyRow;
    setAgency(agencyRow);

    const { data: agentRows } = await supabase
      .from("agents")
      .select("id, name, image_url, verified, score, user_id")
      .eq("agency_id", id)
      .eq("status", "approved");

    const list = (agentRows ?? []) as {
      id: string;
      name: string;
      image_url: string | null;
      verified: boolean;
      score: number | string;
      user_id: string;
    }[];

    const ownerIds = [...new Set([agencyRow.user_id, ...list.map((a) => a.user_id).filter(Boolean)])];

    const agentCards: AgentCard[] = [];
    for (const a of list) {
      const { count } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("listed_by", a.user_id)
        .is("deleted_at", null);
      agentCards.push({
        id: a.id,
        name: a.name,
        image_url: a.image_url,
        verified: a.verified === true,
        score: typeof a.score === "number" ? a.score : Number(a.score) || 0,
        listingCount: count ?? 0,
      });
    }
    setAgents(agentCards);

    if (ownerIds.length) {
      const { data: props, count } = await supabase
        .from("properties")
        .select(PROPERTY_SELECT, { count: "exact" })
        .in("listed_by", ownerIds)
        .or(publicListingExpiryOrFilter())
        .or(hideTutorialDemoPropertiesOrFilter())
        .is("deleted_at", null)
        .eq("availability_state", "available")
        .order("created_at", { ascending: false })
        .limit(12);

      setProperties((props ?? []) as unknown as DbProperty[]);
      setTotalListings(count ?? props?.length ?? 0);
    } else {
      setProperties([]);
      setTotalListings(0);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const foundedYear = agency?.created_at
    ? new Date(agency.created_at).getFullYear()
    : null;

  const aboutText =
    agency?.bio?.trim() ||
    `${agency?.company_name ?? "This agency"} is a verified real estate agency on BahayGo, serving buyers and renters across the Philippines with licensed professionals and transparent listings.`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="h-48 animate-pulse rounded-3xl bg-black/5" />
        </div>
      </div>
    );
  }

  if (notFound || !agency) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Agency not found</h1>
          <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
            This profile may be pending review or no longer available.
          </p>
          <Link href="/agencies" className="mt-6 inline-block font-semibold text-[#6B9E6E] underline">
            Back to agencies
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-16">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <p className="mb-6 text-sm font-semibold text-[#2C2C2C]/65">
          <Link href="/" className="hover:text-[#2C2C2C]">
            Home
          </Link>{" "}
          ·{" "}
          <Link href="/agencies" className="hover:text-[#2C2C2C]">
            Agencies
          </Link>{" "}
          · <span className="text-[#2C2C2C]">{agency.company_name}</span>
        </p>

        <section className="rounded-3xl border border-[#2C2C2C]/10 bg-gradient-to-br from-[#FAF8F4] via-white to-[#6B9E6E]/12 p-6 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative mx-auto h-[120px] w-[120px] shrink-0 overflow-hidden rounded-full bg-white ring-4 ring-white shadow-md sm:mx-0">
                {agency.logo_url ? (
                  <SupabasePublicImage
                    src={agency.logo_url}
                    alt={agency.company_name}
                    fill
                    sizes="120px"
                    className="object-contain p-3"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center font-serif text-2xl font-bold text-[#2C2C2C]/40">
                    {agency.company_name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-center sm:text-left">
                <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
                  {agency.company_name}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                  Philippines
                  {foundedYear ? ` · Est. ${foundedYear}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#2C2C2C]/75">
                    <BadgeCheck className="h-4 w-4 text-[#D4A843]" />
                    Verified
                  </span>
                  <span className="text-sm font-semibold text-[#2C2C2C]/60">
                    {agents.length} verified agents
                  </span>
                  <span className="text-sm font-semibold text-[#2C2C2C]/60">
                    {totalListings} active listings
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full border-2 border-[#2C2C2C] bg-transparent px-6 py-2.5 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#2C2C2C] hover:text-white"
            >
              Contact agency
            </button>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">About {agency.company_name}</h2>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-[#2C2C2C]/75">{aboutText}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
            {agents.length} agents · {totalListings} listings · Nationwide coverage
          </p>
        </section>

        {agents.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Our Agents</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {agents.map((a) => (
                <Link
                  key={a.id}
                  href={`/agents/${encodeURIComponent(a.id)}`}
                  className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-black/10">
                    {a.image_url ? (
                      <SupabasePublicImage
                        src={a.image_url}
                        alt={a.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-lg font-bold text-[#2C2C2C]/35">
                        {a.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-center font-serif text-base font-bold text-[#2C2C2C]">{a.name}</p>
                  <div className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-[#2C2C2C]/55">
                    {a.verified ? <BadgeCheck className="h-3.5 w-3.5 text-[#D4A843]" /> : null}
                    <Star className="h-3.5 w-3.5 fill-[#D4A843] text-[#D4A843]" />
                    {a.score.toFixed(1)}
                  </div>
                  <p className="mt-1 text-center text-xs font-semibold text-[#2C2C2C]/50">
                    {a.listingCount} listings
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {properties.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Active Listings</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <NewlyListedCard
                  key={p.id}
                  property={p}
                  roomUrls={roomUrlsFor(p)}
                  roomIdx={cardRoomIdx[p.id] ?? 0}
                  onRoomPrev={() =>
                    setCardRoomIdx((s) => ({
                      ...s,
                      [p.id]:
                        (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) % Math.max(1, roomUrlsFor(p).length),
                    }))
                  }
                  onRoomNext={() =>
                    setCardRoomIdx((s) => ({
                      ...s,
                      [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                    }))
                  }
                  engagement={engagement}
                  connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                  onOpenPropertyZoom={() => setZoomProperty(p)}
                  grid
                  viewerUserId={user?.id ?? null}
                />
              ))}
            </div>
            {totalListings > 12 ? (
              <p className="mt-6 text-center">
                <Link href="/" className="text-sm font-bold text-[#6B9E6E] underline">
                  View all listings on BahayGo →
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}

        <HomeTrustStrip />
      </main>

      {zoomProperty ? (
        <PropertyZoomModal
          property={zoomProperty}
          agents={connectedAgentsByPropertyId.get(zoomProperty.id) ?? []}
          onClose={() => setZoomProperty(null)}
          engagement={engagement}
        />
      ) : null}
    </div>
  );
}
