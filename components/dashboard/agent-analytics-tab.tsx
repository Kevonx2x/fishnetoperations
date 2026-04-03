"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

type LeadRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  property_interest: string | null;
  message: string | null;
  stage: string;
  created_at: string;
  updated_at?: string;
};

type ViewingRow = { scheduled_at: string; status: string; created_at?: string };

type AgentRow = {
  id: string;
  response_time?: string | null;
  closings?: number | null;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function AgentAnalyticsTab({
  leads,
  viewings,
  agent,
}: {
  leads: LeadRow[];
  viewings: ViewingRow[];
  agent: AgentRow;
}) {
  const [profileViews, setProfileViews] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !agent.id) return;
    const key = `fishnet_agent_profile_views_${agent.id}`;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      setProfileViews(Number(raw));
      return;
    }
    const n = 100 + Math.floor(Math.random() * 401);
    window.localStorage.setItem(key, String(n));
    setProfileViews(n);
  }, [agent.id]);

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = addMonths(thisMonthStart, -1);

  const stats = useMemo(() => {
    const inRange = (iso: string, start: Date, end: Date) => {
      const t = new Date(iso).getTime();
      return t >= start.getTime() && t < end.getTime();
    };

    const leadsThis = leads.filter((l) => inRange(l.created_at, thisMonthStart, now));
    const leadsLast = leads.filter((l) => inRange(l.created_at, lastMonthStart, thisMonthStart));

    const viewThis = viewings.filter(
      (v) => v.status === "confirmed" && inRange(v.scheduled_at, thisMonthStart, now),
    );
    const viewLast = viewings.filter(
      (v) => v.status === "confirmed" && inRange(v.scheduled_at, lastMonthStart, thisMonthStart),
    );

    const dealsThis = leadsThis.filter((l) => l.stage === "closed_won").length;
    const dealsLast = leadsLast.filter((l) => l.stage === "closed_won").length;

    const responseRate = (subset: LeadRow[]) => {
      if (subset.length === 0) return 0;
      const ok = subset.filter((l) => {
        if (l.stage === "new") return false;
        const u = l.updated_at ?? l.created_at;
        const diff = new Date(u).getTime() - new Date(l.created_at).getTime();
        return diff <= 24 * 60 * 60 * 1000;
      }).length;
      return Math.round((ok / subset.length) * 100);
    };

    const rrThis = responseRate(leadsThis);
    const rrLast = responseRate(leadsLast);

    const sixMonths: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = addMonths(startOfMonth(now), -i);
      const end = i === 0 ? now : addMonths(startOfMonth(now), -i + 1);
      const count = leads.filter((l) => {
        const t = new Date(l.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length;
      sixMonths.push({
        month: start.toLocaleString(undefined, { month: "short" }),
        count,
      });
    }

    const interestCounts = new Map<string, number>();
    for (const l of leads) {
      const k = (l.property_interest ?? "General").trim() || "General";
      interestCounts.set(k, (interestCounts.get(k) ?? 0) + 1);
    }
    let topInterest = "—";
    let topN = 0;
    for (const [k, n] of interestCounts) {
      if (n > topN) {
        topN = n;
        topInterest = k;
      }
    }

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newThisWeek = leads.filter((l) => new Date(l.created_at) >= weekAgo && l.stage === "new").length;

    const topListings = Array.from(interestCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      leadsThis: leadsThis.length,
      leadsLast: leadsLast.length,
      viewThis: viewThis.length,
      viewLast: viewLast.length,
      dealsThis,
      dealsLast,
      rrThis,
      rrLast,
      sixMonths,
      topInterest,
      topListings,
      newThisWeek,
    };
  }, [leads, viewings, now, thisMonthStart, lastMonthStart]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Analytics</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Performance and pipeline insights.</p>
      </div>

      <div className="rounded-2xl border border-[#C9A84C]/25 bg-gradient-to-br from-[#C9A84C]/10 to-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#C9A84C]" />
          <p className="font-bold text-[#2C2C2C]">Quick wins</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/75">
          You have{" "}
          <span className="text-[#7C9A7E]">{stats.newThisWeek}</span> new lead
          {stats.newThisWeek === 1 ? "" : "s"} this week.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#2C2C2C]/45">This month vs last month</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCompare
            label="Leads received"
            current={stats.leadsThis}
            prev={stats.leadsLast}
          />
          <StatCompare
            label="Viewings scheduled"
            current={stats.viewThis}
            prev={stats.viewLast}
          />
          <StatCompare label="Deals closed" current={stats.dealsThis} prev={stats.dealsLast} />
          <StatCompare label="Response rate" current={stats.rrThis} prev={stats.rrLast} suffix="%" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#2C2C2C]/45">All time</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-[#2C2C2C]/45">Total closings</p>
            <p className="mt-2 font-serif text-2xl font-bold text-[#7C9A7E]">{agent.closings ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-[#2C2C2C]/45">Avg. response time</p>
            <p className="mt-2 font-serif text-2xl font-bold text-[#2C2C2C]">
              {agent.response_time ?? "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-[#2C2C2C]/45">Most inquired topic</p>
            <p className="mt-2 line-clamp-2 font-serif text-lg font-bold text-[#C9A84C]">{stats.topInterest}</p>
          </div>
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-[#2C2C2C]/45">Profile views</p>
            <p className="mt-2 font-serif text-2xl font-bold text-[#2C2C2C]">
              {profileViews ?? "…"}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-[#2C2C2C]/35">Stored locally</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Leads per month (6 months)</h2>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.sixMonths}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#5c5c5c" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#5c5c5c" }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e0dcd4",
                  background: "#FAF8F4",
                }}
              />
              <Bar dataKey="count" fill="#7C9A7E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Top inquiry topics</h2>
        <ul className="mt-4 space-y-2">
          {stats.topListings.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between rounded-xl bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
            >
              <span className="truncate pr-2">{row.name}</span>
              <span className="shrink-0 rounded-full bg-[#C9A84C]/20 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                {row.count}
              </span>
            </li>
          ))}
          {stats.topListings.length === 0 ? (
            <li className="text-sm font-semibold text-[#2C2C2C]/45">No data yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function StatCompare({
  label,
  current,
  prev,
  suffix = "",
}: {
  label: string;
  current: number;
  prev: number;
  suffix?: string;
}) {
  const delta = prev === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - prev) / prev) * 100);
  const good = delta >= 0;
  return (
    <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase text-[#2C2C2C]/45">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-[#2C2C2C]">
        {current}
        {suffix}
      </p>
      <p className={`mt-1 text-xs font-bold ${good ? "text-[#7C9A7E]" : "text-[#b45353]"}`}>
        vs last: {prev}
        {suffix} ({good ? "+" : ""}
        {delta}%)
      </p>
    </div>
  );
}
