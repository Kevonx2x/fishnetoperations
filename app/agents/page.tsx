"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";

const SPECIALTIES = ["Luxury", "Rentals", "New Development", "Investment", "Commercial"] as const;
const LOCATIONS = ["Makati", "BGC", "Cebu", "Quezon City", "Ortigas", "Alabang"] as const;

function hashPick<T>(id: string, arr: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return arr[h % arr.length]!;
}

export default function AgentsIndexPage() {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTab, setSearchTab] = useState<"location" | "name">("location");
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("any");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("any");
  const [locationFilter, setLocationFilter] = useState<string>("any");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("agents")
        .select("id, user_id, name, image_url, score, closings, response_time, availability, brokers (id, company_name, logo_url)")
        .eq("status", "approved")
        .eq("verified", true);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setAgents([]);
      } else {
        setAgents((data ?? []).map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0])));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const withMeta = useMemo(
    () =>
      agents.map((a) => ({
        ...a,
        specialty: hashPick(a.id, SPECIALTIES),
        serviceArea: hashPick(a.id, LOCATIONS),
      })),
    [agents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withMeta.filter((a) => {
      if (availabilityFilter !== "any" && a.availability !== availabilityFilter) {
        return false;
      }
      if (specialtyFilter !== "any" && a.specialty !== specialtyFilter) return false;
      if (locationFilter !== "any" && a.serviceArea !== locationFilter) return false;
      if (!q) return true;
      if (searchTab === "name") {
        return a.name.toLowerCase().includes(q);
      }
      return (
        a.serviceArea.toLowerCase().includes(q) ||
        (a.company || a.brokerName || "").toLowerCase().includes(q)
      );
    });
  }, [withMeta, query, searchTab, availabilityFilter, specialtyFilter, locationFilter]);

  const availabilityOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of agents) {
      if (a.availability) s.add(a.availability);
    }
    return ["any", ...[...s].sort()];
  }, [agents]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />

      <section className="border-b border-[#2C2C2C]/10 bg-gradient-to-b from-white to-[#FAF8F4] px-4 py-14 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] sm:text-4xl md:text-5xl"
        >
          A great agent makes all the difference
        </motion.h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-[#2C2C2C]/55 sm:text-base">
          Search verified BahayGo agents by location or name. Compare closings, response scores, and specialties.
        </p>
      </section>

      <main className="mx-auto max-w-6xl px-4 pt-8 pb-12">
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap gap-2 border-b border-[#2C2C2C]/10 pb-4">
            <button
              type="button"
              onClick={() => setSearchTab("location")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                searchTab === "location"
                  ? "bg-[#7C9A7E] text-white ring-1 ring-[#C9A84C]/35"
                  : "bg-[#FAF8F4] text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-[#ebe6dc]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Search by Location
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSearchTab("name")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                searchTab === "name"
                  ? "bg-[#7C9A7E] text-white ring-1 ring-[#C9A84C]/35"
                  : "bg-[#FAF8F4] text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-[#ebe6dc]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <User className="h-4 w-4" />
                Search by Name
              </span>
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  searchTab === "location"
                    ? "City, neighborhood, or agency"
                    : "Agent first or last name"
                }
                className="w-full rounded-2xl border border-black/10 bg-[#FAF8F4] py-3 pl-10 pr-4 text-sm font-semibold text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">
              Availability
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
              >
                {availabilityOptions.map((o) => (
                  <option key={o} value={o}>
                    {o === "any" ? "Any" : o}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">
              Specialty
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
              >
                <option value="any">Any</option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">
              Location
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
              >
                <option value="any">Any</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? <div className="mt-8 h-40 rounded-2xl animate-pulse bg-black/5" /> : null}
        {!loading && error ? (
          <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load agents</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <p className="mt-8 text-sm font-semibold text-[#2C2C2C]/55">
              {filtered.length} of {agents.length} agents {query.trim() ? "match your search" : ""}
            </p>
            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {filtered.map((a, i) => (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
                    className="flex flex-col rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#FAF8F4] ring-1 ring-black/10">
                        {a.image ? <Image src={a.image} alt={a.name} fill sizes="80px" className="object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-[#2C2C2C]">{a.name}</p>
                          <VerifiedAgentBadge show />
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-[#2C2C2C]/55">
                          {a.company || a.brokerName || "Independent"}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C9A84C]">
                          {a.specialty}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#2C2C2C]/70">
                      <span className="rounded-full bg-[#7C9A7E]/12 px-3 py-1">{a.closings} closings</span>
                      <span className="rounded-full bg-[#C9A84C]/18 px-3 py-1 text-[#8a6d32]">
                        Response {a.responseTime || "—"}
                      </span>
                      <span className="rounded-full bg-[#FAF8F4] px-3 py-1 ring-1 ring-black/10">
                        Score {Math.round(a.score)}
                      </span>
                    </div>
                    <Link
                      href={`/agents/${encodeURIComponent(a.id)}`}
                      className="mt-4 inline-flex w-full justify-center rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7C9A7E]"
                    >
                      View Profile
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </>
        ) : null}
      </main>
    </div>
  );
}
