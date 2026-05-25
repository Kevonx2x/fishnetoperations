"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  CADENCE_GROUP_ORDER,
  CEO_CHECKLIST_CADENCES,
  cadenceGroupLabel,
  ceoChecklistDueStatus,
  type CeoDueStatus,
} from "@/lib/ceo-checklist-due";
import {
  CEO_CHECKLIST_CATEGORIES,
  CEO_DECISION_CATEGORIES,
} from "@/lib/ceo-admin-constants";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type SubTab = "checklist" | "decisions" | "metrics";

type CadenceFilter = "all" | "daily" | "weekly" | "monthly" | "quarterly" | "once";

type ChecklistItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  cadence: string;
  estimated_minutes: number | null;
  sort_order: number;
  last_completed_at: string | null;
  last_completed_by: string | null;
  completion_count: number;
  last_completion_notes: string | null;
};

type DecisionRow = {
  id: string;
  title: string;
  context: string | null;
  decision: string;
  alternatives_considered: string | null;
  reasoning: string | null;
  category: string;
  status: string;
  decided_at: string;
  decided_by: string | null;
};

const FIELD =
  "mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2 text-sm text-[#2C2C2C]";

const FILTER_CHIPS: { id: CadenceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "once", label: "Once" },
];

function categoryPillClass(category: string): string {
  switch (category) {
    case "operating":
      return "bg-[#6B9E6E]/10 text-[#6B9E6E]";
    case "financial":
      return "bg-[#D4A843]/10 text-[#D4A843]";
    case "product":
      return "bg-blue-500/10 text-blue-500";
    case "compliance":
      return "bg-red-500/10 text-red-500";
    case "strategic":
      return "bg-purple-500/10 text-purple-500";
    case "other":
      return "bg-gray-500/10 text-gray-500";
    default:
      return "bg-gray-500/10 text-gray-500";
  }
}

function dueDotClass(status: CeoDueStatus): string {
  switch (status) {
    case "not_due":
      return "bg-[#6B9E6E]";
    case "due_today":
      return "bg-[#D4A843]";
    case "overdue":
      return "bg-red-500";
  }
}

function dueLabel(status: CeoDueStatus): string {
  switch (status) {
    case "not_due":
      return "On track";
    case "due_today":
      return "Due today";
    case "overdue":
      return "Overdue";
  }
}

function statusPillClass(status: string): string {
  switch (status) {
    case "reversed":
      return "bg-orange-100 text-orange-800";
    case "superseded":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-[#6B9E6E]/15 text-[#5d8a60]";
  }
}

function matchesCadenceFilter(item: ChecklistItem, filter: CadenceFilter): boolean {
  if (filter === "all") {
    if (item.cadence === "once" && item.last_completed_at) return false;
    return true;
  }
  if (filter === "daily") return item.cadence === "daily";
  if (filter === "weekly")
    return item.cadence === "weekly_monday" || item.cadence === "weekly_friday";
  if (filter === "monthly") return item.cadence === "monthly";
  if (filter === "quarterly") return item.cadence === "quarterly";
  if (filter === "once") return item.cadence === "once";
  return true;
}

function formatDecidedDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function parseApiJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function CeoDashboardSection() {
  const [subTab, setSubTab] = useState<SubTab>("checklist");
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>("all");

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);

  const [itemModal, setItemModal] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [itemForm, setItemForm] = useState({
    title: "",
    description: "",
    category: "operating" as string,
    cadence: "daily" as string,
    estimated_minutes: "",
  });
  const [itemSaving, setItemSaving] = useState(false);

  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionForm, setDecisionForm] = useState({
    title: "",
    context: "",
    decision: "",
    alternatives_considered: "",
    reasoning: "",
    category: "operating",
  });
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [expandedDecision, setExpandedDecision] = useState<Record<string, boolean>>({});

  const loadChecklist = useCallback(async () => {
    setChecklistLoading(true);
    try {
      const res = await fetch("/api/admin/ceo/checklist", { credentials: "include" });
      const json = await parseApiJson<{
        success?: boolean;
        data?: { items?: ChecklistItem[] };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "Could not load checklist");
        setItems([]);
        return;
      }
      setItems(json.data?.items ?? []);
    } catch {
      toast.error("Could not load checklist");
      setItems([]);
    } finally {
      setChecklistLoading(false);
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const res = await fetch("/api/admin/ceo/decisions", { credentials: "include" });
      const json = await parseApiJson<{
        success?: boolean;
        data?: { decisions?: DecisionRow[] };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "Could not load decisions");
        setDecisions([]);
        return;
      }
      setDecisions(json.data?.decisions ?? []);
    } catch {
      toast.error("Could not load decisions");
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  useEffect(() => {
    if (subTab === "decisions") void loadDecisions();
  }, [subTab, loadDecisions]);

  const filteredItems = useMemo(
    () => items.filter((item) => matchesCadenceFilter(item, cadenceFilter)),
    [items, cadenceFilter],
  );

  const groupedItems = useMemo(() => {
    const groups: { cadence: string; label: string; items: ChecklistItem[] }[] = [];
    for (const cadence of CADENCE_GROUP_ORDER) {
      const groupItems = filteredItems.filter((i) => i.cadence === cadence);
      if (groupItems.length > 0) {
        groups.push({
          cadence,
          label: cadenceGroupLabel(cadence),
          items: groupItems,
        });
      }
    }
    return groups;
  }, [filteredItems]);

  const completeItem = async (item: ChecklistItem) => {
    setCompletingId(item.id);
    const prev = items;
    const now = new Date().toISOString();
    setItems((list) =>
      list.map((i) =>
        i.id === item.id
          ? {
              ...i,
              last_completed_at: now,
              completion_count: i.completion_count + 1,
            }
          : i,
      ),
    );
    setJustCompletedId(item.id);
    try {
      const res = await fetch(`/api/admin/ceo/checklist/${item.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const json = await parseApiJson<{
        success?: boolean;
        data?: ChecklistItem;
        error?: { message?: string };
      }>(res);
      if (!res.ok || !json?.success) {
        setItems(prev);
        toast.error(json?.error?.message ?? "Could not mark done");
        return;
      }
      if (json.data) {
        setItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...json.data } : i)));
      }
      toast.success("Marked done");
    } catch {
      setItems(prev);
      toast.error("Could not mark done");
    } finally {
      setCompletingId(null);
      window.setTimeout(() => {
        setJustCompletedId((id) => (id === item.id ? null : id));
      }, 1200);
    }
  };

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      title: "",
      description: "",
      category: "operating",
      cadence: "daily",
      estimated_minutes: "",
    });
    setItemModal("create");
  };

  const openEditItem = (item: ChecklistItem) => {
    setEditingItem(item);
    setItemForm({
      title: item.title,
      description: item.description ?? "",
      category: item.category,
      cadence: item.cadence,
      estimated_minutes:
        item.estimated_minutes != null ? String(item.estimated_minutes) : "",
    });
    setItemModal("edit");
  };

  const saveItem = async () => {
    const title = itemForm.title.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    setItemSaving(true);
    try {
      const body = {
        title,
        description: itemForm.description.trim() || null,
        category: itemForm.category,
        cadence: itemForm.cadence,
        estimated_minutes: itemForm.estimated_minutes.trim()
          ? Number(itemForm.estimated_minutes)
          : null,
      };
      const url =
        itemModal === "edit" && editingItem
          ? `/api/admin/ceo/checklist/${editingItem.id}`
          : "/api/admin/ceo/checklist";
      const res = await fetch(url, {
        method: itemModal === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await parseApiJson<{
        success?: boolean;
        error?: { message?: string };
      }>(res);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "Save failed");
        return;
      }
      toast.success(itemModal === "edit" ? "Item updated" : "Item added");
      setItemModal(null);
      await loadChecklist();
    } catch {
      toast.error("Save failed");
    } finally {
      setItemSaving(false);
    }
  };

  const softDeleteItem = async (item: ChecklistItem) => {
    if (!confirm(`Remove "${item.title}" from the checklist?`)) return;
    try {
      const res = await fetch(`/api/admin/ceo/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: false }),
      });
      const json = await parseApiJson<{ success?: boolean; error?: { message?: string } }>(res);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "Delete failed");
        return;
      }
      setItems((list) => list.filter((i) => i.id !== item.id));
      toast.success("Item removed");
    } catch {
      toast.error("Delete failed");
    }
  };

  const saveDecision = async () => {
    const title = decisionForm.title.trim();
    const decision = decisionForm.decision.trim();
    if (!title || !decision) {
      toast.error("Title and decision are required");
      return;
    }
    setDecisionSaving(true);
    try {
      const res = await fetch("/api/admin/ceo/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          context: decisionForm.context.trim() || null,
          decision,
          alternatives_considered: decisionForm.alternatives_considered.trim() || null,
          reasoning: decisionForm.reasoning.trim() || null,
          category: decisionForm.category,
        }),
      });
      const json = await parseApiJson<{
        success?: boolean;
        data?: DecisionRow;
        error?: { message?: string };
      }>(res);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "Could not save decision");
        return;
      }
      toast.success("Decision logged");
      setDecisionModalOpen(false);
      setDecisionForm({
        title: "",
        context: "",
        decision: "",
        alternatives_considered: "",
        reasoning: "",
        category: "operating",
      });
      if (json.data) {
        setDecisions((d) => [json.data!, ...d]);
      } else {
        await loadDecisions();
      }
    } catch {
      toast.error("Could not save decision");
    } finally {
      setDecisionSaving(false);
    }
  };

  const patchDecisionStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/ceo/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const json = await parseApiJson<{
        success?: boolean;
        data?: DecisionRow;
        error?: { message?: string };
      }>(res);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "Update failed");
        return;
      }
      if (json.data) {
        setDecisions((list) => list.map((d) => (d.id === id ? { ...d, ...json.data } : d)));
      }
      toast.success("Status updated");
    } catch {
      toast.error("Update failed");
    }
  };

  return (
    <div className="space-y-6 bg-[#FAF8F4] p-4 md:p-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">CEO Dashboard</h2>
        <p className="mt-1 text-sm font-medium text-[#484848]">
          Recurring checklist and decisions log — Phase 1
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-[#2C2C2C]/10 pb-3">
        {(
          [
            { id: "checklist" as const, label: "Checklist" },
            { id: "decisions" as const, label: "Decisions Log" },
            { id: "metrics" as const, label: "Metrics" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              subTab === t.id
                ? "bg-[#6B9E6E] text-white shadow-sm"
                : "border border-[#2C2C2C]/10 bg-white text-[#484848] hover:border-[#6B9E6E]/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {subTab === "checklist" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCadenceFilter(chip.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold transition",
                  cadenceFilter === chip.id
                    ? "bg-[#D4A843] text-[#2C2C2C]"
                    : "bg-white text-[#484848] ring-1 ring-[#2C2C2C]/10 hover:ring-[#6B9E6E]/30",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {checklistLoading ? (
            <p className="text-sm text-[#484848]">Loading checklist…</p>
          ) : groupedItems.length === 0 ? (
            <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-sm text-[#484848]">
              No items for this filter.
            </p>
          ) : (
            <div className="space-y-6">
              {groupedItems.map((group) => (
                <section key={group.cadence}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    {group.label}
                  </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => {
                      const dueStatus = ceoChecklistDueStatus(
                        item.cadence,
                        item.last_completed_at,
                      );
                      const isCompleting = completingId === item.id;
                      const fadeDone = justCompletedId === item.id;
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "group rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm transition-opacity",
                            fadeDone && "opacity-50",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              disabled={isCompleting}
                              onClick={() => void completeItem(item)}
                              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-[#6B9E6E] bg-white transition hover:bg-[#6B9E6E]/10 disabled:opacity-40"
                              aria-label={`Mark ${item.title} done`}
                            >
                              <span className="sr-only">Complete</span>
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-[#2C2C2C]">{item.title}</p>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                    categoryPillClass(item.category),
                                  )}
                                >
                                  {item.category}
                                </span>
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#888888]"
                                  title={dueLabel(dueStatus)}
                                >
                                  <span
                                    className={cn(
                                      "inline-block h-2 w-2 rounded-full",
                                      dueDotClass(dueStatus),
                                    )}
                                  />
                                  {dueLabel(dueStatus)}
                                </span>
                              </div>
                              {item.description ? (
                                <p className="mt-1 text-xs text-[#484848]">{item.description}</p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#888888]">
                                {item.estimated_minutes != null ? (
                                  <span>~{item.estimated_minutes} min</span>
                                ) : null}
                                {item.last_completed_at ? (
                                  <span>
                                    Last done {formatRelativeTime(item.last_completed_at)}
                                  </span>
                                ) : (
                                  <span>Never completed</span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
                              <button
                                type="button"
                                onClick={() => openEditItem(item)}
                                className="rounded-lg p-2 text-[#484848] hover:bg-[#FAF8F4]"
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void softDeleteItem(item)}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                aria-label="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={openCreateItem}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60]"
          >
            <Plus className="h-4 w-4" />
            Add new checklist item
          </button>
        </div>
      ) : null}

      {subTab === "decisions" ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setDecisionModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60]"
          >
            <Plus className="h-4 w-4" />
            Log a decision
          </button>

          {decisionsLoading ? (
            <p className="text-sm text-[#484848]">Loading decisions…</p>
          ) : decisions.length === 0 ? (
            <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-sm text-[#484848]">
              No decisions logged yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {decisions.map((row) => {
                const expanded = expandedDecision[row.id];
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-medium text-[#2C2C2C]">{row.title}</p>
                        <p className="mt-0.5 text-xs text-[#888888]">
                          {formatDecidedDate(row.decided_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            categoryPillClass(row.category),
                          )}
                        >
                          {row.category}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            statusPillClass(row.status),
                          )}
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[#2C2C2C]">{row.decision}</p>

                    {(row.context || row.alternatives_considered || row.reasoning) && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDecision((e) => ({ ...e, [row.id]: !e[row.id] }))
                        }
                        className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#6B9E6E] hover:underline"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        Context / Alternatives / Reasoning
                      </button>
                    )}

                    {expanded ? (
                      <div className="mt-3 space-y-2 border-t border-[#2C2C2C]/8 pt-3 text-sm text-[#484848]">
                        {row.context ? (
                          <div>
                            <p className="text-xs font-bold uppercase text-[#2C2C2C]/45">
                              Context
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{row.context}</p>
                          </div>
                        ) : null}
                        {row.alternatives_considered ? (
                          <div>
                            <p className="text-xs font-bold uppercase text-[#2C2C2C]/45">
                              Alternatives
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">
                              {row.alternatives_considered}
                            </p>
                          </div>
                        ) : null}
                        {row.reasoning ? (
                          <div>
                            <p className="text-xs font-bold uppercase text-[#2C2C2C]/45">
                              Reasoning
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{row.reasoning}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {row.status === "active" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void patchDecisionStatus(row.id, "reversed")}
                          className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800 hover:bg-orange-100"
                        >
                          Mark reversed
                        </button>
                        <button
                          type="button"
                          onClick={() => void patchDecisionStatus(row.id, "superseded")}
                          className="rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4] px-3 py-1.5 text-xs font-bold text-[#484848] hover:border-[#6B9E6E]/30"
                        >
                          Mark superseded
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {subTab === "metrics" ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 shadow-sm">
          <div className="max-w-md text-center">
            <p className="font-serif text-xl font-bold text-[#2C2C2C]">Coming in Phase 2</p>
            <p className="mt-2 text-sm text-[#484848]">Planned for the next release:</p>
            <ul className="mt-4 space-y-2 text-left text-sm text-[#484848]">
              <li>• Live platform KPIs</li>
              <li>• Monthly trend snapshots</li>
              <li>• CSV import/export</li>
              <li>• Revenue tracking (PayMongo + manual)</li>
            </ul>
          </div>
        </div>
      ) : null}

      {itemModal ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">
                {itemModal === "create" ? "Add checklist item" : "Edit checklist item"}
              </h3>
              <button
                type="button"
                onClick={() => setItemModal(null)}
                className="rounded-lg p-1 text-[#484848] hover:bg-[#FAF8F4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-[#484848]">
                Title
                <input
                  className={FIELD}
                  value={itemForm.title}
                  onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Description
                <textarea
                  className={cn(FIELD, "min-h-[72px]")}
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Category
                <select
                  className={FIELD}
                  value={itemForm.category}
                  onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CEO_CHECKLIST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Cadence
                <select
                  className={FIELD}
                  value={itemForm.cadence}
                  onChange={(e) => setItemForm((f) => ({ ...f, cadence: e.target.value }))}
                >
                  {CEO_CHECKLIST_CADENCES.map((c) => (
                    <option key={c} value={c}>
                      {cadenceGroupLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Estimated minutes
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={itemForm.estimated_minutes}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, estimated_minutes: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemModal(null)}
                className="rounded-xl border border-[#2C2C2C]/12 px-4 py-2 text-sm font-bold text-[#484848]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={itemSaving}
                onClick={() => void saveItem()}
                className="rounded-xl bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
              >
                {itemSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {decisionModalOpen ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">Log a decision</h3>
              <button
                type="button"
                onClick={() => setDecisionModalOpen(false)}
                className="rounded-lg p-1 text-[#484848] hover:bg-[#FAF8F4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-[#484848]">
                Title
                <input
                  className={FIELD}
                  value={decisionForm.title}
                  onChange={(e) => setDecisionForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Context
                <textarea
                  className={cn(FIELD, "min-h-[64px]")}
                  value={decisionForm.context}
                  onChange={(e) => setDecisionForm((f) => ({ ...f, context: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Decision (required)
                <textarea
                  className={cn(FIELD, "min-h-[80px]")}
                  value={decisionForm.decision}
                  onChange={(e) => setDecisionForm((f) => ({ ...f, decision: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Alternatives considered
                <textarea
                  className={cn(FIELD, "min-h-[64px]")}
                  value={decisionForm.alternatives_considered}
                  onChange={(e) =>
                    setDecisionForm((f) => ({ ...f, alternatives_considered: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Reasoning
                <textarea
                  className={cn(FIELD, "min-h-[64px]")}
                  value={decisionForm.reasoning}
                  onChange={(e) => setDecisionForm((f) => ({ ...f, reasoning: e.target.value }))}
                />
              </label>
              <label className="block text-xs font-bold text-[#484848]">
                Category
                <select
                  className={FIELD}
                  value={decisionForm.category}
                  onChange={(e) => setDecisionForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CEO_DECISION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecisionModalOpen(false)}
                className="rounded-xl border border-[#2C2C2C]/12 px-4 py-2 text-sm font-bold text-[#484848]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={decisionSaving}
                onClick={() => void saveDecision()}
                className="rounded-xl bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
              >
                {decisionSaving ? "Saving…" : "Save decision"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
