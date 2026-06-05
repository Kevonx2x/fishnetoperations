"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Plus,
  User,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { UNIFIED_MESSAGES_PATH } from "@/lib/agent-messages-path";
import { AGENT_INHOUSE_MESSENGER_PATH } from "@/lib/messenger/agent-messages-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const AGENT_HUB_PATH = "/dashboard/agent";

type HubCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  count?: number;
  primary?: boolean;
};

function HubCard({ href, icon: Icon, title, description, count, primary }: HubCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex min-h-24 items-start gap-3 rounded-xl border border-black/[0.06] bg-white p-5",
        "transition-colors active:bg-black/[0.02]",
        primary && "border-l-[3px] border-l-[#6B9E6E] shadow-sm",
      )}
    >
      {count != null && count > 0 ? (
        <span className="absolute right-3 top-3 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#6B9E6E] px-1.5 text-[11px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
      <span className="flex w-8 shrink-0 items-center justify-center self-start pt-0.5">
        <Icon className="h-[22px] w-[22px] text-[#6B9E6E]" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg font-semibold leading-snug text-[#2C2C2C]">{title}</p>
        <p className="mt-0.5 text-[13px] font-normal leading-snug text-[#888888]">{description}</p>
      </div>
    </Link>
  );
}

function firstName(fullName: string | null | undefined, email: string | undefined): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const space = trimmed.indexOf(" ");
    return space === -1 ? trimmed : trimmed.slice(0, space);
  }
  return email?.split("@")[0] ?? "there";
}

function daypartGreeting(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function countOpenPipelineLeads(
  rows: { stage?: string | null; pipeline_stage?: string | null }[],
): number {
  return rows.filter((l) => {
    if (String(l.stage ?? "").trim().toLowerCase() === "declined") return false;
    if (String(l.pipeline_stage ?? "lead").trim().toLowerCase() === "closed") return false;
    return true;
  }).length;
}

/** Mobile-only agent dashboard hub — desktop uses legacy `AgentDashboard` workspace. */
export function AgentDashboardMobileHub() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loaded, setLoaded] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [pipelineCount, setPipelineCount] = useState(0);
  const [listingCount, setListingCount] = useState(0);
  const [weekLeadsCount, setWeekLeadsCount] = useState(0);

  const loadHubStats = useCallback(async () => {
    if (!user?.id) return;
    const { data: profileRow } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const accountRole = ((profileRow as { role?: string | null } | null)?.role ?? "").trim();
    const teamMember = accountRole === "team_member";
    setIsTeamMember(teamMember);

    let agentUserId = user.id;
    if (teamMember) {
      const { data: tm } = await supabase
        .from("team_members")
        .select("agent_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      const agentId = (tm as { agent_id?: string } | null)?.agent_id;
      if (!agentId) {
        setLoaded(true);
        return;
      }
      const { data: a } = await supabase.from("agents").select("user_id").eq("id", agentId).maybeSingle();
      agentUserId = (a as { user_id?: string } | null)?.user_id ?? user.id;
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const leadsRes = await supabase
      .from("leads")
      .select("stage, pipeline_stage")
      .eq("agent_id", agentUserId)
      .is("archived_at", null);

    const leadRows = (leadsRes.data ?? []) as { stage?: string | null; pipeline_stage?: string | null }[];
    setPipelineCount(countOpenPipelineLeads(leadRows));

    const weekLeadRes = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentUserId)
      .is("archived_at", null)
      .gte("created_at", weekAgo.toISOString());
    setWeekLeadsCount(weekLeadRes.count ?? 0);

    if (!teamMember) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, availability_state")
        .eq("listed_by", user.id)
        .neq("availability_state", "removed");
      const active = ((props ?? []) as { availability_state?: string | null }[]).filter(
        (p) => String(p.availability_state ?? "").trim().toLowerCase() !== "removed",
      );
      setListingCount(active.length);
    } else {
      setListingCount(0);
    }

    setLoaded(true);
  }, [supabase, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/login?next=${encodeURIComponent(AGENT_HUB_PATH)}`);
      return;
    }
    void loadHubStats();
  }, [authLoading, user, router, loadHubStats]);

  if (authLoading || !loaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4]">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading" />
      </div>
    );
  }

  const welcomeName = firstName(profile?.full_name, user?.email);
  const tabHref = (tab: string) => `${AGENT_HUB_PATH}?tab=${tab}`;

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#2C2C2C]">
      <div className="pb-32 pt-[env(safe-area-inset-top,0px)]">
        <p className="px-4 pt-4 text-sm text-[#888888]">
          Good {daypartGreeting()}, {welcomeName}
        </p>
        <h1 className="px-4 pt-2 pb-1 font-serif text-[28px] font-semibold leading-tight text-[#2C2C2C]">
          Agent Dashboard
        </h1>

        <div className="-mx-4 mt-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          <span className="shrink-0 rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-semibold text-[#2C2C2C]">
            {pipelineCount} active in pipeline
          </span>
          {!isTeamMember ? (
            <span className="shrink-0 rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-semibold text-[#2C2C2C]">
              {listingCount} listings
            </span>
          ) : null}
          <span className="shrink-0 rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-semibold text-[#2C2C2C]">
            {weekLeadsCount} this week
          </span>
        </div>

        <div className="flex flex-col gap-2 px-4">
          <HubCard
            href="/dashboard/agent/pipeline"
            icon={Activity}
            title="Pipeline"
            description="Track active deals and viewings"
            count={pipelineCount}
            primary
          />
          {isTeamMember ? (
            <>
              <HubCard
                href={UNIFIED_MESSAGES_PATH}
                icon={MessageSquare}
                title="Messages (Stream)"
                description="Legacy Stream inbox"
              />
              <HubCard
                href={AGENT_INHOUSE_MESSENGER_PATH}
                icon={MessageSquare}
                title="BahayGo Messenger"
                description="New in-house messenger (beta)"
                primary
              />
              <HubCard
                href={tabHref("documents")}
                icon={FileText}
                title="Documents"
                description="Deal files and uploads"
              />
            </>
          ) : (
            <>
              <HubCard
                href={UNIFIED_MESSAGES_PATH}
                icon={MessageSquare}
                title="Messages (Stream)"
                description="Legacy Stream inbox"
              />
              <HubCard
                href={AGENT_INHOUSE_MESSENGER_PATH}
                icon={MessageSquare}
                title="BahayGo Messenger"
                description="New in-house messenger (beta)"
                primary
              />
              <HubCard
                href={tabHref("listings")}
                icon={LayoutGrid}
                title="My Listings"
                description="Your live and draft listings"
                count={listingCount}
              />
              <HubCard
                href={tabHref("analytics")}
                icon={BarChart3}
                title="Analytics"
                description="Performance insights this month"
              />
              <HubCard
                href={tabHref("billing")}
                icon={CreditCard}
                title="Billing"
                description="Plan, billing, and invoices"
              />
              <HubCard
                href={tabHref("profile")}
                icon={User}
                title="My Profile"
                description="How clients see you"
              />
            </>
          )}
        </div>

        {!isTeamMember ? (
          <div className="mt-6 px-4">
            <Link
              href={tabHref("listings")}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#5d8a60] active:bg-[#527a55]"
            >
              <Plus className="h-5 w-5 shrink-0 text-[#D4A843]" strokeWidth={2.5} aria-hidden />
              Add new listing
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
