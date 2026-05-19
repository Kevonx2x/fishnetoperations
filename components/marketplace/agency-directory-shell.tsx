"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, FileText, MapPin, Search, Users } from "lucide-react";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import {
  DIRECTORY_CITY_CHIPS,
  agencyCityLabel,
  agencyCoverUrl,
} from "@/lib/agency-demo-visuals";

const SKYLINE_HERO =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=2400&h=800&fit=crop";

export type AgencyDirectoryItem = {
  id: string;
  company_name: string;
  logo_url: string | null;
  verified: boolean;
  agentCount?: number;
};

type AgencyDirectoryShellProps = {
  agencies: AgencyDirectoryItem[];
  search: string;
  onSearchChange: (value: string) => void;
  cityFilter: string;
  onCityFilterChange: (city: string) => void;
  loading?: boolean;
};

function formatCount(n: number | undefined, singular: string, plural: string): string {
  if (n === undefined) return "—";
  if (n === 0) return `0 ${plural}`;
  return `${n} ${n === 1 ? singular : plural}`;
}

export function AgencyDirectoryShell({
  agencies,
  search,
  onSearchChange,
  cityFilter,
  onCityFilterChange,
  loading = false,
}: AgencyDirectoryShellProps) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-[#2C2C2C]/8">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SKYLINE_HERO} alt="" className="h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F4]/20 via-[#FAF8F4]/88 to-[#FAF8F4]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B9E6E]">BahayGo Marketplace</p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[#2C2C2C] sm:text-5xl md:text-6xl">
            Verified <span className="text-[#1F3B2C]">Agencies</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold text-[#2C2C2C]/60 sm:text-base">
            Browse PRC-licensed real estate agencies across the Philippines
          </p>
          <label className="relative mx-auto mt-8 block max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#2C2C2C]/40" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by agency name…"
              className="w-full rounded-full border border-[#2C2C2C]/10 bg-white py-4 pl-12 pr-5 text-sm font-semibold text-[#2C2C2C] shadow-lg outline-none transition focus:border-[#6B9E6E]/40"
            />
          </label>
          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
            {DIRECTORY_CITY_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCityFilterChange(c)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  cityFilter === c
                    ? "bg-[#1F3B2C] text-white shadow-sm"
                    : "border border-[#2C2C2C]/12 bg-white/90 text-[#2C2C2C]/70 hover:border-[#6B9E6E]/35"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-[#2C2C2C]/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.map((a) => {
              const city = agencyCityLabel(a.id);
              return (
                <Link
                  key={a.id}
                  href={`/agencies/${encodeURIComponent(a.id)}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#2C2C2C]/8 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#2C2C2C]/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={agencyCoverUrl(a.id)}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#2C2C2C]/70">
                      {city}
                    </span>
                  </div>
                  <div className="flex flex-1 items-center gap-3 px-4 pb-3 pt-0">
                    <div className="relative -mt-8 h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white shadow-md ring-2 ring-white">
                      {a.logo_url ? (
                        <SupabasePublicImage
                          src={a.logo_url}
                          alt={a.company_name}
                          fill
                          sizes="56px"
                          className="object-contain p-1.5"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center font-serif text-xs font-bold text-[#2C2C2C]/50">
                          {a.company_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-2">
                      <p className="truncate font-serif text-lg font-bold text-[#2C2C2C]">{a.company_name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#2C2C2C]/50">
                        <MapPin className="h-3 w-3 shrink-0 text-[#6B9E6E]" />
                        {city}, Philippines
                      </p>
                      {a.verified ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#D4A843]/18 px-2 py-0.5 text-[10px] font-bold text-[#8a6d32]">
                          <BadgeCheck className="h-3 w-3" />
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#2C2C2C]/10 text-[#2C2C2C]/45 transition group-hover:border-[#6B9E6E]/40 group-hover:bg-[#6B9E6E]/5 group-hover:text-[#6B9E6E]">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex gap-4 border-t border-[#2C2C2C]/6 px-4 py-3 text-xs font-semibold text-[#2C2C2C]/55">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#6B9E6E]" />
                      {formatCount(a.agentCount, "agent", "agents")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-[#6B9E6E]" />
                      Listings · —
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
