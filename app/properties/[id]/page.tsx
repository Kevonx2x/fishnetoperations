"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Mail, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { useSavedPropertyIds } from "@/lib/saved-properties";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { recordRecentlyViewedPropertyId } from "@/lib/recently-viewed";

type ListingAgentProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
} | null;

type PropertyRow = {
  id: string;
  created_at: string;
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

function showsAvailableNow(a: MarketplaceAgent): boolean {
  const v = a.availability.trim().toLowerCase();
  if (!v) return false;
  return /available|now|open|yes|immediate|today/.test(v);
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

  const saved = useSavedPropertyIds();
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  // lead form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
          id, created_at, location, price, sqft, beds, baths, image_url, listed_by, property_type, lat, lng,
          listing_agent:profiles!listed_by (id, full_name, avatar_url),
          property_agents (
            agent:agents (
              id, user_id, name, email, phone, image_url, score, closings, response_time, availability,
              verified, status,
              brokers (id, company_name, logo_url)
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

  const similar = useMemo(() => {
    // lightweight similar list: same inferred type or just top few newest
    return [] as PropertyRow[];
  }, []);

  const submit = async () => {
    if (!property) return;
    setOk(null);
    setErr(null);
    if (!name.trim() || !email.trim()) {
      setErr("Please enter your name and email.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() ? phone.trim() : null,
        property_interest: `${property.location} (${property.id})`,
        message: message.trim() ? message.trim() : null,
        source: "property_page",
        stage: "new",
        agent_id: property.listed_by ?? null,
        broker_id: null,
        client_id: null,
      });
      if (error) throw error;
      setOk("Request sent! We’ll reach out shortly.");
      setMessage("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
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
                  <p className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center text-sm font-semibold text-[#2C2C2C]/55 shadow-sm">
                    No agents currently listed for this property
                  </p>
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
                            {showsAvailableNow(a) ? (
                              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#6B9E6E]">
                                <span className="h-2 w-2 rounded-full bg-[#6B9E6E]" aria-hidden />
                                Available Now
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-[#2C2C2C]/50">
                              {a.email ? (
                                <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-[#6B9E6E]">
                                  <Mail className="h-3.5 w-3.5" />
                                  {a.email}
                                </a>
                              ) : null}
                              {a.phone ? (
                                <a href={`tel:${a.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-[#6B9E6E]">
                                  <Phone className="h-3.5 w-3.5" />
                                  {a.phone}
                                </a>
                              ) : null}
                            </div>
                            <div className="mt-3">
                              <Link
                                href={`/agents/${encodeURIComponent(a.id)}`}
                                className="inline-flex rounded-lg bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#5d8a60]"
                              >
                                Contact
                              </Link>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <aside className="lg:col-span-1">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#2C2C2C]">Viewing request</p>
                <p className="mt-1 text-xs text-[#2C2C2C]/55">
                  Request a viewing and we’ll connect you with an agent.
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
                    <p className="mt-2 text-xs font-semibold text-[#2C2C2C]/60">
                      {listingAgent.availability || "Available"}
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  <Field icon={<Mail className="h-4 w-4 text-[#6B9E6E]" />} value={email} onChange={setEmail} placeholder="Email" type="email" />
                  <Field icon={<Phone className="h-4 w-4 text-[#6B9E6E]" />} value={phone} onChange={setPhone} placeholder="Phone (optional)" type="tel" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-2xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Message (optional)"
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
                  />
                </div>

                {err ? (
                  <div className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700">
                    {err}
                  </div>
                ) : null}
                {ok ? (
                  <div className="mt-3 rounded-2xl bg-[#6B9E6E]/12 px-3 py-2 text-xs font-semibold text-[#2C2C2C]/70">
                    {ok}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy}
                  className={`mt-3 w-full rounded-full px-5 py-3 text-sm font-semibold shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 ${
                    busy
                      ? "cursor-not-allowed bg-[#2C2C2C]/10 text-[#2C2C2C]/40"
                      : "bg-[#2C2C2C] text-white hover:bg-[#6B9E6E] transition-colors"
                  }`}
                >
                  {busy ? "Sending…" : "Send request"}
                </button>
              </div>
            </aside>
          </div>
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

function Field({
  icon,
  value,
  onChange,
  placeholder,
  type,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5">
      <span className="shrink-0">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="w-full bg-transparent text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none"
      />
    </div>
  );
}

