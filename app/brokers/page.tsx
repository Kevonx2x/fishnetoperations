"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { BadgeCheck } from "lucide-react";

type BrokerRow = {
  id: string;
  name: string;
  company_name: string;
  license_number: string;
  email: string;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  status: string;
  verified: boolean;
};

const SPECIALTIES = ["Full-service", "Luxury", "Residential", "Commercial", "New Development"] as const;
const LOCATIONS = ["Metro Manila", "Cebu", "Davao", "Clark", "Iloilo"] as const;

function hashPick<T>(id: string, arr: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return arr[h % arr.length]!;
}

export default function BrokersIndexPage() {
  const [rows, setRows] = useState<BrokerRow[]>([]);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>("any");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("any");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("brokers")
        .select("id, name, company_name, license_number, email, phone, website, logo_url, status, verified")
        .eq("status", "approved")
        .eq("verified", true)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
        setAgentCounts({});
      } else {
        const list = (data ?? []) as unknown as BrokerRow[];
        setRows(list);
        const { data: agentsData } = await supabase.from("agents").select("id, broker_id");
        const counts: Record<string, number> = {};
        if (agentsData) {
          for (const r of list) counts[r.id] = 0;
          for (const a of agentsData as { broker_id?: string | null }[]) {
            const bid = a.broker_id;
            if (bid && counts[bid] !== undefined) counts[bid] += 1;
          }
        }
        setAgentCounts(counts);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo(
    () =>
      rows.map((b) => ({
        ...b,
        specialty: hashPick(b.id, SPECIALTIES),
        region: hashPick(b.id, LOCATIONS),
        agentCount: agentCounts[b.id] ?? 0,
      })),
    [rows, agentCounts],
  );

  const filtered = useMemo(() => {
    return enriched.filter((b) => {
      if (locationFilter !== "any" && b.region !== locationFilter) return false;
      if (specialtyFilter !== "any" && b.specialty !== specialtyFilter) return false;
      return true;
    });
  }, [enriched, locationFilter, specialtyFilter]);

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
          Find a Trusted Brokerage
        </motion.h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-[#2C2C2C]/55 sm:text-base">
          Every brokerage on BahayGo is verified. Filter by region and specialty, then open a profile.
        </p>
      </section>

      <main className="mx-auto max-w-6xl px-4 pt-8 pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">
            Region
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm"
            >
              <option value="any">Any</option>
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <label className="block flex-1 text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">
            Specialty
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm"
            >
              <option value="any">Any</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? <div className="mt-8 h-40 rounded-2xl animate-pulse bg-black/5" /> : null}
        {!loading && error ? (
          <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load brokers</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.24) }}
                className="flex flex-col rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#FAF8F4] ring-1 ring-black/10">
                    {b.logo_url ? <Image src={b.logo_url} alt={b.company_name} fill sizes="56px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg font-bold text-[#2C2C2C]">{b.company_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-1 text-[11px] font-bold text-[#8a6d32]"
                        title="Verified brokerage"
                      >
                        <BadgeCheck className="h-3.5 w-3.5 text-[#D4A843]" />
                        Verified
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2C2C2C]/45">
                        {b.region}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">{b.specialty}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-xs font-semibold text-[#2C2C2C]/65">
                  <div>Agents: {b.agentCount}</div>
                  <div className="truncate">License: {b.license_number}</div>
                </div>
                <Link
                  href={`/brokers/${encodeURIComponent(b.id)}`}
                  className="mt-4 inline-flex w-full justify-center rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6B9E6E]"
                >
                  View Brokerage
                </Link>
              </motion.div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
