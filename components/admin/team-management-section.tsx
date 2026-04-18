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
  start_date: string | null;
  department: string | null;
  employment_type: string | null;
  rate_amount: number | null;
  currency: string | null;
  rate_period: string | null;
  hr_notes: string | null;
  equity_pct: number | null;
  employment_status: string | null;
  admin_added_by: string | null;
  profile: ProfileLite;
  deliverables: EmployeeDeliverable[];
};

const HR_DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Operations",
  "Design",
  "Other",
] as const;

const HR_EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contractor", "Intern"] as const;

const HR_CURRENCIES = ["USD", "PHP"] as const;

const HR_RATE_PERIODS = ["Hourly", "Monthly", "Annual"] as const;

function priorityBadgeClass(p: string): string {
  if (p === "Critical") return "bg-red-200 text-red-900 ring-1 ring-red-300/60";
  if (p === "High") return "bg-[#fef08a] text-[#713f12] ring-1 ring-[#D4A843]/40";
  return "bg-[#bbf7d0] text-green-900 ring-1 ring-[#6B9E6E]/35";
}

function formatLongStartDate(startDate: string | null, createdAt: string): string {
  const raw = (startDate ?? createdAt).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function daysSinceStart(startDate: string | null, createdAt: string): number {
  const raw = (startDate ?? createdAt).slice(0, 10);
  const start = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
}

function workStatusBadgeClass(status: string): string {
  if (status === "Trial") return "bg-[#D4A843]/22 text-[#8a6d32] ring-1 ring-[#D4A843]/45";
  if (status === "Active") return "bg-[#6B9E6E]/18 text-[#2C5F32] ring-1 ring-[#6B9E6E]/40";
  if (status === "Terminated") return "bg-red-100 text-red-800 ring-1 ring-red-200";
  if (status === "On Leave") return "bg-[#2C2C2C]/10 text-[#2C2C2C]/70 ring-1 ring-[#2C2C2C]/15";
  return "bg-[#2C2C2C]/08 text-[#2C2C2C]/60 ring-1 ring-[#2C2C2C]/10";
}

function formatCompensation(emp: TeamManagementEmployee): string {
  const amt = emp.rate_amount;
  const cur = emp.currency ?? "PHP";
  const per = emp.rate_period ?? "";
  if (amt == null || Number.isNaN(Number(amt))) return "—";
  const n = Number(amt);
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  const sym = cur === "USD" ? "$" : "₱";
  const suffix =
    per === "Hourly" ? "/hr" : per === "Monthly" ? "/mo" : per === "Annual" ? "/yr" : "";
  return `${sym}${formatted}${suffix}`;
}

function emptyAddForm() {
  return {
    name: "",
    role: "",
    department: "Engineering" as (typeof HR_DEPARTMENTS)[number],
    employment_type: "Full Time" as (typeof HR_EMPLOYMENT_TYPES)[number],
    rate_amount: "",
    currency: "PHP" as (typeof HR_CURRENCIES)[number],
    rate_period: "Monthly" as (typeof HR_RATE_PERIODS)[number],
    start_date: "",
    hr_notes: "",
    equity_pct: "",
  };
}

export function TeamManagementSection() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<TeamManagementEmployee[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
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
    const role = addForm.role.trim();
    if (!name) {
      toast.error("Full name is required.");
      return;
    }
    if (!role) {
      toast.error("Role is required.");
      return;
    }
    if (!addForm.start_date) {
      toast.error("Start date is required.");
      return;
    }
    const rate = Number.parseFloat(addForm.rate_amount);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Enter a valid rate / salary (0 or greater).");
      return;
    }
    let equity = 0;
    if (addForm.equity_pct.trim()) {
      const e = Number.parseFloat(addForm.equity_pct);
      if (!Number.isFinite(e) || e < 0) {
        toast.error("Equity % must be a valid number.");
        return;
      }
      equity = e;
    }

    setAddSaving(true);
    try {
      const res = await fetch("/api/admin/team-management/employees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          department: addForm.department,
          employment_type: addForm.employment_type,
          rate_amount: rate,
          currency: addForm.currency,
          rate_period: addForm.rate_period,
          start_date: addForm.start_date,
          hr_notes: addForm.hr_notes.trim() || null,
          equity_pct: equity,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not add employee");
        return;
      }
      toast.success("Employee added.");
      setAddOpen(false);
      setAddForm(emptyAddForm());
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
            HR records, onboarding plans, and deliverables (admin only).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddForm(emptyAddForm());
            setAddOpen(true);
          }}
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
            const displayName = emp.name.trim() || emp.profile?.full_name?.trim() || "Employee";
            const avatarUrl = emp.profile?.avatar_url?.trim() || null;
            const tenureDays = daysSinceStart(emp.start_date, emp.created_at);
            const total = emp.deliverables.length;
            const done = emp.deliverables.filter((d) => d.is_complete).length;
            const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
            const status = emp.employment_status ?? "Trial";
            const equity = Number(emp.equity_pct ?? 0);

            return (
              <article
                key={emp.id}
                className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-[0_1px_3px_rgba(44,44,44,0.06)]"
              >
                <header className="border-b border-[#2C2C2C]/08 bg-[#FAF8F4] px-5 py-5 sm:px-7">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="" fill className="object-cover" sizes="72px" unoptimized />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/12 font-serif text-2xl font-semibold text-[#6B9E6E]">
                            {displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="font-serif text-xl font-semibold tracking-tight text-[#2C2C2C]">
                            {displayName}
                          </h3>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${workStatusBadgeClass(status)}`}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#2C2C2C] ring-1 ring-[#2C2C2C]/12">
                            {emp.role}
                          </span>
                          {emp.department ? (
                            <span className="rounded-md bg-[#6B9E6E]/10 px-2.5 py-1 text-xs font-semibold text-[#2C2C2C] ring-1 ring-[#6B9E6E]/25">
                              {emp.department}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                              Employment
                            </p>
                            <p className="mt-0.5 font-semibold text-[#2C2C2C]">{emp.employment_type ?? "—"}</p>
                          </div>
                          <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                              Compensation
                            </p>
                            <p className="mt-0.5 font-semibold tabular-nums text-[#2C2C2C]">{formatCompensation(emp)}</p>
                          </div>
                          <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                              Start date
                            </p>
                            <p className="mt-0.5 font-semibold text-[#2C2C2C]">
                              {formatLongStartDate(emp.start_date, emp.created_at)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                              Tenure
                            </p>
                            <p className="mt-0.5 font-semibold text-[#2C2C2C]">
                              {tenureDays} day{tenureDays === 1 ? "" : "s"} since start
                            </p>
                          </div>
                        </div>
                        {equity > 0 ? (
                          <p className="mt-3 text-xs font-semibold text-[#8a6d32]">
                            Equity: <span className="tabular-nums">{equity}%</span>
                          </p>
                        ) : null}
                        {emp.hr_notes?.trim() ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#2C2C2C]/60">
                            <span className="font-bold text-[#2C2C2C]/45">HR notes: </span>
                            {emp.hr_notes.trim()}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 flex-col items-stretch gap-2 border-t border-[#2C2C2C]/08 pt-4 lg:w-52 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      <p className="text-center text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45 lg:text-left">
                        Plan progress
                      </p>
                      <p className="text-center font-serif text-2xl font-bold text-[#6B9E6E] lg:text-left">
                        {completionPct}%
                        {total > 0 ? (
                          <span className="ml-1 text-sm font-semibold text-[#2C2C2C]/45">
                            ({done}/{total})
                          </span>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        onClick={() => downloadPlan(emp)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2 text-xs font-bold text-[#2C2C2C] shadow-sm hover:border-[#6B9E6E]/35"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Download Plan
                      </button>
                    </div>
                  </div>
                </header>

                <div className="divide-y divide-[#2C2C2C]/08 bg-white px-3 py-2 sm:px-5">
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

                <footer className="border-t border-[#2C2C2C]/08 bg-[#FAF8F4] px-5 py-4 sm:px-7">
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
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl sm:p-8"
          >
            <h3 className="font-serif text-xl font-bold text-[#2C2C2C]">Add employee</h3>
            <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
              Create an internal HR record. Deliverables can be added per week after the employee is saved.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Full name
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4]/40 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Role
                <input
                  type="text"
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Frontend Engineer, Sales Executive"
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4]/40 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Department
                <select
                  value={addForm.department}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, department: e.target.value as (typeof HR_DEPARTMENTS)[number] }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                >
                  {HR_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Employment type
                <select
                  value={addForm.employment_type}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      employment_type: e.target.value as (typeof HR_EMPLOYMENT_TYPES)[number],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                >
                  {HR_EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Rate / salary
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={addForm.rate_amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, rate_amount: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold tabular-nums text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Currency
                <select
                  value={addForm.currency}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, currency: e.target.value as (typeof HR_CURRENCIES)[number] }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                >
                  {HR_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Period
                <select
                  value={addForm.rate_period}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, rate_period: e.target.value as (typeof HR_RATE_PERIODS)[number] }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                >
                  {HR_RATE_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Start date
                <input
                  type="date"
                  value={addForm.start_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Equity % <span className="font-normal normal-case text-[#2C2C2C]/45">(optional)</span>
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  value={addForm.equity_pct}
                  onChange={(e) => setAddForm((f) => ({ ...f, equity_pct: e.target.value }))}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold tabular-nums text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Notes <span className="font-normal normal-case text-[#2C2C2C]/45">(optional)</span>
                <textarea
                  value={addForm.hr_notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, hr_notes: e.target.value }))}
                  rows={3}
                  placeholder="Onboarding context, reporting line, equipment, etc."
                  className="mt-1 w-full resize-y rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4]/40 px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
            </div>
            <div className="mt-8 flex justify-end gap-2 border-t border-[#2C2C2C]/08 pt-5">
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
                className="rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {addSaving ? "Saving…" : "Create record"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
