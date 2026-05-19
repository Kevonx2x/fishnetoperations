"use client";

import { useEffect, useMemo, useState } from "react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { HomeTrustStrip } from "@/components/marketplace/home-trust-strip";
import {
  AgencyDirectoryShell,
  type AgencyDirectoryItem,
} from "@/components/marketplace/agency-directory-shell";
import { agencyCityLabel } from "@/lib/agency-demo-visuals";
import { supabase } from "@/lib/supabase";

export default function AgenciesIndexPage() {
  const [rows, setRows] = useState<AgencyDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("agencies")
        .select("id, company_name, logo_url, verified")
        .eq("status", "approved")
        .eq("verified", true)
        .order("company_name", { ascending: true });
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const list = (data ?? []) as AgencyDirectoryItem[];
      const { data: agentsData } = await supabase
        .from("agents")
        .select("agency_id")
        .eq("status", "approved");

      const counts: Record<string, number> = {};
      for (const a of list) counts[a.id] = 0;
      for (const row of (agentsData ?? []) as { agency_id?: string | null }[]) {
        if (row.agency_id && counts[row.agency_id] !== undefined) {
          counts[row.agency_id] += 1;
        }
      }

      setRows(list.map((a) => ({ ...a, agentCount: counts[a.id] ?? 0 })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((a) => {
      if (cityFilter !== "All" && agencyCityLabel(a.id) !== cityFilter) return false;
      if (q && !a.company_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, cityFilter]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <AgencyDirectoryShell
        agencies={filtered}
        search={search}
        onSearchChange={setSearch}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        loading={loading}
      />

      {!loading && error ? (
        <div className="mx-auto max-w-6xl px-4 pb-10">
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load agencies</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        </div>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <p className="mx-auto max-w-6xl px-4 pb-6 text-center text-sm font-semibold text-[#2C2C2C]/55">
          No agencies match your search.
        </p>
      ) : null}

      <div className="mx-auto max-w-6xl px-4">
        <HomeTrustStrip />
      </div>
    </div>
  );
}
