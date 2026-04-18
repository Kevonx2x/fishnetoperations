"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, Plus } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  EMMANUEL_UNLOCK_REWARDS,
  ONBOARDING_WEEK_TITLES,
} from "@/lib/emmanuel-onboarding-seed";

type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
} | null;

export type EmployeeDeliverable = {
  id: string;
  employee_id: string;
  week_number: number;
  deliverable_text: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  is_complete: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamManagementEmployee = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  role: string;
  user_id: string | null;
  agent_id: string | null;
  trial_start_date: string | null;
  profile: ProfileLite;
  deliverables: EmployeeDeliverable[];
};

function priorityBadgeClass(p: string): string {
  if (p === "Critical") return "bg-red-200 text-red-900 ring-1 ring-red-300/60";
  if (p === "High") return "bg-[#fef08a] text-[#713f12] ring-1 ring-[#D4A843]/40";
  return "bg-[#bbf7d0] text-green-900 ring-1 ring-[#6B9E6E]/35";
}

function roleBadgeLabel(role: string): string {
  if (role === "co_founder") return "Co-Founder";
  if (role === "va_admin") return "VA Admin";
  if (role === "owner") return "Owner";
  return role;
}

function trialDayProgress(trialStartIso: string | null, createdAt: string): { day: number; remaining: number; pct: number } {
  const startStr = trialStartIso?.slice(0, 10) ?? createdAt.slice(0, 10);
  const start = new Date(`${startStr}T12:00:00`);
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  const dayFloat = Math.floor(ms / (24 * 60 * 60 * 1000));
  const day = Math.max(0, Math.min(30, dayFloat + 1));
  const remaining = Math.max(0, 30 - dayFloat);
  const pct = Math.min(100, Math.max(0, (dayFloat / 30) * 100));
  return { day, remaining, pct };
}

export function TeamManagementSection() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<TeamManagementEmployee[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", role: "co_founder", trial_start_date: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [openWeek, setOpenWeek] = useState<Record<string, boolean>>({});
  const [openNotesId, setOpenNotesId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/team-management", { credentials: "include" });
      const json = (await res.json()) as { employees?: TeamManagementEmployee[]; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not load team");
        setEmployees([]);
        return;
      }
      setEmployees(json.employees ?? []);
    } catch {
      toast.error("Could not load team");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleWeek = (key: string) => {
    setOpenWeek((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const patchDeliverable = async (id: string, patch: { is_complete?: boolean; notes?: string | null }) => {
    const res = await fetch("/api/admin/employee-deliverables", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const json = (await res.json()) as { error?: string; deliverable?: EmployeeDeliverable };
    if (!res.ok) {
      toast.error(json.error ?? "Update failed");
      return;
    }
    if (json.deliverable) {
      setEmployees((prev) =>
        prev.map((emp) => ({
          ...emp,
          deliverables: emp.deliverables.map((d) => (d.id === id ? json.deliverable! : d)),
        })),
      );
    }
  };

  const submitAddEmployee = async () => {
    const name = addForm.name.trim();
    if (!name) {
      toast.error("Name is required.");
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch("/api/admin/team-management/employees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role: addForm.role,
          trial_start_date: addForm.trial_start_date || new Date().toISOString().slice(0, 10),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not add employee");
        return;
      }
      toast.success("Employee added.");
      setAddOpen(false);
      setAddForm({ name: "", role: "co_founder", trial_start_date: "" });
      await load();
    } finally {
      setAddSaving(false);
    }
  };

  const addDeliverableRow = async (employeeId: string, week_number: number) => {
    const text = window.prompt("Deliverable description?");
    if (!text?.trim()) return;
    const priority = window.prompt("Priority: Critical, High, Medium, or Low?", "Medium")?.trim() as
      | "Critical"
      | "High"
      | "Medium"
      | "Low"
      | undefined;
    const p =
      priority === "Critical" || priority === "High" || priority === "Medium" || priority === "Low"
        ? priority
        : "Medium";
    const res = await fetch("/api/admin/employee-deliverables", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: employeeId,
        week_number,
        deliverable_text: text.trim(),
        priority: p,
      }),
    });
    const json = (await res.json()) as { error?: string; deliverable?: EmployeeDeliverable };
    if (!res.ok) {
      toast.error(json.error ?? "Could not add deliverable");
      return;
    }
    if (json.deliverable) {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === employeeId
            ? { ...emp, deliverables: [...emp.deliverables, json.deliverable!].sort((a, b) => a.week_number - b.week_number) }
            : emp,
        ),
      );
      toast.success("Deliverable added.");
    }
  };

  const downloadPlan = (emp: TeamManagementEmployee) => {
    const items = emp.deliverables.map((d) => ({
      week_number: d.week_number,
      deliverable_text: d.deliverable_text,
      priority: d.priority,
      is_complete: d.is_complete,
      notes: d.notes,
    }));
    try {
      sessionStorage.setItem(
        "adminTeamPrintPlan",
        JSON.stringify({ employeeName: emp.name, items }),
      );
    } catch {
      toast.error("Could not prepare print data.");
      return;
    }
    window.open("/admin/team/print", "_blank", "noopener,noreferrer");
  };

  const isEmmanuel = (name: string) => /emmanuel/i.test(name.trim());

  return (
    <div className="space-y-8 font-sans text-[#2C2C2C]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">Team Management</h2>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
            30-day onboarding plans, deliverables, and progress (admin only).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-sm ring-1 ring-[#D4A843]/30 hover:bg-[#5d8a60]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add Employee
        </button>
      </div>

      {loading ? (
        <p className="text-sm font-semibold text-[#2C2C2C]/55">Loading team…</p>
      ) : employees.length === 0 ? (
        <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-8 text-center text-sm font-semibold text-[#2C2C2C]/55 shadow-sm">
          No internal team members yet. Use Add Employee to create one.
        </p>
      ) : (
        <div className="space-y-8">
          {employees.map((emp) => {
            const displayName = emp.profile?.full_name?.trim() || emp.name;
            const avatarUrl = emp.profile?.avatar_url?.trim() || null;
            const { day, remaining, pct } = trialDayProgress(emp.trial_start_date, emp.created_at);
            const total = emp.deliverables.length;
            const done = emp.deliverables.filter((d) => d.is_complete).length;
            const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <article
                key={emp.id}
                className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm ring-1 ring-[#D4A843]/15"
              >
                <header className="border-b border-[#2C2C2C]/08 bg-[#FAF8F4] px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#2C2C2C]/10 ring-2 ring-[#D4A843]/40">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="" fill className="object-cover" sizes="64px" unoptimized />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-serif text-xl font-bold text-[#6B9E6E]">
                            {displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-serif text-xl font-bold text-[#2C2C2C]">{displayName}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#6B9E6E]/15 px-3 py-0.5 text-xs font-bold text-[#2C2C2C] ring-1 ring-[#6B9E6E]/30">
                            {roleBadgeLabel(emp.role)}
                          </span>
                          {emp.profile?.role ? (
                            <span className="rounded-full bg-[#D4A843]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#8a6d32]">
                              Profile: {emp.profile.role}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs font-semibold text-[#2C2C2C]/55">
                          Trial start:{" "}
                          <span className="text-[#2C2C2C]">
                            {new Date(`${(emp.trial_start_date ?? emp.created_at).slice(0, 10)}T12:00:00`).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="w-full max-w-md shrink-0 space-y-2 sm:pt-1">
                      <div className="flex items-end justify-between gap-2 text-xs font-bold">
                        <span className="text-[#2C2C2C]/60">Day {Math.min(30, day)} of 30</span>
                        <span className="text-[#6B9E6E]">{remaining} days remaining</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#2C2C2C]/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#6B9E6E] to-[#D4A843] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-right text-xs font-bold text-[#2C2C2C]/70">
                        Overall completion:{" "}
                        <span className="text-[#6B9E6E]">{completionPct}%</span>
                        {total > 0 ? (
                          <span className="font-semibold text-[#2C2C2C]/45"> ({done}/{total})</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => downloadPlan(emp)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#2C2C2C]/12 bg-white px-4 py-2 text-xs font-bold text-[#2C2C2C] shadow-sm hover:border-[#6B9E6E]/40"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Download Plan
                    </button>
                  </div>
                </header>

                <div className="divide-y divide-[#2C2C2C]/08 bg-white px-3 py-2 sm:px-4">
                  {([1, 2, 3, 4] as const).map((week) => {
                    const wkKey = `${emp.id}-w${week}`;
                    const open = !!openWeek[wkKey];
                    const title = ONBOARDING_WEEK_TITLES[week];
                    const rows = emp.deliverables.filter((d) => d.week_number === week);
                    return (
                      <div key={wkKey} className="py-1">
                        <button
                          type="button"
                          onClick={() => toggleWeek(wkKey)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#FAF8F4]"
                        >
                          <span className="font-serif text-base font-bold text-[#2C2C2C]">{title}</span>
                          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="h-5 w-5 shrink-0 text-[#2C2C2C]/55" aria-hidden />
                          </motion.span>
                        </button>
                        <AnimatePresence initial={false}>
                          {open ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22 }}
                              className="overflow-hidden"
                            >
                              <ul className="space-y-2 px-2 pb-4 pt-1">
                                {rows.map((d) => {
                                  const notesOpen = openNotesId === d.id;
                                  return (
                                    <li
                                      key={d.id}
                                      className="rounded-xl border border-[#2C2C2C]/08 bg-[#FAF8F4]/60 px-3 py-2.5"
                                    >
                                      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                                        <input
                                          type="checkbox"
                                          checked={d.is_complete}
                                          onChange={(e) => void patchDeliverable(d.id, { is_complete: e.target.checked })}
                                          className="mt-1 h-4 w-4 shrink-0 rounded border-[#2C2C2C]/25 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                                          aria-label="Mark complete"
                                        />
                                        <p
                                          className={`min-w-0 flex-1 text-sm font-semibold leading-snug ${
                                            d.is_complete ? "text-[#2C2C2C]/45 line-through" : "text-[#2C2C2C]"
                                          }`}
                                        >
                                          {d.deliverable_text}
                                        </p>
                                        <span
                                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityBadgeClass(
                                            d.priority,
                                          )}`}
                                        >
                                          {d.priority}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenNotesId((id) => (id === d.id ? null : d.id));
                                            setNoteDrafts((prev) => ({
                                              ...prev,
                                              [d.id]: prev[d.id] ?? d.notes ?? "",
                                            }));
                                          }}
                                          className="shrink-0 rounded-lg p-1 text-[#2C2C2C]/45 hover:bg-white hover:text-[#2C2C2C]"
                                          aria-expanded={notesOpen}
                                          aria-label="Toggle notes"
                                        >
                                          <motion.span animate={{ rotate: notesOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
                                            <ChevronDown className="h-4 w-4" />
                                          </motion.span>
                                        </button>
                                      </div>
                                      <AnimatePresence initial={false}>
                                        {notesOpen ? (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <textarea
                                              value={noteDrafts[d.id] ?? ""}
                                              onChange={(e) =>
                                                setNoteDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                                              }
                                              onBlur={() =>
                                                void patchDeliverable(d.id, {
                                                  notes: (noteDrafts[d.id] ?? "").trim() || null,
                                                })
                                              }
                                              rows={3}
                                              placeholder="Notes, context, or feedback…"
                                              className="mt-2 w-full resize-y rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                                            />
                                          </motion.div>
                                        ) : null}
                                      </AnimatePresence>
                                    </li>
                                  );
                                })}
                              </ul>
                              <div className="px-2 pb-3">
                                <button
                                  type="button"
                                  onClick={() => void addDeliverableRow(emp.id, week)}
                                  className="text-xs font-bold text-[#6B9E6E] underline decoration-[#6B9E6E]/40 hover:text-[#5d8a60]"
                                >
                                  + Add deliverable this week
                                </button>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <footer className="border-t border-[#2C2C2C]/08 bg-[#FAF8F4] px-5 py-4 sm:px-6">
                  <h4 className="font-serif text-sm font-bold text-[#2C2C2C]">What They Unlock</h4>
                  {isEmmanuel(emp.name) || isEmmanuel(displayName) ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm font-semibold text-[#2C2C2C]/80">
                      {EMMANUEL_UNLOCK_REWARDS.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/50">
                      Define rewards with leadership when this plan completes.
                    </p>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {addOpen ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
          >
            <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">Add employee</h3>
            <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
              Creates an internal team row and trial start. Add deliverables per week after save.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Name
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Role
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
                >
                  <option value="owner">Owner</option>
                  <option value="co_founder">Co-Founder</option>
                  <option value="va_admin">VA Admin</option>
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Trial start date
                <input
                  type="date"
                  value={addForm.trial_start_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, trial_start_date: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addSaving}
                onClick={() => void submitAddEmployee()}
                className="rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {addSaving ? "Saving…" : "Create"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
