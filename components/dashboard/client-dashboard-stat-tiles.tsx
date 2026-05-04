import Link from "next/link";
import { Calendar, Home } from "lucide-react";

import { ClientDashboardUnreadMessagesStatTile } from "@/components/dashboard/client-dashboard-unread-messages-stat-tile";
import { fetchClientDealStats, fetchClientViewingsTodayManila } from "@/lib/client-dashboard-stats";
import { manilaTimeLabel12hFromInstant } from "@/lib/manila-datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientDashboardStatTiles() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  let dealsBlock: { num: string; sub: string } = { num: "—", sub: "Unable to load" };
  let viewBlock: { num: string; sub: string } = { num: "—", sub: "Unable to load" };

  if (userId) {
    const [dealsRes, viewRes] = await Promise.all([
      fetchClientDealStats(supabase, userId),
      fetchClientViewingsTodayManila(supabase, userId),
    ]);

    if (dealsRes.ok) {
      const n = dealsRes.data.activeDeals;
      const u = dealsRes.data.activeDealsUpdatedLast24h;
      dealsBlock = {
        num: String(n),
        sub: `${u} updated today`,
      };
    }

    if (viewRes.ok) {
      const rows = viewRes.rows;
      if (rows.length === 0) {
        viewBlock = { num: "0", sub: "No viewings today" };
      } else {
        const first = rows[0]!;
        const t = manilaTimeLabel12hFromInstant(new Date(first.scheduled_at));
        const city = first.city?.trim() || "—";
        viewBlock = {
          num: String(rows.length),
          sub: `${t} • ${city}`,
        };
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Link
        href="/dashboard/client/pipeline"
        className="flex rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045] transition-colors hover:bg-[#2C2C2C]/[0.02]"
      >
        <div className="flex w-full min-w-0 items-start gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
            <Home className="size-5 text-[#6B9E6E]" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-2xl font-semibold leading-tight tracking-tight text-[#2C2C2C]">{dealsBlock.num}</p>
            <p className="mt-0.5 text-sm font-medium text-[#2C2C2C]">Active deals</p>
            <p className="mt-1 text-xs text-gray-500">{dealsBlock.sub}</p>
          </div>
        </div>
      </Link>

      <Link
        href="/dashboard/client/pipeline"
        className="flex rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045] transition-colors hover:bg-[#2C2C2C]/[0.02]"
      >
        <div className="flex w-full min-w-0 items-start gap-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
            <Calendar className="size-5 text-[#6B9E6E]" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-2xl font-semibold leading-tight tracking-tight text-[#2C2C2C]">{viewBlock.num}</p>
            <p className="mt-0.5 text-sm font-medium text-[#2C2C2C]">Viewing today</p>
            <p className="mt-1 text-xs text-gray-500">{viewBlock.sub}</p>
          </div>
        </div>
      </Link>

      <ClientDashboardUnreadMessagesStatTile />
    </div>
  );
}
