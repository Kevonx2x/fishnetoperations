"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Mail, Phone, Star, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { AgentDirectoryCard } from "@/components/marketplace/agent-directory-card";
import { AgentContactOptionsModal } from "@/components/marketplace/agent-contact-options-modal";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";
import { ViewingRequestModal } from "@/components/marketplace/viewing-request-modal";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import { useAuth } from "@/contexts/auth-context";
import { formatAgentScore } from "@/lib/format-agent-score";
import { fetchSimilarAgents } from "@/lib/similar-agents";

type AgentRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  image_url: string | null;
  license_number: string;
  score: number;
  closings: number;
  response_time: string | null;
  availability: string | null;
  broker_id: string | null;
  user_id: string;
  verified?: boolean;
  status?: string;
  brokers?: { id: string; company_name: string; logo_url: string | null } | null;
  profiles?: { email?: string | null; phone?: string | null } | null;
};

type ListingRow = {
  id: string;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string;
  created_at: string;
};

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

  const contactModalAgent = useMemo<MarketplaceAgent | null>(() => {
    if (!agent) return null;
    return mapRowToMarketplaceAgent(agent as Parameters<typeof mapRowToMarketplaceAgent>[0]);
  }, [agent]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("agents")
        .select("*, brokers(*), profiles(email, phone)")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setError(error.message);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agent?.user_id) return;
      const { data } = await supabase
        .from("properties")
        .select("id, created_at, location, price, beds, baths, sqft, image_url")
        .eq("listed_by", agent.user_id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setListings((data ?? []) as unknown as ListingRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [agent?.user_id]);

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

  const onScheduleViewing = () => {
    if (authLoading) return;
    if (!user) {
      setSignInPromptOpen(true);
      return;
    }
    setShowViewingModal(true);
  };

  const memberSince = (() => {
    if (!agent?.created_at) return "";
    const d = new Date(agent.created_at);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString(undefined, { year: "numeric", month: "short" })
      : "";
  })();

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-12">
        <div className="mb-4 text-sm font-semibold text-[#2C2C2C]/65">
          <Link href="/" className="hover:text-[#2C2C2C]">Home</Link> <span>·</span>{" "}
          <Link href="/agents" className="hover:text-[#2C2C2C]">Agents</Link> <span>·</span>{" "}
          <span className="text-[#2C2C2C]">Profile</span>
        </div>

        {loading && <div className="h-56 rounded-2xl animate-pulse bg-black/5" />}

        {!loading && error && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load agent</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        )}

        {!loading && !error && agent && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-[#FAF8F4] ring-1 ring-black/10">
                    {agent.image_url ? (
                      <Image src={agent.image_url} alt={agent.name} fill sizes="80px" className="object-cover" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
                        {agent.name}
                      </h1>
                      <VerifiedAgentBadge show />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/60">
                      {agent.brokers?.company_name ?? "Independent"} · License {agent.license_number}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
                      Member since {memberSince || "—"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/75">
                        <Trophy className="h-4 w-4 text-[#6B9E6E]" />
                        {agent.closings} closings
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/75">
                        <Clock className="h-4 w-4 text-[#6B9E6E]" />
                        {agent.response_time ?? "Fast"} response
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#D4A843]/18 px-3 py-1 text-xs font-semibold text-[#8a6d32]">
                        <Star className="h-4 w-4 text-[#D4A843]" />
                        Score {formatAgentScore(agent.score)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
                  >
                    <Mail className="h-4 w-4" />
                    Contact
                  </button>
                  <button
                    type="button"
                    onClick={onScheduleViewing}
                    disabled={authLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Calendar className="h-4 w-4 text-[#6B9E6E]" />
                    Schedule
                  </button>
                  {agent.phone ? (
                    <a
                      href={`tel:${agent.phone}`}
                      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
                    >
                      <Phone className="h-4 w-4 text-[#6B9E6E]" />
                      Call
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-[#2C2C2C]">Active listings</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {listings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-6 text-sm text-[#2C2C2C]/55">
                      No active listings yet.
                    </div>
                  ) : (
                    listings.map((p) => (
                      <Link
                        key={p.id}
                        href={`/properties/${encodeURIComponent(p.id)}`}
                        className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm hover:bg-[#FAF8F4]/60"
                      >
                        <div className="relative aspect-[4/3] w-full bg-black/5">
                          <Image src={p.image_url} alt={p.location} fill sizes="420px" className="object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3">
                            <p className="font-serif text-lg font-bold text-white">{p.price}</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="font-semibold text-[#2C2C2C]">{p.location}</p>
                          <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/60">
                            {p.beds} bd · {p.baths} ba · {p.sqft} sqft
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>

            <aside className="lg:col-span-1">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-4 shadow-sm">
                <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">Similar Agents</h2>
                <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                  Same brokerage first, then similar ratings (±0.5).
                </p>
                {similarLoading ? (
                  <div className="mt-4 space-y-3">
                    <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
                    <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
                  </div>
                ) : similarAgents.length === 0 ? (
                  <p className="mt-4 text-sm font-semibold text-[#2C2C2C]/45">No similar agents to show yet.</p>
                ) : (
                  <div className="mt-4 flex flex-col gap-4">
                    {similarAgents.map((a) => (
                      <AgentDirectoryCard key={a.id} agent={a} className="w-full shrink-0" />
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {!loading && !error && agent && (
          <>
            <ViewingRequestModal
              open={showViewingModal}
              onOpenChange={setShowViewingModal}
              propertyId={null}
              propertyTitle={`Viewing with ${agent.name}`}
              agentUserId={agent.user_id}
            />
            <SignInViewingPromptModal open={signInPromptOpen} onOpenChange={setSignInPromptOpen} />
            <AgentContactOptionsModal
              open={showContactModal}
              onOpenChange={setShowContactModal}
              agent={contactModalAgent}
            />
          </>
        )}
      </main>
    </div>
  );
}

