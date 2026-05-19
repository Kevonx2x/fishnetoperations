"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bookmark,
  Building2,
  ExternalLink,
  FileText,
  Globe2,
  MapPin,
  Shield,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { agencyCoverUrl, agencyMemberSince } from "@/lib/agency-demo-visuals";

export type AgencyProfileShellAgency = {
  id: string;
  company_name: string;
  bio: string | null;
  logo_url: string | null;
  created_at: string | null;
  verified: boolean;
};

export type AgencyProfileShellAgent = {
  id: string;
  name: string;
  image_url: string | null;
  verified: boolean;
};

export type AgencyProfileStats = {
  agentCount?: number;
};

type AgencyProfileShellProps = {
  agency: AgencyProfileShellAgency;
  agents?: AgencyProfileShellAgent[];
  stats?: AgencyProfileStats;
  listingsSlot?: ReactNode;
};

const METRICS = [
  { key: "active", label: "Active Listings", sub: "On BahayGo", icon: Building2 },
  { key: "agents", label: "Verified Agents", sub: "Licensed team", icon: Users },
  { key: "total", label: "Total Listings", sub: "Portfolio", icon: FileText },
  { key: "cities", label: "Cities Covered", sub: "Nationwide", icon: MapPin },
  { key: "closed", label: "Transactions Closed", sub: "This year", icon: Star },
] as const;

const WHY_CHOOSE = [
  { title: "Trusted professionals", body: "Licensed agents vetted on BahayGo", icon: Shield },
  { title: "Fast & responsive", body: "Timely replies to client inquiries", icon: Zap },
  { title: "Wide coverage", body: "Listings across major PH markets", icon: Globe2 },
  { title: "Transparent process", body: "Clear steps from inquiry to closing", icon: BadgeCheck },
] as const;

function metricValue(key: (typeof METRICS)[number]["key"], stats?: AgencyProfileStats): string {
  if (key === "agents" && stats?.agentCount !== undefined) {
    return String(stats.agentCount);
  }
  return "—";
}

function metricSub(key: (typeof METRICS)[number]["key"], stats?: AgencyProfileStats): string {
  if (key === "agents" && stats?.agentCount !== undefined && stats.agentCount > 0) {
    return "On your profile";
  }
  return METRICS.find((m) => m.key === key)?.sub ?? "";
}

function AgentShellCard({ agent }: { agent: AgencyProfileShellAgent }) {
  const href = `/agents/${encodeURIComponent(agent.id)}`;

  return (
    <Link
      href={href}
      className="min-w-[200px] shrink-0 rounded-2xl border border-[#2C2C2C]/8 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full bg-[#FAF8F4] ring-2 ring-white">
        {agent.image_url ? (
          <SupabasePublicImage src={agent.image_url} alt={agent.name} fill sizes="64px" className="object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-lg font-bold text-[#2C2C2C]/30">
            {agent.name.slice(0, 1)}
          </span>
        )}
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#6B9E6E]" />
      </div>
      <p className="mt-3 flex items-center justify-center gap-1 text-center text-sm font-bold text-[#2C2C2C]">
        {agent.name}
        {agent.verified ? <BadgeCheck className="h-3.5 w-3.5 text-[#D4A843]" /> : null}
      </p>
      <div className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-[#2C2C2C]/55">
        <Star className="h-3 w-3 fill-[#D4A843] text-[#D4A843]" />
        <span className="text-[#2C2C2C]/35">—</span>
        <span className="text-[#2C2C2C]/40">·</span>
        <span>Listings —</span>
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold text-[#6B9E6E]">Active on BahayGo</p>
    </Link>
  );
}

export function AgencyProfileShell({ agency, agents = [], stats, listingsSlot }: AgencyProfileShellProps) {
  const memberSince = agencyMemberSince(agency.created_at);
  const cover = agencyCoverUrl(agency.id);
  const tagline =
    agency.bio?.trim() ||
    `${agency.company_name} is a PRC-licensed real estate agency on BahayGo. Professional representation for buyers and renters across the Philippines.`;

  return (
    <div className="pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-[#2C2C2C]/8 bg-white shadow-sm">
        <div className="relative h-48 w-full sm:h-56 md:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F4] via-black/20 to-black/10" />
        </div>

        <div className="relative px-5 pb-8 pt-0 sm:px-8 md:px-10">
          <div className="-mt-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative mx-auto h-[120px] w-[120px] shrink-0 sm:mx-0">
                <div className="h-full w-full overflow-hidden rounded-2xl bg-white shadow-lg ring-4 ring-white">
                  {agency.logo_url ? (
                    <SupabasePublicImage
                      src={agency.logo_url}
                      alt={agency.company_name}
                      fill
                      sizes="120px"
                      className="object-contain p-3"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center font-serif text-2xl font-bold text-[#2C2C2C]/35">
                      {agency.company_name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                {agency.verified ? (
                  <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-[#D4A843] text-white shadow-md ring-2 ring-white">
                    <BadgeCheck className="h-4 w-4" />
                  </span>
                ) : null}
              </div>

              <div className="text-center sm:text-left">
                <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
                  {agency.company_name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {agency.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E]/15 px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C]">
                      <BadgeCheck className="h-3.5 w-3.5 text-[#6B9E6E]" /> Verified Agency
                    </span>
                  ) : null}
                  <span className="rounded-full bg-[#6B9E6E]/10 px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C]/80">
                    PRC-Licensed
                  </span>
                  <span className="rounded-full bg-[#D4A843]/20 px-2.5 py-1 text-[11px] font-bold text-[#8a6d32]">
                    BahayGo Partner
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
                  Philippines{memberSince ? ` · ${memberSince}` : ""}
                </p>
                <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#2C2C2C]/70">{tagline}</p>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:min-w-[220px]">
              <button
                type="button"
                className="rounded-xl bg-[#1F3B2C] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#2C2C2C]"
              >
                Contact agency
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2C2C2C]/15 bg-white px-6 py-3 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#FAF8F4]"
              >
                <Bookmark className="h-4 w-4" /> Follow
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#2C2C2C]/50">
                <Zap className="h-3.5 w-3.5 text-[#6B9E6E]" />
                Responds within business hours
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {METRICS.map((m) => {
          const value = metricValue(m.key, stats);
          const filled = value !== "—";
          return (
            <div
              key={m.label}
              className="rounded-2xl border border-[#2C2C2C]/8 bg-white px-4 py-4 shadow-sm"
            >
              <m.icon className="mb-2 h-4 w-4 text-[#6B9E6E]" aria-hidden />
              <span
                className={`font-serif text-2xl font-bold tabular-nums ${
                  filled ? "text-[#2C2C2C]" : "text-[#2C2C2C]/30"
                }`}
              >
                {value}
              </span>
              <p className="mt-1 text-xs font-bold text-[#2C2C2C]/70">{m.label}</p>
              <p className="text-[10px] font-semibold text-[#2C2C2C]/45">{metricSub(m.key, stats)}</p>
            </div>
          );
        })}
      </section>

      {agents.length > 0 ? (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Our Agents</h2>
            <span className="text-sm font-semibold text-[#6B9E6E]/70">View all agents →</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {agents.slice(0, 8).map((a) => (
              <AgentShellCard key={a.id} agent={a} />
            ))}
          </div>
        </section>
      ) : null}

      {listingsSlot}

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">About {agency.company_name}</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-[#2C2C2C]/70">
            {agency.bio?.trim() ||
              `${agency.company_name} partners with BahayGo to present verified listings and licensed agents across the Philippines.`}
          </p>
          <span className="mt-4 inline-block text-sm font-bold text-[#6B9E6E]">Learn more →</span>
        </div>
        <div className="rounded-2xl border border-[#2C2C2C]/8 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Why clients choose us</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {WHY_CHOOSE.map((w) => (
              <div key={w.title} className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#6B9E6E]/10">
                  <w.icon className="h-5 w-5 text-[#6B9E6E]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2C2C2C]">{w.title}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#2C2C2C]/55">{w.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/10 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-[#2C2C2C]">PRC-Licensed & BahayGo Verified</p>
          <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/60">
            Registered with the Professional Regulation Commission. Credentials on file with BahayGo.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-xs font-bold text-[#2C2C2C] shadow-sm"
        >
          View license <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </section>
    </div>
  );
}
