"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  Home,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import {
  AGENT_DASHBOARD_HUB_PATH,
  AGENT_SECTION_PATHS,
} from "@/lib/agent-dashboard-routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type HubCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  count?: number;
};

function HubCard({ href, icon: Icon, title, description, count }: HubCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[96px] flex-col rounded-xl border border-black/[0.08] bg-white p-4",
        "shadow-[0_4px_20px_rgba(44,44,44,0.1)] ring-1 ring-white/80",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-[#6B9E6E]/20 hover:shadow-[0_10px_32px_rgba(107,158,110,0.18)]",
        "active:translate-y-0",
      )}
    >
      {count != null && count > 0 ? (
        <span className="absolute right-3 top-3 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#6B9E6E] px-1.5 text-[11px] font-bold text-white shadow-sm">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E]/12 ring-1 ring-[#6B9E6E]/15">
        <Icon className="h-6 w-6 text-[#6B9E6E]" strokeWidth={2} aria-hidden />
      </span>
      <p className="mt-3 text-base font-semibold text-[#2C2C2C]">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-[#888888]">{description}</p>
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

function countOpenPipelineLeads(
  rows: { stage?: string | null; pipeline_stage?: string | null }[],
): number {
  return rows.filter((l) => {
    if (String(l.stage ?? "").trim().toLowerCase() === "declined") return false;
    if (String(l.pipeline_stage ?? "lead").trim().toLowerCase() === "closed") return false;
    return true;
  }).length;
}

export function AgentDashboardHub() {
  const router = useRouter();
  const { user, profile, role, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loaded, setLoaded] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [pipelineCount, setPipelineCount] = useState(0);
  const [listingCount, setListingCount] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);
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
      const { data: a } = await supabase.from("agents").select("user_id, verification_status").eq("id", agentId).maybeSingle();
      agentUserId = (a as { user_id?: string } | null)?.user_id ?? user.id;
      setVerificationStatus((a as { verification_status?: string | null } | null)?.verification_status ?? null);
    } else {
      const { data: a } = await supabase
        .from("agents")
        .select("user_id, verification_status")
        .eq("user_id", user.id)
        .maybeSingle();
      setVerificationStatus((a as { verification_status?: string | null } | null)?.verification_status ?? null);
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [leadsRes, notifRes] = await Promise.all([
      supabase
        .from("leads")
        .select("stage, pipeline_stage")
        .eq("agent_id", agentUserId)
        .is("archived_at", null),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);

    const leadRows = (leadsRes.data ?? []) as { stage?: string | null; pipeline_stage?: string | null }[];
    setPipelineCount(countOpenPipelineLeads(leadRows));

    const weekLeadRes = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentUserId)
      .is("archived_at", null)
      .gte("created_at", weekAgo.toISOString());
    setWeekLeadsCount(weekLeadRes.count ?? 0);

    setInquiryCount(notifRes.error ? 0 : (notifRes.count ?? 0));

    if (!teamMember) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, deleted_at, availability_state")
        .eq("agent_id", user.id)
        .is("deleted_at", null);
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
      router.replace(`/auth/login?next=${encodeURIComponent(AGENT_DASHBOARD_HUB_PATH)}`);
      return;
    }
    void loadHubStats();
  }, [authLoading, user, router, loadHubStats]);

  const isBroker = role === "broker";
  const showVerificationBanner =
    verificationStatus != null && verificationStatus !== "verified" && !isTeamMember;

  if (authLoading || !loaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4]">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading" />
      </div>
    );
  }

  const welcomeName = firstName(profile?.full_name, user?.email);

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#2C2C2C]">
      <div className="pb-32 pt-[env(safe-area-inset-top,0px)]">
        {showVerificationBanner ? (
          <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
            <p className="font-semibold">Verification pending</p>
            <p className="mt-1 text-amber-900/80">
              Complete PRC verification to unlock pipeline and listings.{" "}
              <Link href="/settings?tab=verification" className="font-semibold text-[#6B9E6E] underline">
                Continue verification
              </Link>
            </p>
          </div>
        ) : null}

        <h1 className="px-4 pt-4 pb-2 font-serif text-[28px] font-semibold leading-tight text-[#2C2C2C] md:text-[32px]">
          Agent Dashboard
        </h1>
        <p className="mb-4 px-4 text-sm text-[#888888]">Welcome back, {welcomeName}</p>

        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          <span className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]">
            {pipelineCount} active in pipeline
          </span>
          {!isTeamMember ? (
            <span className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]">
              {listingCount} listings
            </span>
          ) : null}
          <span className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]">
            {weekLeadsCount} this week
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2">
          <HubCard
            href={AGENT_SECTION_PATHS.pipeline}
            icon={Activity}
            title="Pipeline"
            description="Active deals and viewings"
            count={pipelineCount}
          />
          {isTeamMember ? (
            <>
              <HubCard
                href={AGENT_SECTION_PATHS.messages}
                icon={MessageSquare}
                title="Messages"
                description="Client conversations"
              />
              <HubCard
                href={AGENT_SECTION_PATHS.documents}
                icon={FileText}
                title="Documents"
                description="Deal files and uploads"
              />
            </>
          ) : (
            <>
              {verificationStatus === "verified" ? (
                <HubCard
                  href={AGENT_SECTION_PATHS.listings}
                  icon={Home}
                  title="My Listings"
                  description="Manage your property listings"
                  count={listingCount}
                />
              ) : null}
              <HubCard
                href={AGENT_SECTION_PATHS.inquiries}
                icon={Inbox}
                title="Inquiries"
                description="New leads from clients"
                count={inquiryCount}
              />
              <HubCard
                href={AGENT_SECTION_PATHS.analytics}
                icon={BarChart3}
                title="Analytics"
                description="Views, engagement, performance"
              />
              {isBroker ? (
                <HubCard
                  href="/dashboard/agency"
                  icon={Users}
                  title="Team"
                  description="Manage your agents"
                />
              ) : null}
              <HubCard
                href={AGENT_SECTION_PATHS.billing}
                icon={CreditCard}
                title="Billing"
                description="Subscription and invoices"
              />
              <HubCard
                href={AGENT_SECTION_PATHS.profile}
                icon={User}
                title="My Profile"
                description="Public profile and contact info"
              />
            </>
          )}
        </div>

        {!isTeamMember && verificationStatus === "verified" ? (
          <div className="mt-6 px-4">
            <Link
              href={`${AGENT_SECTION_PATHS.listings}?new=1`}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#5d8a60] active:bg-[#527a55]"
            >
              <Plus className="h-5 w-5" aria-hidden />
              Add new listing
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
