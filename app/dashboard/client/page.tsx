import { redirect } from "next/navigation";

import { ClientDashboardContinueCard } from "@/components/dashboard/client-dashboard-continue-card";
import { ClientDashboardGreeting } from "@/components/dashboard/client-dashboard-greeting";
import ClientDashboardNextViewing from "@/components/dashboard/client-dashboard-next-viewing";
import ClientDashboardRecentActivity from "@/components/dashboard/client-dashboard-recent-activity";
import ClientDashboardRecommended from "@/components/dashboard/client-dashboard-recommended";
import ClientDashboardStatTiles from "@/components/dashboard/client-dashboard-stat-tiles";
import { ClientDashboardStatTilesRefreshShell } from "@/components/dashboard/client-dashboard-stat-tiles-refresh-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Avoid stale HTML when running `next start` or aggressive caching; always re-fetch this route. */
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

export default async function DashboardClientIndexPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const tabRaw = sp.tab;
  const leadRaw = sp.lead;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
  if (tab === "pipeline") {
    const qs = new URLSearchParams();
    if (lead && lead.trim()) qs.set("lead", lead.trim());
    redirect(`/dashboard/client/pipeline${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent("/dashboard/client")}`);
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("first_name, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const firstName =
    (prof?.first_name as string | undefined)?.trim() ||
    (prof?.full_name as string | undefined)?.trim()?.split(/\s+/)?.[0] ||
    "";

  return (
    <div className="space-y-5 md:space-y-6">
      <ClientDashboardGreeting firstName={firstName} />
      <ClientDashboardContinueCard />

      <ClientDashboardStatTilesRefreshShell>
        <div className="space-y-4 md:space-y-5">
          <ClientDashboardStatTiles />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ClientDashboardRecentActivity userId={user.id} />
            </div>
            <div className="lg:col-span-2">
              <ClientDashboardNextViewing userId={user.id} />
            </div>
          </div>

          <ClientDashboardRecommended userId={user.id} />
        </div>
      </ClientDashboardStatTilesRefreshShell>
    </div>
  );
}
