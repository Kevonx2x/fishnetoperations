"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Search } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { HomeTrustStrip } from "@/components/marketplace/home-trust-strip";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { supabase } from "@/lib/supabase";

type AgencyRow = {
  id: string;
  company_name: string;
  logo_url: string | null;
  verified: boolean;
  phone: string | null;
  created_at: string;
};

const CITY_CHIPS = ["All", "Makati", "BGC", "Ortigas", "Cebu", "Davao", "Clark"] as const;

function hashCity(id: string): string {
  const cities = ["Makati", "BGC", "Ortigas", "Cebu", "Davao", "Clark"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return cities[h % cities.length]!;
}

export default function AgenciesIndexPage() {
  const [rows, setRows] = useState<AgencyRow[]>([]);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [listingCounts, setListingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("All");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("agencies")
        .select("id, company_name, logo_url, verified, phone, created_at")
        .eq("status", "approved")
        .eq("verified", true)
        .order("company_name", { ascending: true });
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setRows([]);
        setAgentCounts({});
        setListingCounts({});
      } else {
        const list = (data ?? []) as unknown as AgencyRow[];
        setRows(list);
        const { data: agentsData } = await supabase
          .from("agents")
          .select("id, agency_id, user_id")
          .eq("status", "approved");
        const aCounts: Record<string, number> = {};
        const ownerIds: Record<string, string[]> = {};
        for (const r of list) {
          aCounts[r.id] = 0;
          ownerIds[r.id] = [];
        }
        for (const a of (agentsData ?? []) as { agency_id?: string | null; user_id?: string }[]) {
          const aid = a.agency_id;
          if (aid && aCounts[aid] !== undefined) {
            aCounts[aid] += 1;
            if (a.user_id) ownerIds[aid]!.push(a.user_id);
          }
        }
        setAgentCounts(aCounts);
        const lCounts: Record<string, number> = {};
        for (const r of list) {
          const ids = ownerIds[r.id] ?? [];
          if (!ids.length) {
            lCounts[r.id] = 0;
            continue;
          }
          const { count } = await supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .in("listed_by", ids)
            .is("deleted_at", null);
          lCounts[r.id] = count ?? 0;
        }
        setListingCounts(lCounts);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo(
    () =>
      rows.map((a) => ({
        ...a,
        city: hashCity(a.id),
        agentCount: agentCounts[a.id] ?? 0,
        listingCount: listingCounts[a.id] ?? 0,
      })),
    [rows, agentCounts, listingCounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((a) => {
      if (cityFilter !== "All" && a.city !== cityFilter) return false;
      if (q && !a.company_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, cityFilter]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <section className="border-b border-[#2C2C2C]/10 bg-gradient-to-br from-[#FAF8F4] via-white to-[#6B9E6E]/10 px-4 py-14 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] sm:text-4xl md:text-5xl"
        >
          Verified Agencies
        </motion.h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-[#2C2C2C]/55 sm:text-base">
          Browse PRC-licensed real estate agencies across the Philippines
        </p>
      </section>

      <main className="mx-auto max-w-6xl px-4 pt-8 pb-12">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/40" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by agency name…"
            className="w-full rounded-xl border border-[#2C2C2C]/10 bg-white py-3 pl-10 pr-4 text-sm font-semibold text-[#2C2C2C] shadow-sm outline-none focus:border-[#6B9E6E]/50"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          {CITY_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCityFilter(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                cityFilter === c
                  ? "bg-[#2C2C2C] text-white"
                  : "border border-[#2C2C2C]/15 bg-white text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? <div className="mt-8 h-40 animate-pulse rounded-2xl bg-black/5" /> : null}
        {!loading && error ? (
          <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load agencies</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.2) }}
              >
                <Link
                  href={`/agencies/${encodeURIComponent(a.id)}`}
                  className="flex h-full flex-col rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#FAF8F4] ring-1 ring-black/10">
                      {a.logo_url ? (
                        <SupabasePublicImage
                          src={a.logo_url}
                          alt={a.company_name}
                          fill
                          sizes="80px"
                          className="object-contain p-2"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-sm font-bold text-[#2C2C2C]/45">
                          {a.company_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg font-bold text-[#2C2C2C]">{a.company_name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#2C2C2C]/50">{a.city}</p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-0.5 text-[11px] font-bold text-[#8a6d32]">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-[#2C2C2C]/65">
                    {a.agentCount} agents · {a.listingCount} listings
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : null}

        <HomeTrustStrip />
      </main>
    </div>
  );
}
