"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bell,
  ChevronDown,
  Filter,
  GitBranch,
  Inbox,
  Menu,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { toast } from "sonner";
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
import { PipelineHeroCard } from "@/components/dashboard/pipeline-hero-card";
import { PipelineStageScroller } from "@/components/dashboard/pipeline-stage-scroller";
import { BahayGoWordmark } from "@/components/marketplace/bahaygo-wordmark";
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

const NEXT_STAGE: Partial<Record<PipelineStageId, PipelineStageId>> = {
  lead: "viewing",
  viewing: "offer",
  offer: "reservation",
  reservation: "closed",
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
  return {
    title: pid ? propertyLabel(pid) : "No property linked",
    priceLine: p ? formatDealPriceLine(p) : null,
    beds: p?.beds ?? null,
    baths: p?.baths ?? null,
    sqft: p?.sqft != null ? String(p.sqft) : null,
    propertyType: p?.property_type ?? null,
    coverUrl: p?.coverUrl ?? null,
  };
}

function MobileDealCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-[0_2px_12px_rgba(44,44,44,0.06)]">
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 rounded-xl bg-[#2C2C2C]/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-16 rounded bg-[#2C2C2C]/10" />
          <div className="h-4 w-3/4 rounded bg-[#2C2C2C]/10" />
          <div className="h-3 w-full rounded bg-[#2C2C2C]/10" />
        </div>
      </div>
      <div className="mt-3 h-5 w-28 rounded bg-[#2C2C2C]/10" />
      <div className="mt-3 flex gap-2">
        <div className="h-10 flex-1 rounded-xl bg-[#2C2C2C]/10" />
        <div className="h-10 flex-1 rounded-xl bg-[#2C2C2C]/10" />
      </div>
    </div>
  );
}

export function AgentMobilePipeline({
  leads,
  archivedLeads,
  propertyLabel,
  onPatchLead,
  leadsAgentUserId,
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
  onAddDeal,
  onMore,
  onHome,
  pipelineAgentId,
}: AgentMobilePipelineProps) {
  const [vault, setVault] = useState<"active" | "archived">("active");
  const [filterStage, setFilterStage] = useState<PipelineStageId>("lead");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<PipelineSortMode>("last_activity_desc");
  const [moveBusyId, setMoveBusyId] = useState<number | null>(null);
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

  const displayScore = Number.isFinite(agentScore) ? agentScore : 5;

  const moveDealToNext = useCallback(
    async (deal: PipelineLeadRow, nextStage: PipelineStageId) => {
      setMoveBusyId(deal.id);
      const prevSnapshot: Partial<PipelineLeadRow> = {
        pipeline_stage: deal.pipeline_stage,
        updated_at: deal.updated_at ?? null,
        closed_at: deal.closed_at ?? null,
        closed_date: deal.closed_date ?? null,
        closed_by: deal.closed_by ?? null,
        closure_confirmed_by_client: deal.closure_confirmed_by_client ?? null,
      };
      const nowIso = new Date().toISOString();
      const optimisticPatch: Partial<PipelineLeadRow> = {
        pipeline_stage: nextStage,
        updated_at: nowIso,
      };
      if (nextStage === "closed") {
        optimisticPatch.closed_at = nowIso;
        optimisticPatch.closed_date = nowIso.slice(0, 10);
        optimisticPatch.closed_by = leadsAgentUserId;
        optimisticPatch.closure_confirmed_by_client = null;
      }
      onPatchLead?.(deal.id, optimisticPatch);

      try {
        const res = await fetch("/api/agent/pipeline-set-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ leadId: deal.id, pipeline_stage: nextStage }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { success?: boolean };
          error?: { message?: string };
        };
        const apiOk = res.ok && json.success === true && json.data?.success === true;
        if (!apiOk) {
          toast.error(json?.error?.message ?? "Could not move deal");
          onPatchLead?.(deal.id, prevSnapshot);
        }
      } catch {
        toast.error("Could not reach server. Check your connection.");
        onPatchLead?.(deal.id, prevSnapshot);
      } finally {
        setMoveBusyId(null);
      }
    },
    [onPatchLead, leadsAgentUserId],
  );

  const stageLabel = agentPipelineStageDisplayLabel(filterStage);
  const archivedCount = archivedLeads.length;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FAF8F4] pb-24">
      <header className="sticky top-0 z-30 border-b border-[#2C2C2C]/10 bg-[#FAF8F4]/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#2C2C2C]/70 hover:bg-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <BahayGoWordmark size="nav" className="min-w-0 flex-1 justify-center sm:justify-start" />
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#2C2C2C]/70 hover:bg-white"
            aria-label="Search pipeline"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
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

        {searchOpen ? (
          <div className="border-t border-[#2C2C2C]/[0.06] px-3 pb-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C2C2C]/40"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads, clients, properties…"
                className="h-9 w-full rounded-xl border border-[#2C2C2C]/10 bg-white py-0 pl-9 pr-3 text-sm text-[#2C2C2C] outline-none placeholder:text-[#2C2C2C]/45 focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/30"
                aria-label="Search pipeline"
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-[#2C2C2C]/[0.06] px-3 py-2">
          <div className="flex gap-1 rounded-xl border border-[#2C2C2C]/10 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setVault("active")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold",
                vault === "active" ? "bg-[#6B9E6E] text-white" : "text-[#2C2C2C]/55",
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setVault("archived")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold",
                vault === "archived" ? "bg-[#6B9E6E] text-white" : "text-[#2C2C2C]/55",
              )}
            >
              Archived ({archivedCount})
            </button>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-[#2C2C2C]/75 hover:bg-white"
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden />
                  Filters
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
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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

      <main className="flex-1 space-y-4 px-3 pt-3">
        {vault === "active" ? (
          <>
            <PipelineHeroCard
              stageId={filterStage}
              stageActiveCount={counts[filterStage] ?? 0}
              scoreOutOfTen={displayScore}
              pipelineValueFormatted={pipelineValueFormatted}
            />

            {isLoading ? (
              <div className="flex gap-2 overflow-hidden">
                {PIPELINE_STAGES.map((s) => (
                  <div key={s.id} className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-[#2C2C2C]/10" />
                ))}
              </div>
            ) : (
              <PipelineStageScroller
                activeStage={filterStage}
                counts={counts}
                onStageChange={setFilterStage}
              />
            )}

            <div className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 font-serif text-lg font-bold text-[#2C2C2C]">
                Deals in {stageLabel}{" "}
                <span className="text-[#2C2C2C]/45">({stageDeals.length})</span>
              </h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#2C2C2C]/10 bg-white px-2 py-1 text-xs font-bold text-[#2C2C2C]/75"
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
                    moveBusy={moveBusyId === deal.id}
                    onMoveToNextStage={(d, stage) => void moveDealToNext(d, stage)}
                    onViewDocuments={onViewDocuments}
                    onOpenMenu={onOpenDealMenu}
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
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

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
