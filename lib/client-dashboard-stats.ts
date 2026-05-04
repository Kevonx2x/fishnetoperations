import type { SupabaseClient } from "@supabase/supabase-js";

import { manilaCalendarAddDays, manilaDateStringFromInstant, manilaLocalDateTimeToOffsetIso } from "@/lib/manila-datetime";

export type ClientDashboardViewingTodayRow = {
  scheduled_at: string;
  city: string | null;
};

export type ClientDashboardDealStats = {
  activeDeals: number;
  activeDealsUpdatedLast24h: number;
};

/**
 * Active pipeline deals for the client (excludes closed, declined, client-archived).
 */
export async function fetchClientDealStats(
  supabase: SupabaseClient,
  clientId: string,
): Promise<{ ok: true; data: ClientDashboardDealStats } | { ok: false }> {
  try {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const activeQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("archived_by_client", false)
      .not("pipeline_stage", "in", "(closed,declined)");

    const updatedQ = supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("archived_by_client", false)
      .not("pipeline_stage", "in", "(closed,declined)")
      .gte("updated_at", sinceIso);

    const [{ count: activeDeals, error: e1 }, { count: activeDealsUpdatedLast24h, error: e2 }] = await Promise.all([
      activeQ,
      updatedQ,
    ]);

    if (e1 || e2) return { ok: false };

    return {
      ok: true,
      data: {
        activeDeals: activeDeals ?? 0,
        activeDealsUpdatedLast24h: activeDealsUpdatedLast24h ?? 0,
      },
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Scheduled viewings for the client whose Manila calendar day is "today", earliest first.
 */
export async function fetchClientViewingsTodayManila(
  supabase: SupabaseClient,
  clientId: string,
): Promise<{ ok: true; rows: ClientDashboardViewingTodayRow[] } | { ok: false }> {
  try {
    const todayYmd = manilaDateStringFromInstant(new Date());
    const nextYmd = manilaCalendarAddDays(todayYmd, 1);
    const startIso = manilaLocalDateTimeToOffsetIso(todayYmd, "00:00");
    const endIso = manilaLocalDateTimeToOffsetIso(nextYmd, "00:00");

    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("id, property_id")
      .eq("client_id", clientId);

    if (leadsErr) return { ok: false };
    if (!leads?.length) {
      return { ok: true, rows: [] };
    }

    const leadIds = (leads as { id: unknown }[])
      .map((r) => (typeof r.id === "number" ? r.id : Number(r.id)))
      .filter((id) => Number.isFinite(id));

    if (!leadIds.length) return { ok: true, rows: [] };

    const leadProp = new Map<number, string | null>();
    for (const l of leads as { id: unknown; property_id: string | null }[]) {
      const id = typeof l.id === "number" ? l.id : Number(l.id);
      if (!Number.isFinite(id)) continue;
      leadProp.set(id, l.property_id?.trim() ? l.property_id : null);
    }

    const { data: viewings, error: vErr } = await supabase
      .from("viewings")
      .select("scheduled_at, lead_id")
      .in("lead_id", leadIds)
      .eq("status", "scheduled")
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at", { ascending: true });

    if (vErr) return { ok: false };

    const rows = (viewings ?? []) as { scheduled_at: string; lead_id: number }[];
    if (!rows.length) return { ok: true, rows: [] };

    const propertyIds = [
      ...new Set(
        rows
          .map((v) => leadProp.get(v.lead_id))
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
      ),
    ];

    const cityByProperty = new Map<string, string | null>();
    if (propertyIds.length) {
      const { data: props, error: pErr } = await supabase.from("properties").select("id, city").in("id", propertyIds);
      if (pErr) return { ok: false };
      for (const p of (props ?? []) as { id: string; city: string | null }[]) {
        cityByProperty.set(p.id, p.city ?? null);
      }
    }

    const out: ClientDashboardViewingTodayRow[] = rows.map((v) => {
      const pid = leadProp.get(v.lead_id);
      const city = pid ? cityByProperty.get(pid) ?? null : null;
      return { scheduled_at: v.scheduled_at, city };
    });

    return { ok: true, rows: out };
  } catch {
    return { ok: false };
  }
}
