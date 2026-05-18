"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { BadgeCheck, Building2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AgencyCardRow = {
  id: string;
  company_name: string;
  logo_url: string | null;
  verified: boolean;
  agents?: { count: number }[] | null;
};

function DirectoryEmpty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-8 text-center">
      <Building2 className="mx-auto h-8 w-8 text-[#6B9E6E]" aria-hidden />
      <p className="mt-4 font-serif text-lg font-bold text-[#2C2C2C]">{title}</p>
      <p className="mt-1 text-sm text-[#2C2C2C]/55">{subtitle}</p>
    </div>
  );
}

export function AgenciesDirectory() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgencyCardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("agencies")
        .select("id, company_name, logo_url, verified, agents(count)")
        .eq("status", "approved")
        .eq("verified", true)
        .order("company_name", { ascending: true });
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setRows([]);
      } else {
        setRows((data ?? []) as unknown as AgencyCardRow[]);
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">Agencies</p>
          <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
            Verified Agency Directory
          </h2>
        </div>
        <div className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70">
          {loading ? "Loading…" : `${cards.length} verified`}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      ) : null}

      {!loading && error ? <DirectoryEmpty title="Couldn’t load agencies" subtitle={error} /> : null}

      {!loading && !error && cards.length === 0 ? (
        <DirectoryEmpty
          title="No verified agencies yet"
          subtitle="Once agencies are approved, they’ll show up here."
        />
      ) : null}

      {!loading && !error && cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((b) => (
            <motion.div key={b.id} whileHover={{ y: -2 }}>
              <Link
                href={`/agencies/${encodeURIComponent(b.id)}`}
                className="block rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm hover:bg-[#FAF8F4]/60"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#FAF8F4] ring-1 ring-black/10">
                    {b.logo_url ? (
                      <SupabasePublicImage
                        src={b.logo_url}
                        alt={b.company_name}
                        fill
                        sizes="48px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-xs font-bold text-[#2C2C2C]/45">
                        {b.company_name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-base font-bold text-[#2C2C2C]">
                      {b.company_name}
                    </p>
                    {b.verified ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-0.5 text-[11px] font-bold text-[#8a6d32]">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    ) : null}
                    <p className="mt-2 text-xs font-semibold text-[#2C2C2C]/55">
                      {agentCountFromRow(b)} agents
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function agentCountFromRow(b: AgencyCardRow): number {
  const count = b.agents?.[0]?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}
