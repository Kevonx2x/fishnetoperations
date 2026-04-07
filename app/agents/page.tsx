"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { AgentDirectoryCard } from "@/components/marketplace/agent-directory-card";
import { FinnMascot } from "@/components/marketplace/mascots/finn-mascot";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PhLocationInput } from "@/components/ui/ph-location-input";

const SPECIALTY_CHIPS = [
  { key: "all", label: "All" },
  { key: "luxury", label: "Luxury" },
  { key: "condo", label: "Condo" },
  { key: "house-lot", label: "House & Lot" },
  { key: "commercial", label: "Commercial" },
  { key: "rental", label: "Rental" },
] as const;

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "closings", label: "Most Closings" },
  { value: "newest", label: "Newest" },
] as const;

type SpecialtyKey = (typeof SPECIALTY_CHIPS)[number]["key"];
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

type AgentWithMeta = MarketplaceAgent & {
  specialtiesText: string;
  createdAt: string;
  serviceAreasText: string;
};

function hashPick<T>(id: string, arr: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return arr[h % arr.length]!;
}

const SYNTHETIC_CHIPS: Exclude<SpecialtyKey, "all">[] = [
  "luxury",
  "condo",
  "house-lot",
  "commercial",
  "rental",
];

function syntheticSpecialty(agentId: string): Exclude<SpecialtyKey, "all"> {
  return hashPick(agentId, SYNTHETIC_CHIPS);
}

/** When `loc` is set, agent must list overlapping text in `service_areas`. */
function matchesAgentServiceArea(serviceAreas: string, loc: string): boolean {
  const l = loc.trim().toLowerCase();
  if (!l) return true;
  const sa = serviceAreas.trim().toLowerCase();
  if (!sa) return false;
  if (sa.includes(l)) return true;
  for (const part of l.split(",")) {
    const p = part.trim();
    if (p && sa.includes(p)) return true;
  }
  return false;
}

function matchesSpecialty(chip: SpecialtyKey, specialtiesText: string, agentId: string): boolean {
  if (chip === "all") return true;
  const t = specialtiesText.trim().toLowerCase();
  if (t.length > 0) {
    switch (chip) {
      case "luxury":
        return /\b(luxury|luxuries|high-end|high end|premium|exclusive)\b/i.test(t) || t.includes("luxury");
      case "condo":
        return /\b(condo|condominium|condos)\b/i.test(t);
      case "house-lot":
        return /\b(house|lot|townhouse|single[\s-]?family|residential|landed)\b/i.test(t);
      case "commercial":
        return /\b(commercial|office|retail|industrial|warehouse)\b/i.test(t);
      case "rental":
        return /\b(rent|rental|rentals|lease|leasing|landlord)\b/i.test(t);
      default:
        return true;
    }
  }
  return syntheticSpecialty(agentId) === chip;
}

function AgentsDirectoryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const loc = searchParams.get("loc") ?? "";
  const verifiedOnly = searchParams.get("verified") === "1";
  const sortParam = searchParams.get("sort") ?? "score";
  const specialtyParam = (searchParams.get("specialty") ?? "all") as SpecialtyKey;

  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === sortParam) ? (sortParam as SortKey) : "score";
  const specialty: SpecialtyKey = SPECIALTY_CHIPS.some((c) => c.key === specialtyParam)
    ? specialtyParam
    : "all";

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        if (value === null || value === "") p.delete(key);
        else p.set(key, value);
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [agents, setAgents] = useState<AgentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("agents")
        .select("*, brokers(*), profiles(email, phone)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setAgents([]);
      } else {
        setAgents(
          (data ?? []).map((row) => {
            const r = row as Record<string, unknown>;
            return {
              ...mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]),
              specialtiesText: typeof r.specialties === "string" ? r.specialties : "",
              createdAt: typeof r.created_at === "string" ? r.created_at : "",
              serviceAreasText: typeof r.service_areas === "string" ? r.service_areas : "",
            };
          }),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = agents.filter((a) => {
      if (verifiedOnly && !a.verified) return false;
      if (needle && !a.name.toLowerCase().includes(needle)) return false;
      if (!matchesAgentServiceArea(a.serviceAreasText, loc)) return false;
      if (!matchesSpecialty(specialty, a.specialtiesText, a.id)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "closings") return b.closings - a.closings;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [agents, q, loc, verifiedOnly, sort, specialty]);

  const searchInput = (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
        Search by name
      </span>
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/35" />
        <input
          value={q}
          onChange={(e) => setParams({ q: e.target.value || null })}
          placeholder="Type to filter agents…"
          className="w-full rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] py-3 pl-10 pr-4 text-sm font-semibold text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843]/40"
        />
      </div>
    </label>
  );

  const locationInput = (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
        Service area
      </span>
      <PhLocationInput
        value={loc}
        onChange={(v) => setParams({ loc: v.trim() || null })}
        placeholder="Area or city (matches profile)"
        className="mt-1.5 w-full"
      />
    </label>
  );

  const filterControlsSecondary = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
          Verified only
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={verifiedOnly}
          onClick={() => setParams({ verified: verifiedOnly ? null : "1" })}
          className={cn(
            "relative h-8 w-14 shrink-0 rounded-full border border-transparent transition-colors",
            verifiedOnly ? "bg-[#6B9E6E]" : "bg-[#2C2C2C]/20",
          )}
        >
          <span
            className={cn(
              "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
              verifiedOnly ? "translate-x-6" : "translate-x-0",
            )}
          />
        </button>
      </div>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
          Sort by
        </span>
        <select
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value === "score" ? null : e.target.value })}
          className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/45">
          Specialty
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SPECIALTY_CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setParams({ specialty: c.key === "all" ? null : c.key })}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition",
                specialty === c.key
                  ? "bg-[#6B9E6E] text-white ring-1 ring-[#D4A843]/35"
                  : "bg-white text-[#2C2C2C]/70 ring-1 ring-[#2C2C2C]/10 hover:bg-[#FAF8F4]",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const filterControls = (
    <div className="flex flex-col gap-4">
      {searchInput}
      {locationInput}
      {filterControlsSecondary}
    </div>
  );

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
          Search BahayGo agents by name, specialty, and more. Compare scores, closings, and verified status.
        </p>
      </section>

      <main className="mx-auto max-w-6xl px-4 pt-8 pb-12">
        {/* Mobile: search always visible; other filters in drawer */}
        <div className="mb-4 space-y-3 md:hidden">
          {searchInput}
          {locationInput}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#2C2C2C]/70">
              Showing <span className="font-bold text-[#2C2C2C]">{loading ? "…" : filteredSorted.length}</span>{" "}
              agents
            </p>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-sm font-bold text-[#2C2C2C] shadow-sm ring-1 ring-[#D4A843]/20"
            >
              <Filter className="h-4 w-4 text-[#6B9E6E]" />
              Filters
            </button>
          </div>
        </div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl border-[#2C2C2C]/10 bg-[#FAF8F4] p-6">
            <SheetHeader className="text-left">
              <SheetTitle className="font-serif text-xl text-[#2C2C2C]">Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{filterControlsSecondary}</div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-6 w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#6B9E6E]"
            >
              Show results
            </button>
          </SheetContent>
        </Sheet>

        {/* Desktop: full filter bar */}
        <div className="hidden rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm md:block md:p-6">
          {filterControls}
        </div>

        <div className="mt-6 hidden items-center justify-between md:flex">
          <p className="text-sm font-semibold text-[#2C2C2C]/70">
            Showing <span className="font-bold text-[#2C2C2C]">{loading ? "…" : filteredSorted.length}</span>{" "}
            agents
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                void navigator.clipboard.writeText(window.location.href);
              }
            }}
            className="text-xs font-semibold text-[#6B9E6E] underline-offset-2 hover:underline"
          >
            Copy link to this search
          </button>
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
            {filteredSorted.length === 0 ? (
              <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white px-6 py-14 text-center">
                <FinnMascot mood="sad" size={112} className="mx-auto" />
                <p className="mt-6 font-serif text-xl font-bold text-[#2C2C2C]">No agents match</p>
                <p className="mt-2 max-w-md text-sm font-semibold text-[#2C2C2C]/55">
                  Try adjusting your search or filters — or clear filters to see everyone again.
                </p>
                <button
                  type="button"
                  onClick={() => router.replace(pathname, { scroll: false })}
                  className="mt-6 rounded-full bg-[#D4A843] px-6 py-2.5 text-sm font-bold text-[#2C2C2C] hover:brightness-95"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  layout
                  className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {filteredSorted.map((a, i) => (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
                    >
                      <AgentDirectoryCard agent={a} className="w-full" />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function AgentsIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF8F4]">
          <MaddenTopNav />
          <div className="mx-auto max-w-6xl px-4 pt-8">
            <div className="h-40 rounded-2xl animate-pulse bg-black/5" />
          </div>
        </div>
      }
    >
      <AgentsDirectoryContent />
    </Suspense>
  );
}
