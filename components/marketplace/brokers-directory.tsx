"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Phone, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

type BrokerCardRow = {
  id: string;
  company_name: string;
  logo_url: string | null;
  verified: boolean;
  phone: string | null;
  agents?: { count: number }[] | null;
};

function FinnEmpty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-8 text-center">
      <div className="mx-auto w-fit rounded-3xl bg-[#FAF8F4] p-4 shadow-inner shadow-black/5">
        <svg viewBox="0 0 128 128" className="h-16 w-16" role="img" aria-label="Finn mascot">
          <path
            d="M18 56 L64 22 L110 56 V108 C110 112.4 106.4 116 102 116 H26 C21.6 116 18 112.4 18 108 Z"
            fill="#FFFFFF"
            stroke="rgba(44,44,44,0.18)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M12 58 L64 18 L116 58"
            fill="none"
            stroke="#D4A843"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="48" cy="70" r="6" fill="#2C2C2C" opacity="0.9" />
          <circle cx="80" cy="70" r="6" fill="#2C2C2C" opacity="0.9" />
          <path
            d="M52 86 C58 94, 70 94, 76 86"
            fill="none"
            stroke="#2C2C2C"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      </div>
      <p className="mt-4 font-serif text-lg font-bold text-[#2C2C2C]">{title}</p>
      <p className="mt-1 text-sm text-[#2C2C2C]/55">{subtitle}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 animate-pulse rounded-xl bg-black/8" />
        <div className="flex-1">
          <div className="h-4 w-2/3 animate-pulse rounded bg-black/8" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-black/8" />
          <div className="mt-3 h-3 w-5/6 animate-pulse rounded bg-black/8" />
        </div>
      </div>
    </div>
  );
}

export function BrokersDirectory() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BrokerCardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("brokers")
        .select("id, company_name, logo_url, verified, phone, agents(count)")
        .eq("status", "approved")
        .eq("verified", true)
        .order("company_name", { ascending: true });

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as BrokerCardRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => rows, [rows]);

  return (
    <section className="px-4 pt-4 pb-24">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
            Brokers
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
            Verified Broker Directory
          </h2>
        </div>
        <div className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70">
          {loading ? "Loading…" : `${cards.length} verified`}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <FinnEmpty
          title="Couldn’t load brokers"
          subtitle={error}
        />
      )}

      {!loading && !error && cards.length === 0 && (
        <FinnEmpty
          title="No verified brokers yet"
          subtitle="Once brokerages are approved, they’ll show up here."
        />
      )}

      {!loading && !error && cards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((b) => (
            <motion.div
              key={b.id}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="h-full"
            >
              <Link
                href={`/brokers/${encodeURIComponent(b.id)}`}
                className="block h-full rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm transition-colors hover:bg-[#FAF8F4]/60"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#FAF8F4] ring-1 ring-black/10">
                    {b.logo_url ? (
                      <Image
                        src={b.logo_url}
                        alt={b.company_name}
                        fill
                        sizes="48px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-bold text-[#2C2C2C]/45">
                        {b.company_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-serif text-base font-bold text-[#2C2C2C]">
                        {b.company_name}
                      </p>
                      {b.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-1 text-[11px] font-bold text-[#8a6d32]">
                          <BadgeCheck className="h-3.5 w-3.5 text-[#D4A843]" />
                          Verified
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#2C2C2C]/55">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-[#6B9E6E]" />
                        {agentCountFromRow(b)} agents
                      </span>
                      {b.phone ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Phone className="h-3.5 w-3.5 text-[#6B9E6E]" />
                          {b.phone}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

function agentCountFromRow(b: BrokerCardRow): number {
  const count = b.agents?.[0]?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

