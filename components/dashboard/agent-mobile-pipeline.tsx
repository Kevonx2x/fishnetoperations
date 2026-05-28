"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bell,
  ChevronDown,
  Filter,
  GitBranch,
  Inbox,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import {
  PIPELINE_STAGES,
  agentPipelineStageDisplayLabel,
  type PipelineLeadRow,
  type PipelineStageId,
  type ViewingRequestPipelineMeta,
} from "@/components/dashboard/agent-pipeline-tab";
import { AgentMobileBottomNav } from "@/components/dashboard/agent-mobile-bottom-nav";
import {
  PipelineDealCardMobile,
  type MobileDealPropertyMeta,
} from "@/components/dashboard/pipeline-deal-card-mobile";
import { PipelineOverviewStrip } from "@/components/dashboard/pipeline-overview-strip";
import { PipelineStagePillTabs } from "@/components/dashboard/pipeline-stage-pill-tabs";
import { BahayGoHouseMark } from "@/components/dormspaces/dormspace-welcome-logo";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { propertyCanonicalCity } from "@/lib/normalize-city";
import {
  formatDealPriceLine,
  formatPipelineTotalValue,
  propertyPipelineValueNumber,
  type PipelinePropertyPriceInput,
} from "@/lib/pipeline-mobile-value";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AgentMobilePipelineProperty = PipelinePropertyPriceInput & {
  id: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: string | null;
  property_type?: string | null;
  coverUrl?: string | null;
  city?: string | null;
  location?: string | null;
};

type PipelineSortMode =
  | "last_activity_desc"
  | "last_activity_asc"
  | "date_added_desc"
  | "date_added_asc"
  | "name_asc"
  | "name_desc";

type AgentNavigateTab = "overview" | "pipeline" | "messages" | "notifications";

export type AgentMobilePipelineProps = {
  leads: PipelineLeadRow[];
  archivedLeads: PipelineLeadRow[];
  propertyLabel: (propertyId: string | null) => string;
  supabase: SupabaseClient;
  onRefresh: () => void | Promise<void>;
  onPatchLead?: (leadId: number, patch: Partial<PipelineLeadRow>) => void;
  onFullRefresh?: () => void | Promise<void>;
  onOpenLeadDetails: (leadId: number) => void;
  pipelineAgentId: string;
  leadsAgentUserId: string;
  messagingAgentUserId?: string | null;
  clientDocsSharedWithUserId?: string;
  viewingRequestMetaByLeadId?: Record<number, ViewingRequestPipelineMeta>;
  onOpenMessagesForClient?: (clientUserId: string) => void;
  onUnarchiveArchivedLead?: (row: PipelineLeadRow) => void | Promise<void>;
  /** TODO: replace with real scoring engine (closings + response time + reviews) once built — see roadmap */
  agentScore: number;
  agentAvatarUrl: string | null;
  agentName: string;
  unreadNotifications: number;
  messagesUnread: number;
  properties: AgentMobilePipelineProperty[];
  isLoading?: boolean;
  onOpenMenu: () => void;
  onNavigateTab: (tab: AgentNavigateTab) => void;
  onViewDocuments: (deal: PipelineLeadRow) => void;
  onOpenDealMenu?: (deal: PipelineLeadRow) => void;
  onAddDeal?: () => void;
  onMore?: () => void;
  onHome?: () => void;
};

const SORT_LABELS: Record<PipelineSortMode, string> = {
  last_activity_desc: "Newest",
  last_activity_asc: "Oldest activity",
  date_added_desc: "Date added (newest)",
  date_added_asc: "Date added (oldest)",
  name_asc: "Name (A → Z)",
  name_desc: "Name (Z → A)",
};

function normalizeStage(raw: string): PipelineStageId {
  const s = String(raw ?? "").trim().toLowerCase();
  const order: PipelineStageId[] = ["lead", "viewing", "offer", "reservation", "closed"];
  if (order.includes(s as PipelineStageId)) return s as PipelineStageId;
  return "lead";
}

function tsOr0(raw: string | null | undefined): number {
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function leadLastActivityTs(lead: PipelineLeadRow): number {
  return tsOr0(lead.updated_at ?? lead.created_at);
}

function leadDateAddedTs(lead: PipelineLeadRow): number {
  return tsOr0(lead.created_at);
}

function sortDeals(list: PipelineLeadRow[], sortMode: PipelineSortMode): PipelineLeadRow[] {
  const copy = list.slice();
  copy.sort((a, b) => {
    switch (sortMode) {
      case "last_activity_desc":
        return leadLastActivityTs(b) - leadLastActivityTs(a);
      case "last_activity_asc":
        return leadLastActivityTs(a) - leadLastActivityTs(b);
      case "date_added_desc":
        return leadDateAddedTs(b) - leadDateAddedTs(a);
      case "date_added_asc":
        return leadDateAddedTs(a) - leadDateAddedTs(b);
      case "name_asc":
        return (a.name ?? "").localeCompare(b.name ?? "");
      case "name_desc":
        return (b.name ?? "").localeCompare(a.name ?? "");
      default:
        return 0;
    }
  });
  return copy;
}

function leadMatchesSearch(
  lead: PipelineLeadRow,
  q: string,
  propertyLabel: (propertyId: string | null) => string,
  propertyById: Map<string, AgentMobilePipelineProperty>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if ((lead.name ?? "").toLowerCase().includes(needle)) return true;
  const pid = lead.property_id;
  if (!pid) return false;
  const meta = propertyById.get(pid);
  const home = (propertyLabel(pid) ?? "").toLowerCase();
  const city = (meta?.city ?? "").toLowerCase();
  const loc = (meta?.location ?? "").toLowerCase();
  return home.includes(needle) || city.includes(needle) || loc.includes(needle);
}

function dealPropertyMeta(
  deal: PipelineLeadRow,
  propertyLabel: (propertyId: string | null) => string,
  propertyById: Map<string, AgentMobilePipelineProperty>,
): MobileDealPropertyMeta {
  const pid = deal.property_id;
  const p = pid ? propertyById.get(pid) : undefined;
  const locationLine = p
    ? [p.city, p.location].filter(Boolean).join(" · ") || null
    : null;
  return {
    title: pid ? propertyLabel(pid) : "No property linked",
    priceLine: p ? formatDealPriceLine(p) : null,
    locationLine,
    beds: p?.beds ?? null,
    baths: p?.baths ?? null,
    sqft: p?.sqft != null ? String(p.sqft) : null,
    propertyType: p?.property_type ?? null,
    coverUrl: p?.coverUrl ?? null,
  };
}

function leadScoreOverviewHint(score: number): { hint: string; hintTone: "positive" | "neutral" } {
  if (score >= 7) return { hint: "Excellent", hintTone: "positive" };
  if (score >= 5) return { hint: "Good", hintTone: "positive" };
  if (score >= 3) return { hint: "Fair", hintTone: "neutral" };
  return { hint: "Building", hintTone: "neutral" };
}

function AgentPipelineHeaderLockup({ className }: { className?: string }) {
  return (
    <div
      className={cn("inline-flex shrink-0 items-start gap-1.5 leading-none", className)}
      aria-label="BahayGo dormspacers"
    >
      <BahayGoHouseMark className="h-8 w-auto shrink-0" />
      <span className="flex flex-col items-start pt-0.5">
        <span className="inline-flex items-baseline gap-0 font-serif text-[1.15rem] font-bold leading-none tracking-tight">
          <span className="text-[#2C2C2C]">Bahay</span>
          <span className="text-[#6B9E6E]">Go</span>
        </span>
        <span className="mt-0.5 font-serif text-[0.6rem] font-semibold leading-none tracking-[0.14em] text-[#888888]">
          dormspacers
        </span>
      </span>
    </div>
  );
}

function MobileDealCardSkeleton() {
  return (
    <div className="relative flex h-[108px] animate-pulse overflow-hidden rounded-xl bg-white shadow-[0_4px_16px_rgba(44,44,44,0.06)]">
      <div className="size-[108px] shrink-0 bg-[#ECEAE4]" />
      <div className="flex flex-1 flex-col justify-center gap-1 py-2 pl-2.5 pr-14">
        <div className="h-3.5 w-4/5 rounded-md bg-[#ECEAE4]" />
        <div className="h-3 w-3/5 rounded-md bg-[#ECEAE4]" />
        <div className="h-2.5 w-full rounded-md bg-[#ECEAE4]" />
        <div className="h-3.5 w-24 rounded-md bg-[#ECEAE4]" />
      </div>
      <div className="absolute right-2.5 top-11 flex w-11 flex-col items-center gap-0.5">
        <div className="h-9 w-9 rounded-full bg-[#ECEAE4]" />
        <div className="h-3 w-full rounded-md bg-[#ECEAE4]" />
      </div>
    </div>
  );
}

export function AgentMobilePipeline({
  leads,
  archivedLeads,
  propertyLabel,
  leadsAgentUserId: _leadsAgentUserId,
  agentScore,
  agentAvatarUrl,
  agentName,
  unreadNotifications,
  messagesUnread,
  properties,
  isLoading,
  onOpenMenu,
  onNavigateTab,
  onViewDocuments,
  onOpenDealMenu,
  onOpenLeadDetails,
  onAddDeal,
  onMore,
  onHome,
  pipelineAgentId,
}: AgentMobilePipelineProps) {
  const [vault, setVault] = useState<"active" | "archived">("active");
  const [filterStage, setFilterStage] = useState<PipelineStageId>("lead");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<PipelineSortMode>("last_activity_desc");
  const [addDealOpen, setAddDealOpen] = useState(false);

  const sortStorageKey = useMemo(() => `bhg:pipeline:mobile:sort:${pipelineAgentId}`, [pipelineAgentId]);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(sortStorageKey);
      if (v && v in SORT_LABELS) setSortMode(v as PipelineSortMode);
    } catch {
      // ignore
    }
  }, [sortStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(sortStorageKey, sortMode);
    } catch {
      // ignore
    }
  }, [sortMode, sortStorageKey]);

  const propertyById = useMemo(() => {
    const m = new Map<string, AgentMobilePipelineProperty>();
    for (const p of properties) {
      const city = propertyCanonicalCity({ city: p.city ?? null, location: p.location ?? "" });
      m.set(p.id, { ...p, city });
    }
    return m;
  }, [properties]);

  const activeDeals = useMemo(
    () =>
      leads
        .filter((l) => String(l.pipeline_stage ?? "").toLowerCase() !== "declined")
        .map((l) => ({
          ...l,
          pipeline_stage: normalizeStage(l.pipeline_stage as string),
        })),
    [leads],
  );

  const counts = useMemo(() => {
    const c: Record<PipelineStageId, number> = {
      lead: 0,
      viewing: 0,
      offer: 0,
      reservation: 0,
      closed: 0,
    };
    for (const d of activeDeals) {
      if (d.pipeline_stage in c) c[d.pipeline_stage]++;
    }
    return c;
  }, [activeDeals]);

  const pipelineValueFormatted = useMemo(() => {
    let sum = 0;
    for (const d of activeDeals) {
      const pid = d.property_id;
      if (!pid) continue;
      const p = propertyById.get(pid);
      if (p) sum += propertyPipelineValueNumber(p);
    }
    return formatPipelineTotalValue(sum);
  }, [activeDeals, propertyById]);

  const searchedActive = useMemo(
    () => activeDeals.filter((d) => leadMatchesSearch(d, searchQuery, propertyLabel, propertyById)),
    [activeDeals, searchQuery, propertyLabel, propertyById],
  );

  const searchedArchived = useMemo(
    () => archivedLeads.filter((d) => leadMatchesSearch(d, searchQuery, propertyLabel, propertyById)),
    [archivedLeads, searchQuery, propertyLabel, propertyById],
  );

  const stageDeals = useMemo(() => {
    const inStage = searchedActive.filter((d) => d.pipeline_stage === filterStage);
    return sortDeals(inStage, sortMode);
  }, [searchedActive, filterStage, sortMode]);

  const overviewStats = useMemo(() => {
    const scoreHint = leadScoreOverviewHint(agentScore);
    return [
      {
        id: "inquiries",
        label: "Active inquiries",
        value: String(counts.lead ?? 0),
        hint: "In your pipeline",
        hintTone: "positive" as const,
      },
      {
        id: "value",
        label: "Pipeline value",
        value: pipelineValueFormatted,
        hint: "↑ 18% vs last 30 days",
        hintTone: "positive" as const,
      },
      {
        id: "score",
        label: "Lead score",
        value: `${agentScore.toFixed(1)}/10`,
        hint: scoreHint.hint,
        hintTone: scoreHint.hintTone,
      },
    ];
  }, [counts.lead, pipelineValueFormatted, agentScore]);

  const stageLabel =
    filterStage === "lead" ? "Inquiries" : agentPipelineStageDisplayLabel(filterStage);
  const archivedCount = archivedLeads.length;

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-col overflow-x-clip bg-[#FAF8F4] pb-24">
      <header className="sticky top-0 z-30 bg-[#FAF8F4]/90 backdrop-blur-md">
        <div className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#2C2C2C]/70 hover:bg-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <AgentPipelineHeaderLockup className="justify-self-center" />
          <button
            type="button"
            onClick={() => onNavigateTab("notifications")}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#2C2C2C]/70 hover:bg-white"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {unreadNotifications > 0 ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#6B9E6E] ring-2 ring-[#FAF8F4]" aria-hidden />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => onOpenMenu()}
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]/15 ring-2 ring-white"
            aria-label={agentName ? `Profile: ${agentName}` : "Profile"}
          >
            {agentAvatarUrl ? (
              <SupabasePublicImage src={agentAvatarUrl} alt="" fill sizes="36px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-bold text-[#6B9E6E]">
                {agentName?.trim().charAt(0)?.toUpperCase() || "A"}
              </span>
            )}
          </button>
        </div>

        <div className="px-3 pb-3 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#AAAAAA]"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search listings, clients, or locations…"
                className="h-12 w-full rounded-full bg-white py-0 pl-11 pr-3 text-[14px] font-medium text-[#2C2C2C] shadow-[0_4px_20px_rgba(44,44,44,0.06)] outline-none placeholder:text-[#AAAAAA] focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/25"
                aria-label="Search pipeline"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#888888] shadow-[0_4px_20px_rgba(44,44,44,0.06)]"
                  aria-label="Filters"
                >
                  <Filter className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px] border border-[#2C2C2C]/10 bg-[#FAF8F4]">
                <DropdownMenuLabel className="text-xs font-bold text-[#2C2C2C]/55">Stage</DropdownMenuLabel>
                {PIPELINE_STAGES.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => {
                      setVault("active");
                      setFilterStage(s.id);
                    }}
                    className="font-semibold"
                  >
                    {s.id === "lead" ? "Inquiries" : s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <div className="inline-flex gap-1 rounded-full bg-[#ECEAE4]/80 p-1">
            <button
              type="button"
              onClick={() => setVault("active")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                vault === "active" ? "bg-white text-[#2C2C2C] shadow-sm" : "text-[#888888]",
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setVault("archived")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                vault === "archived" ? "bg-white text-[#2C2C2C] shadow-sm" : "text-[#888888]",
              )}
            >
              Archived ({archivedCount})
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenMenu}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#2C2C2C]/55 hover:bg-white"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="min-w-0 flex-1 space-y-6 overflow-x-clip px-3 pb-3 pt-2">
        {vault === "active" ? (
          <>
            <PipelineOverviewStrip stats={overviewStats} />

            {isLoading ? (
              <div className="flex gap-2 overflow-hidden">
                {PIPELINE_STAGES.map((s) => (
                  <div key={s.id} className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-[#2C2C2C]/10" />
                ))}
              </div>
            ) : (
              <PipelineStagePillTabs
                activeStage={filterStage}
                counts={counts}
                onStageChange={setFilterStage}
              />
            )}

            <div className="flex items-center justify-between gap-2 px-0.5">
              <h2 className="min-w-0 text-[17px] font-semibold tracking-tight text-[#2C2C2C]">
                {stageLabel}{" "}
                <span className="font-medium text-[#AAAAAA]">({stageDeals.length})</span>
              </h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#888888]"
                  >
                    Sort: {SORT_LABELS[sortMode]}
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px] border border-[#2C2C2C]/10 bg-[#FAF8F4]">
                  {(Object.keys(SORT_LABELS) as PipelineSortMode[]).map((id) => (
                    <DropdownMenuItem key={id} onClick={() => setSortMode(id)} className="font-semibold">
                      {SORT_LABELS[id]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <MobileDealCardSkeleton />
                <MobileDealCardSkeleton />
                <MobileDealCardSkeleton />
              </div>
            ) : stageDeals.length === 0 ? (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-6 py-12 text-center">
                <GitBranch className="mx-auto h-10 w-10 text-[#2C2C2C]/20" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/55">
                  No deals in {stageLabel} yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stageDeals.map((deal) => (
                  <PipelineDealCardMobile
                    key={deal.id}
                    deal={deal}
                    property={dealPropertyMeta(deal, propertyLabel, propertyById)}
                    onViewDocuments={onViewDocuments}
                    onOpenMenu={onOpenDealMenu}
                    onOpenDeal={(deal) => onOpenLeadDetails(deal.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">
                Archived <span className="text-[#2C2C2C]/45">({searchedArchived.length})</span>
              </h2>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <MobileDealCardSkeleton />
                <MobileDealCardSkeleton />
              </div>
            ) : searchedArchived.length === 0 ? (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-6 py-12 text-center">
                <Inbox className="mx-auto h-10 w-10 text-[#2C2C2C]/20" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/55">Nothing archived yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortDeals(searchedArchived, sortMode).map((deal) => (
                  <PipelineDealCardMobile
                    key={deal.id}
                    deal={{
                      ...deal,
                      pipeline_stage: normalizeStage(deal.pipeline_stage as string),
                    }}
                    property={dealPropertyMeta(deal, propertyLabel, propertyById)}
                    onViewDocuments={onViewDocuments}
                    onOpenMenu={onOpenDealMenu}
                    onOpenDeal={(deal) => onOpenLeadDetails(deal.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {vault === "active" ? (
        <button
          type="button"
          onClick={
            onAddDeal ??
            (() => {
              setAddDealOpen(true);
            })
          }
          className="fixed bottom-[5.25rem] right-3 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#6B9E6E] text-white shadow-[0_6px_20px_rgba(107,158,110,0.38)] transition active:scale-95"
          aria-label="Add new deal"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}

      <AgentMobileBottomNav
        activeTab="pipeline"
        messagesUnread={messagesUnread}
        onHome={onHome ?? (() => onNavigateTab("overview"))}
        onPipeline={() => onNavigateTab("pipeline")}
        onAdd={
          onAddDeal ??
          (() => {
            // TODO: full add-deal flow — currently placeholder bottom sheet
            setAddDealOpen(true);
          })
        }
        onMessages={() => onNavigateTab("messages")}
        onMore={onMore ?? onOpenMenu}
      />

      <Sheet open={addDealOpen} onOpenChange={setAddDealOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-[#2C2C2C]/10 bg-[#FAF8F4]">
          <SheetHeader>
            <SheetTitle className="font-serif text-lg text-[#2C2C2C]">Add new deal</SheetTitle>
            <SheetDescription className="text-left text-sm text-[#2C2C2C]/65">
              Add deal flow coming soon — for now, deals are created from a client viewing request.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </div>
  );
}
