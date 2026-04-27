"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Mail,
  Pencil,
  Plus,
  Trash2,
  UserX,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  EMMANUEL_UNLOCK_REWARDS,
  ONBOARDING_WEEK_TITLES,
} from "@/lib/emmanuel-onboarding-seed";
import { getDefaultDeliverableTaskNotes } from "@/lib/deliverable-task-note-templates";

type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
} | null;

export type DeliverableWorkflowStatus =
  | "not_started"
  | "submitted"
  | "pending_review"
  | "approved"
  | "changes_requested";

export type EmployeeDeliverable = {
  id: string;
  employee_id: string;
  week_number: number;
  deliverable_text: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  is_complete: boolean;
  status: DeliverableWorkflowStatus | string;
  admin_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function deliverableApproved(d: EmployeeDeliverable): boolean {
  if (d.status === "approved") return true;
  if (!d.status && d.is_complete) return true;
  return false;
}

function adminDeliverableStatusLabel(status: string): string {
  if (status === "submitted" || status === "pending_review") return "Pending review";
  if (status === "approved") return "Approved";
  if (status === "changes_requested") return "Changes requested";
  if (status === "not_started") return "Not started";
  return status;
}

export type TeamManagementEmployee = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  role: string;
  user_id: string | null;
  agent_id: string | null;
  start_date: string | null;
  end_date: string | null;
  department: string | null;
  employment_type: string | null;
  rate_amount: number | null;
  currency: string | null;
  rate_period: string | null;
  hr_notes: string | null;
  equity_pct: number | null;
  equity_vesting_years: number | null;
  equity_cliff_months: number | null;
  employment_status: string | null;
  admin_added_by: string | null;
  work_email: string | null;
  personal_email: string | null;
  onboarding_checklist: Record<string, unknown> | null;
  profile: ProfileLite;
  deliverables: EmployeeDeliverable[];
};

export type EmployeeAdminNote = {
  id: string;
  note: string;
  created_at: string;
  created_by: string | null;
  author_name: string | null;
};

const HR_STATUSES = ["Trial", "Active", "On Leave", "Terminated"] as const;

const ONBOARDING_ITEMS: { key: string; label: string }[] = [
  { key: "github_access", label: "GitHub access given" },
  { key: "supabase_access", label: "Supabase access given" },
  { key: "vercel_access", label: "Vercel access given" },
  { key: "contract_signed", label: "Contract signed" },
  { key: "nda_signed", label: "NDA signed" },
  { key: "work_email_created", label: "Work email created" },
  { key: "equipment_provided", label: "Equipment provided" },
  { key: "handoff_document_sent", label: "Handoff document sent" },
  { key: "deliverables_document_sent", label: "Deliverables document sent" },
];

/** Approximate PHP per 1 USD for payroll rollup display. */
const PHP_PER_USD = 56;

const EMAIL_TONES = ["Encouraging", "Neutral", "Urgent"] as const;
type EmailTone = (typeof EMAIL_TONES)[number];

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

type EditFormState = {
  name: string;
  role: string;
  department: (typeof HR_DEPARTMENTS)[number];
  employment_type: (typeof HR_EMPLOYMENT_TYPES)[number];
  rate_amount: string;
  currency: (typeof HR_CURRENCIES)[number];
  rate_period: (typeof HR_RATE_PERIODS)[number];
  start_date: string;
  end_date: string;
  employment_status: (typeof HR_STATUSES)[number];
  work_email: string;
  personal_email: string;
  hr_notes: string;
  equity_pct: string;
  equity_vesting_years: string;
  equity_cliff_months: string;
};

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

function parseChecklist(raw: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const { key } of ONBOARDING_ITEMS) {
    out[key] = Boolean(raw[key]);
  }
  return out;
}

function monthlyUsdEquivalent(emp: TeamManagementEmployee): number {
  if (emp.employment_status === "Terminated") return 0;
  const rate = Number(emp.rate_amount ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const per = emp.rate_period ?? "";
  let monthly = 0;
  if (per === "Hourly") monthly = rate * 80;
  else if (per === "Monthly") monthly = rate;
  else if (per === "Annual") monthly = rate / 12;
  const cur = emp.currency ?? "PHP";
  if (cur === "USD") return monthly;
  return monthly / PHP_PER_USD;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function monthDiffFromStart(startDate: string | null, createdAt: string): number {
  const raw = (startDate ?? createdAt).slice(0, 10);
  const start = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function formatTenureHuman(startDate: string | null, createdAt: string): string {
  const raw = (startDate ?? createdAt).slice(0, 10);
  const start = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) {
    months -= 1;
    if (months < 0) {
      months += 12;
      years -= 1;
    }
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (parts.length === 0) return "Less than a month";
  return parts.join(", ");
}

function vestingProgressPct(emp: TeamManagementEmployee): number {
  const equity = Number(emp.equity_pct ?? 0);
  if (!(equity > 0)) return 0;
  const cliff = Math.max(0, Math.floor(Number(emp.equity_cliff_months ?? 12)));
  const vestYears = Math.max(0.25, Number(emp.equity_vesting_years ?? 4));
  const totalMonths = Math.round(vestYears * 12);
  const vestSpan = Math.max(1, totalMonths - cliff);
  const elapsed = monthDiffFromStart(emp.start_date, emp.created_at);
  if (elapsed < cliff) return 0;
  return Math.min(100, ((elapsed - cliff) / vestSpan) * 100);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function groupByDepartment(list: TeamManagementEmployee[]): { dept: string; members: TeamManagementEmployee[] }[] {
  const map = new Map<string, TeamManagementEmployee[]>();
  for (const e of list) {
    const d = (e.department ?? "").trim() || "Unassigned";
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(e);
  }
  const order = [...HR_DEPARTMENTS, "Unassigned"];
  const keys = [...map.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });
  return keys.map((dept) => ({ dept, members: map.get(dept)! }));
}

function buildProgressEmailHtml(
  emp: TeamManagementEmployee,
  tone: EmailTone,
  displayName: string,
): string {
  const total = emp.deliverables.length;
  const done = emp.deliverables.filter((d) => deliverableApproved(d)).length;
  const pend = total - done;
  let closing = "";
  if (tone === "Encouraging") {
    closing =
      "You are making strong progress—keep the momentum going. We are proud of the work you are shipping and are here if anything is blocked.";
  } else if (tone === "Urgent") {
    closing =
      "Several onboarding items still need attention. Please prioritize closing the gaps this week and reply with a short plan by end of day.";
  } else {
    closing = "Here is a factual snapshot of your onboarding progress. Let us know if you need clarity on any item.";
  }

  const weekBlocks = ([1, 2, 3, 4] as const)
    .map((w) => {
      const title = ONBOARDING_WEEK_TITLES[w];
      const items = emp.deliverables.filter((d) => d.week_number === w);
      const lines = items
        .map(
          (d) =>
            `<li style="color:${deliverableApproved(d) ? "#2C5F32" : "#888888"}">${escapeHtml(d.deliverable_text)} — ${
              deliverableApproved(d) ? "Done" : "Pending"
            }</li>`,
        )
        .join("");
      return `<p style="margin:16px 0 4px"><strong>${escapeHtml(title)}</strong></p><ul style="margin:0;padding-left:20px">${lines}</ul>`;
    })
    .join("");

  const summary = emp.deliverables
    .map(
      (d) =>
        `<li style="color:${deliverableApproved(d) ? "#2C5F32" : "#888888"}">${escapeHtml(d.deliverable_text)} — ${
          deliverableApproved(d) ? "Done" : "Pending"
        }</li>`,
    )
    .join("");

  return `<div style="font-family:Inter,system-ui,sans-serif;color:#2C2C2C;line-height:1.55;font-size:15px">
<p>Hi ${escapeHtml(displayName)},</p>
<p>Here is your <strong>BahayGo progress update</strong>. You have completed <strong>${done}</strong> of <strong>${total}</strong> deliverables${
    total ? ` (${pend} still pending)` : ""
  }.</p>
${weekBlocks}
<p style="margin-top:20px"><strong>Deliverables summary</strong></p>
<ul style="padding-left:20px">${summary}</ul>
<p style="margin-top:20px">${escapeHtml(closing)}</p>
<p style="margin-top:24px;color:#6B9E6E;font-weight:600">— BahayGo</p>
</div>`;
}

function editFormFromEmployee(emp: TeamManagementEmployee): EditFormState {
  const deptList = HR_DEPARTMENTS as readonly string[];
  const dept = emp.department && deptList.includes(emp.department) ? (emp.department as EditFormState["department"]) : "Other";
  const etList = HR_EMPLOYMENT_TYPES as readonly string[];
  const et =
    emp.employment_type && etList.includes(emp.employment_type)
      ? (emp.employment_type as EditFormState["employment_type"])
      : "Full Time";
  const stList = HR_STATUSES as readonly string[];
  const st =
    emp.employment_status && stList.includes(emp.employment_status)
      ? (emp.employment_status as EditFormState["employment_status"])
      : "Trial";
  const cur = emp.currency === "USD" || emp.currency === "PHP" ? emp.currency : "PHP";
  const rp = emp.rate_period === "Hourly" || emp.rate_period === "Monthly" || emp.rate_period === "Annual" ? emp.rate_period : "Monthly";
  return {
    name: emp.name ?? "",
    role: emp.role ?? "",
    department: dept,
    employment_type: et,
    rate_amount: emp.rate_amount != null ? String(emp.rate_amount) : "",
    currency: cur,
    rate_period: rp,
    start_date: emp.start_date?.slice(0, 10) ?? "",
    end_date: emp.end_date?.slice(0, 10) ?? "",
    employment_status: st,
    work_email: emp.work_email ?? "",
    personal_email: emp.personal_email ?? "",
    hr_notes: emp.hr_notes ?? "",
    equity_pct: emp.equity_pct != null && Number(emp.equity_pct) > 0 ? String(emp.equity_pct) : "",
    equity_vesting_years: emp.equity_vesting_years != null ? String(emp.equity_vesting_years) : "4",
    equity_cliff_months: emp.equity_cliff_months != null ? String(emp.equity_cliff_months) : "12",
  };
}

function emptyEditForm(): EditFormState {
  return {
    name: "",
    role: "",
    department: "Engineering",
    employment_type: "Full Time",
    rate_amount: "",
    currency: "PHP",
    rate_period: "Monthly",
    start_date: "",
    end_date: "",
    employment_status: "Trial",
    work_email: "",
    personal_email: "",
    hr_notes: "",
    equity_pct: "",
    equity_vesting_years: "4",
    equity_cliff_months: "12",
  };
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
    work_email: "",
    personal_email: "",
  };
}

export type TeamManagementSectionProps = {
  /** When false (ops_admin), salary / equity UI and aggregates are hidden; saves keep existing compensation server-side. */
  showCompensation?: boolean;
};

export function TeamManagementSection({ showCompensation = true }: TeamManagementSectionProps) {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<TeamManagementEmployee[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [addSaving, setAddSaving] = useState(false);
  const [openWeek, setOpenWeek] = useState<Record<string, boolean>>({});
  const [openNotesId, setOpenNotesId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [deptOpen, setDeptOpen] = useState<Record<string, boolean>>({});
  const [cardExpanded, setCardExpanded] = useState<Record<string, boolean>>({});
  const [onboardingOpen, setOnboardingOpen] = useState<Record<string, boolean>>({});
  const [editEmp, setEditEmp] = useState<TeamManagementEmployee | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [terminateEmp, setTerminateEmp] = useState<TeamManagementEmployee | null>(null);
  const [terminateBusy, setTerminateBusy] = useState(false);
  const [deleteEmp, setDeleteEmp] = useState<TeamManagementEmployee | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [emailEmp, setEmailEmp] = useState<TeamManagementEmployee | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailTone, setEmailTone] = useState<EmailTone>("Encouraging");
  const [emailHtml, setEmailHtml] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [notesState, setNotesState] = useState<
    Record<string, { items: EmployeeAdminNote[]; total: number; loaded: boolean }>
  >({});
  const [internalNoteDraft, setInternalNoteDraft] = useState<Record<string, string>>({});
  const [internalNoteBusy, setInternalNoteBusy] = useState<string | null>(null);
  const [requestChangesFor, setRequestChangesFor] = useState<string | null>(null);
  const [requestChangesDraft, setRequestChangesDraft] = useState<Record<string, string>>({});

  const [streamSyncBusy, setStreamSyncBusy] = useState(false);
  const [streamSyncResult, setStreamSyncResult] = useState<number | null>(null);
  const [streamBackfillBusy, setStreamBackfillBusy] = useState(false);
  const [streamBackfillResult, setStreamBackfillResult] = useState<number | null>(null);

  const [editForm, setEditForm] = useState<EditFormState>(() => emptyEditForm());

  const backfillStreamChannelMetadata = useCallback(async () => {
    setStreamBackfillBusy(true);
    setStreamBackfillResult(null);
    try {
      const res = await fetch("/api/admin/stream/backfill-channel-metadata", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | { success: true; data: { patched: number } }
        | { success: false; error?: { message?: string } }
        | null;
      if (!res.ok || !json || json.success !== true) {
        const msg =
          json && json.success === false ? json.error?.message ?? "Backfill failed" : "Backfill failed";
        toast.error(msg);
        return;
      }
      setStreamBackfillResult(json.data.patched);
      toast.success(`Patched ${json.data.patched} channels.`);
    } catch {
      toast.error("Backfill failed");
    } finally {
      setStreamBackfillBusy(false);
    }
  }, []);

  const syncAllUsersToStream = useCallback(async () => {
    setStreamSyncBusy(true);
    setStreamSyncResult(null);
    try {
      const res = await fetch("/api/admin/stream/sync-all-users", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as
        | { success: true; data: { synced: number } }
        | { success: false; error?: { message?: string } };
      if (!res.ok || !("success" in json) || json.success !== true) {
        const msg =
          "success" in json && json.success === false
            ? json.error?.message ?? "Sync failed"
            : "Sync failed";
        toast.error(msg);
        return;
      }
      setStreamSyncResult(json.data.synced);
      toast.success(`Synced ${json.data.synced} users to Stream.`);
    } catch {
      toast.error("Sync failed");
    } finally {
      setStreamSyncBusy(false);
    }
  }, []);

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

  useEffect(() => {
    const groups = groupByDepartment(employees);
    setDeptOpen((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (next[g.dept] === undefined) next[g.dept] = true;
      }
      return next;
    });
  }, [employees]);

  const patchEmployee = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/team-management/employees/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; employee?: TeamManagementEmployee };
      if (!res.ok) {
        toast.error(json.error ?? "Update failed");
        return null;
      }
      if (json.employee) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === id ? { ...json.employee!, deliverables: e.deliverables, profile: e.profile } : e,
          ),
        );
        return json.employee;
      }
      return null;
    },
    [],
  );

  const fetchNotes = useCallback(async (employeeId: string, offset: number) => {
    const limit = 5;
    const url = `/api/admin/team-management/employees/${employeeId}/notes?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { credentials: "include" });
    const json = (await res.json()) as {
      error?: string;
      notes?: EmployeeAdminNote[];
      total?: number;
    };
    if (!res.ok) {
      toast.error(json.error ?? "Could not load notes");
      return;
    }
    const incoming = json.notes ?? [];
    setNotesState((prev) => {
      const prior = prev[employeeId];
      const mergedItems = offset === 0 ? incoming : [...(prior?.items ?? []), ...incoming];
      return {
        ...prev,
        [employeeId]: {
          items: mergedItems,
          total: json.total ?? mergedItems.length,
          loaded: true,
        },
      };
    });
  }, []);

  const toggleWeek = (key: string) => {
    setOpenWeek((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const patchDeliverable = async (
    id: string,
    patch: {
      is_complete?: boolean;
      notes?: string | null;
      status?: string;
      admin_note?: string | null;
    },
  ) => {
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
    const rate = showCompensation ? Number.parseFloat(addForm.rate_amount) : 0;
    if (showCompensation) {
      if (!Number.isFinite(rate) || rate < 0) {
        toast.error("Enter a valid rate / salary (0 or greater).");
        return;
      }
    }
    let equity = 0;
    if (showCompensation && addForm.equity_pct.trim()) {
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
          currency: showCompensation ? addForm.currency : "USD",
          rate_period: showCompensation ? addForm.rate_period : "Monthly",
          start_date: addForm.start_date,
          hr_notes: addForm.hr_notes.trim() || null,
          equity_pct: showCompensation ? equity : 0,
          work_email: addForm.work_email.trim() || null,
          personal_email: addForm.personal_email.trim() || null,
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
      is_complete: deliverableApproved(d),
      status: d.status,
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

  const openEmailPanel = (emp: TeamManagementEmployee) => {
    const latest = employees.find((e) => e.id === emp.id) ?? emp;
    const displayName = latest.name.trim() || latest.profile?.full_name?.trim() || "Employee";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    setEmailEmp(latest);
    setEmailTo((latest.personal_email ?? "").trim());
    setEmailCc((latest.work_email ?? "").trim());
    setEmailSubject(`BahayGo ${displayName} Progress Update ${today}`);
    setEmailTone("Encouraging");
    setEmailHtml(buildProgressEmailHtml(latest, "Encouraging", displayName));
  };

  const sendEmployeeEmail = async () => {
    if (!emailEmp) return;
    const empId = emailEmp.id;
    setEmailBusy(true);
    try {
      const res = await fetch("/api/admin/send-employee-update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: empId,
          to: emailTo,
          cc: emailCc,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Send failed");
        return;
      }
      toast.success("Update sent.");
      setEmailEmp(null);
      await fetchNotes(empId, 0);
    } finally {
      setEmailBusy(false);
    }
  };

  const saveEditEmployee = async () => {
    if (!editEmp) return;
    const name = editForm.name.trim();
    const role = editForm.role.trim();
    if (!name || !role) {
      toast.error("Name and role are required.");
      return;
    }
    let rate = 0;
    let equity = 0;
    let vy = Number(editEmp.equity_vesting_years ?? 4);
    let cm = Number(editEmp.equity_cliff_months ?? 12);
    if (showCompensation) {
      rate = Number.parseFloat(editForm.rate_amount);
      if (!Number.isFinite(rate) || rate < 0) {
        toast.error("Enter a valid rate.");
        return;
      }
      if (editForm.equity_pct.trim()) {
        const e = Number.parseFloat(editForm.equity_pct);
        if (!Number.isFinite(e) || e < 0) {
          toast.error("Invalid equity %.");
          return;
        }
        equity = e;
      }
      vy = Number.parseFloat(editForm.equity_vesting_years);
      cm = Number.parseInt(editForm.equity_cliff_months, 10);
      if (!Number.isFinite(vy) || vy <= 0 || vy > 20 || !Number.isInteger(cm) || cm < 0 || cm > 48) {
        toast.error("Invalid vesting schedule.");
        return;
      }
    } else {
      rate = Number(editEmp.rate_amount ?? 0);
      equity = Number(editEmp.equity_pct ?? 0);
      vy = Number(editEmp.equity_vesting_years ?? 4);
      cm = Number(editEmp.equity_cliff_months ?? 12);
    }
    setEditSaving(true);
    try {
      const ok = await patchEmployee(editEmp.id, {
        name,
        role,
        department: editForm.department,
        employment_type: editForm.employment_type,
        rate_amount: rate,
        currency: showCompensation ? editForm.currency : editEmp.currency ?? "USD",
        rate_period: showCompensation ? editForm.rate_period : editEmp.rate_period ?? "Monthly",
        start_date: editForm.start_date || null,
        end_date: editForm.end_date.trim() || null,
        employment_status: editForm.employment_status,
        work_email: editForm.work_email.trim() || null,
        personal_email: editForm.personal_email.trim() || null,
        hr_notes: editForm.hr_notes.trim() || null,
        equity_pct: equity,
        equity_vesting_years: vy,
        equity_cliff_months: cm,
      });
      if (ok) {
        toast.success("Employee updated.");
        setEditEmp(null);
        setEditForm(emptyEditForm());
      }
    } finally {
      setEditSaving(false);
    }
  };

  const confirmTerminate = async () => {
    if (!terminateEmp) return;
    setTerminateBusy(true);
    try {
      const ok = await patchEmployee(terminateEmp.id, { employment_status: "Terminated" });
      if (ok) {
        toast.success("Employee marked as terminated.");
        setTerminateEmp(null);
      }
    } finally {
      setTerminateBusy(false);
    }
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteEmp) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/team-management/employees/${deleteEmp.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Delete failed");
        return;
      }
      toast.success("Employee removed.");
      setDeleteEmp(null);
      setCardExpanded((c) => {
        const n = { ...c };
        delete n[deleteEmp.id];
        return n;
      });
      await load();
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleOnboardingKey = async (emp: TeamManagementEmployee, key: string) => {
    const cur = parseChecklist(emp.onboarding_checklist);
    const next = { ...cur, [key]: !cur[key] };
    await patchEmployee(emp.id, { onboarding_checklist: next });
  };

  const submitInternalNote = async (employeeId: string) => {
    const text = (internalNoteDraft[employeeId] ?? "").trim();
    if (!text) return;
    setInternalNoteBusy(employeeId);
    try {
      const res = await fetch(`/api/admin/team-management/employees/${employeeId}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not add note");
        return;
      }
      setInternalNoteDraft((d) => ({ ...d, [employeeId]: "" }));
      await fetchNotes(employeeId, 0);
      toast.success("Note added.");
    } finally {
      setInternalNoteBusy(null);
    }
  };

  const ensureNotesLoaded = (empId: string) => {
    const st = notesState[empId];
    if (!st?.loaded) void fetchNotes(empId, 0);
  };

  const totalPayrollUsd = showCompensation
    ? employees.reduce((s, e) => s + monthlyUsdEquivalent(e), 0)
    : 0;
  const countTrial = employees.filter((e) => (e.employment_status ?? "Trial") === "Trial").length;
  const countActive = employees.filter((e) => (e.employment_status ?? "") === "Active").length;

  return (
    <div className="space-y-8 bg-[#FAF8F4] font-sans text-[#2C2C2C]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">Team Management</h2>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
            HR records, onboarding plans, and deliverables
            {showCompensation ? " (admin only)." : " (operations admin — compensation hidden)."}
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

      <section className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold tracking-tight text-[#2C2C2C]">Stream Chat Sync</h3>
            <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
              Force-sync Supabase names and avatars to Stream Chat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={streamBackfillBusy}
              onClick={backfillStreamChannelMetadata}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm ring-1 ${
                streamBackfillBusy
                  ? "cursor-not-allowed bg-[#6B9E6E]/60 ring-[#6B9E6E]/25"
                  : "bg-[#6B9E6E] ring-[#D4A843]/30 hover:bg-[#5d8a60]"
              }`}
            >
              {streamBackfillBusy ? (
                <>
                  <Clock className="h-4 w-4" aria-hidden />
                  Backfilling…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Backfill channel property metadata
                </>
              )}
            </button>
            <button
              type="button"
              disabled={streamSyncBusy}
              onClick={syncAllUsersToStream}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm ring-1 ${
                streamSyncBusy
                  ? "cursor-not-allowed bg-[#6B9E6E]/60 ring-[#6B9E6E]/25"
                  : "bg-[#6B9E6E] ring-[#D4A843]/30 hover:bg-[#5d8a60]"
              }`}
            >
              {streamSyncBusy ? (
                <>
                  <Clock className="h-4 w-4" aria-hidden />
                  Syncing…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Sync all users to Stream Chat
                </>
              )}
            </button>
          </div>
        </div>
        {streamBackfillResult != null ? (
          <p className="mt-2 text-sm font-semibold text-[#2C5F32]">Patched {streamBackfillResult} channels.</p>
        ) : null}
        {streamSyncResult != null ? (
          <p className="mt-3 text-sm font-semibold text-[#2C5F32]">Synced {streamSyncResult} users.</p>
        ) : null}
      </section>

      {loading ? (
        <p className="text-sm font-semibold text-[#2C2C2C]/55">Loading team…</p>
      ) : employees.length === 0 ? (
        <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-8 text-center text-sm font-semibold text-[#2C2C2C]/55 shadow-sm">
          No internal team members yet. Use Add Employee to create one.
        </p>
      ) : (
        <div className="space-y-6">
          <div
            className={`grid gap-3 sm:grid-cols-2 ${showCompensation ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
          >
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Total employees</p>
              <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{employees.length}</p>
            </div>
            <div className="rounded-2xl border border-[#D4A843]/35 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a6d32]">On trial</p>
              <p className="mt-1 font-serif text-2xl font-bold text-[#8a6d32]">{countTrial}</p>
            </div>
            <div className="rounded-2xl border border-[#6B9E6E]/35 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C5F32]">Active</p>
              <p className="mt-1 font-serif text-2xl font-bold text-[#6B9E6E]">{countActive}</p>
            </div>
            {showCompensation ? (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Monthly payroll (est. USD)
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{formatUsd(totalPayrollUsd)}</p>
              </div>
            ) : null}
          </div>

          {groupByDepartment(employees).map(({ dept, members }) => {
            const deptKey = dept;
            const deptExpanded = deptOpen[deptKey] ?? true;
            return (
              <section
                key={deptKey}
                className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-[0_1px_3px_rgba(44,44,44,0.06)]"
              >
                <button
                  type="button"
                  onClick={() => setDeptOpen((d) => ({ ...d, [deptKey]: !deptExpanded }))}
                  className="flex w-full items-center justify-between gap-3 border-b border-[#2C2C2C]/08 bg-[#FAF8F4] px-4 py-3 text-left hover:bg-[#f4f1ea]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg font-bold tracking-tight text-[#2C2C2C]">{deptKey}</h3>
                    <span className="rounded-full bg-[#6B9E6E]/15 px-2.5 py-0.5 text-xs font-bold text-[#2C5F32] ring-1 ring-[#6B9E6E]/25">
                      {members.length}
                    </span>
                  </div>
                  <motion.span animate={{ rotate: deptExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#2C2C2C]/55" aria-hidden />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {deptExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 bg-[#FAF8F4]/40 p-3 sm:p-4">
                        {members.map((emp) => {
            const displayName = emp.name.trim() || emp.profile?.full_name?.trim() || "Employee";
            const avatarUrl = emp.profile?.avatar_url?.trim() || null;
            const tenureDays = daysSinceStart(emp.start_date, emp.created_at);
            const total = emp.deliverables.length;
            const done = emp.deliverables.filter((d) => deliverableApproved(d)).length;
            const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
            const status = emp.employment_status ?? "Trial";
            const equity = Number(emp.equity_pct ?? 0);
            const expanded = !!cardExpanded[emp.id];
            const locked = status === "Terminated";
            const checklist = parseChecklist(emp.onboarding_checklist);
            const vestPct = vestingProgressPct(emp);
            const nState = notesState[emp.id];

            return (
              <article
                key={emp.id}
                className="relative overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-[0_1px_3px_rgba(44,44,44,0.06)]"
              >
                {!expanded ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCardExpanded((c) => {
                        const next = { ...c, [emp.id]: true };
                        return next;
                      });
                      ensureNotesLoaded(emp.id);
                    }}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-[#FAF8F4]/80"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="" fill className="object-cover" sizes="56px" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/12 font-serif text-lg font-semibold text-[#6B9E6E]">
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-xl font-semibold tracking-tight text-[#2C2C2C]">{displayName}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-[#2C2C2C] ring-1 ring-[#2C2C2C]/12">
                          {emp.role}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${workStatusBadgeClass(status)}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Plan</p>
                      <p className="font-serif text-xl font-bold text-[#6B9E6E]">{completionPct}%</p>
                    </div>
                  </button>
                ) : (
                  <>
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
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const v = e.target.value;
                                void patchEmployee(emp.id, { employment_status: v });
                              }}
                              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 focus:outline-none focus:ring-2 focus:ring-[#6B9E6E] ${workStatusBadgeClass(status)}`}
                            >
                              {HR_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardExpanded((c) => ({ ...c, [emp.id]: false }));
                              }}
                              className="rounded-lg border border-[#2C2C2C]/12 bg-white px-2 py-1 text-xs font-bold text-[#2C2C2C] hover:border-[#6B9E6E]/40"
                            >
                              Collapse
                            </button>
                          </div>
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
                        <div
                          className={`mt-4 grid gap-3 text-sm sm:grid-cols-2 ${showCompensation ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
                        >
                          <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                              Employment
                            </p>
                            <p className="mt-0.5 font-semibold text-[#2C2C2C]">{emp.employment_type ?? "—"}</p>
                          </div>
                          {showCompensation ? (
                            <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                                Compensation
                              </p>
                              <p className="mt-0.5 font-semibold tabular-nums text-[#2C2C2C]">
                                {formatCompensation(emp)}
                              </p>
                            </div>
                          ) : null}
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
                            <p className="mt-0.5 font-semibold text-[#2C2C2C]">{formatTenureHuman(emp.start_date, emp.created_at)}</p>
                            <p className="mt-0.5 text-xs font-medium text-[#2C2C2C]/55">
                              {tenureDays} day{tenureDays === 1 ? "" : "s"} since start
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Work email</p>
                            <p className="mt-0.5 font-semibold text-[#2C2C2C]">{emp.work_email?.trim() || "—"}</p>
                          </div>
                          <div className="rounded-lg border border-[#2C2C2C]/08 bg-white/80 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Personal email</p>
                            <p className="mt-0.5 font-semibold text-[#2C2C2C]">{emp.personal_email?.trim() || "—"}</p>
                          </div>
                        </div>
                        {showCompensation && equity > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-[#8a6d32]">
                              Equity: <span className="tabular-nums">{equity}%</span>
                            </p>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#2C2C2C]/10">
                              <div
                                className="h-full rounded-full bg-[#D4A843]"
                                style={{ width: `${vestPct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] font-semibold text-[#2C2C2C]/45">
                              Vesting progress (after cliff): {Math.round(vestPct)}%
                            </p>
                          </div>
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

                <div className="flex flex-wrap gap-2 border-b border-[#2C2C2C]/08 bg-white px-4 py-3 sm:px-7">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditEmp(emp);
                      setEditForm(editFormFromEmployee(emp));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4] px-3 py-2 text-xs font-bold text-[#2C2C2C] hover:border-[#6B9E6E]/40"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                  {!locked ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTerminateEmp(emp);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                    >
                      <UserX className="h-3.5 w-3.5" aria-hidden />
                      Terminate
                    </button>
                  ) : null}
                  {!locked ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEmailPanel(emp);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2 text-xs font-bold text-[#2C2C2C] hover:border-[#6B9E6E]/40"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      Send update
                    </button>
                  ) : null}
                  {locked ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteEmp(emp);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete permanently
                    </button>
                  ) : null}
                </div>

                <div className="border-b border-[#2C2C2C]/08 bg-white px-3 py-2 sm:px-5">
                  <button
                    type="button"
                    onClick={() =>
                      setOnboardingOpen((o) => ({ ...o, [emp.id]: !o[emp.id] }))
                    }
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left hover:bg-[#FAF8F4]"
                  >
                    <span className="font-serif text-sm font-bold text-[#2C2C2C]">Onboarding checklist</span>
                    <motion.span animate={{ rotate: onboardingOpen[emp.id] ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4 text-[#2C2C2C]/55" aria-hidden />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {onboardingOpen[emp.id] ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <ul className="grid gap-2 pb-3 sm:grid-cols-2">
                          {ONBOARDING_ITEMS.map(({ key, label }) => (
                            <li key={key} className="flex items-center gap-2 rounded-lg border border-[#2C2C2C]/08 bg-[#FAF8F4]/50 px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!!checklist[key]}
                                onChange={() => void toggleOnboardingKey(emp, key)}
                                className="h-4 w-4 rounded border-[#2C2C2C]/25 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                              />
                              <span className="text-sm font-semibold text-[#2C2C2C]">{label}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

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
                                  const st = (d.status as string) || (d.is_complete ? "approved" : "not_started");
                                  const awaiting = st === "submitted" || st === "pending_review";
                                  const approved = deliverableApproved(d);
                                  return (
                                    <li
                                      key={d.id}
                                      className="rounded-xl border border-[#2C2C2C]/08 bg-[#FAF8F4]/60 px-3 py-2.5"
                                    >
                                      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                                        <input
                                          type="checkbox"
                                          checked={approved}
                                          disabled={locked || awaiting}
                                          onChange={(e) =>
                                            void patchDeliverable(d.id, { is_complete: e.target.checked })
                                          }
                                          className="mt-1 h-4 w-4 shrink-0 rounded border-[#2C2C2C]/25 text-[#6B9E6E] focus:ring-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-40"
                                          aria-label="Approved"
                                        />
                                        <p
                                          className={`min-w-0 flex-1 text-sm font-semibold leading-snug ${
                                            approved ? "text-[#2C2C2C]/45 line-through" : "text-[#2C2C2C]"
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
                                        <span
                                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                            awaiting
                                              ? "bg-[#fef08a] text-[#713f12] ring-1 ring-[#D4A843]/40"
                                              : st === "approved"
                                                ? "bg-[#6B9E6E]/18 text-[#2C5F32] ring-1 ring-[#6B9E6E]/35"
                                                : st === "changes_requested"
                                                  ? "bg-orange-100 text-orange-900 ring-1 ring-orange-200"
                                                  : "bg-[#2C2C2C]/08 text-[#2C2C2C]/60 ring-1 ring-[#2C2C2C]/10"
                                          }`}
                                        >
                                          {adminDeliverableStatusLabel(st)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (openNotesId === d.id) {
                                              setOpenNotesId(null);
                                              return;
                                            }
                                            setOpenNotesId(d.id);
                                            setNoteDrafts((prev) => {
                                              if (prev[d.id] !== undefined) return prev;
                                              const saved = (d.notes ?? "").trim();
                                              if (saved) return { ...prev, [d.id]: d.notes ?? "" };
                                              const template = getDefaultDeliverableTaskNotes(d.deliverable_text);
                                              return { ...prev, [d.id]: template ?? "" };
                                            });
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
                                      {awaiting && !locked ? (
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => void patchDeliverable(d.id, { status: "approved" })}
                                            className="rounded-lg bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5d8a60]"
                                          >
                                            Approve
                                          </button>
                                          {requestChangesFor === d.id ? (
                                            <>
                                              <input
                                                value={requestChangesDraft[d.id] ?? ""}
                                                onChange={(e) =>
                                                  setRequestChangesDraft((prev) => ({
                                                    ...prev,
                                                    [d.id]: e.target.value,
                                                  }))
                                                }
                                                placeholder="Feedback for the team member…"
                                                className="min-w-[160px] flex-1 rounded-lg border border-[#2C2C2C]/12 bg-white px-2 py-1.5 text-xs font-medium text-[#2C2C2C]"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const t = (requestChangesDraft[d.id] ?? "").trim();
                                                  if (!t) {
                                                    toast.error("Enter feedback before sending.");
                                                    return;
                                                  }
                                                  void patchDeliverable(d.id, {
                                                    status: "changes_requested",
                                                    admin_note: t,
                                                  });
                                                  setRequestChangesFor(null);
                                                }}
                                                className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
                                              >
                                                Send
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setRequestChangesFor(null)}
                                                className="text-xs font-bold text-[#2C2C2C]/55 underline"
                                              >
                                                Cancel
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setRequestChangesFor(d.id);
                                                setRequestChangesDraft((prev) => ({
                                                  ...prev,
                                                  [d.id]: prev[d.id] ?? "",
                                                }));
                                              }}
                                              className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-900 hover:bg-orange-100"
                                            >
                                              Request changes
                                            </button>
                                          )}
                                        </div>
                                      ) : null}
                                      {st === "changes_requested" && d.admin_note?.trim() ? (
                                        <p className="mt-2 text-xs font-semibold text-orange-800">
                                          <span className="font-bold text-orange-900">Latest feedback: </span>
                                          {d.admin_note.trim()}
                                        </p>
                                      ) : null}
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
                                              disabled={locked}
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
                                              className="mt-2 w-full resize-y rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-40"
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
                                  disabled={locked}
                                  onClick={() => void addDeliverableRow(emp.id, week)}
                                  className="text-xs font-bold text-[#6B9E6E] underline decoration-[#6B9E6E]/40 hover:text-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
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

                <div className="border-t border-[#2C2C2C]/08 bg-white px-4 py-4 sm:px-7">
                  <h4 className="font-serif text-sm font-bold text-[#2C2C2C]">Internal notes</h4>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
                    {(nState?.items ?? []).map((n) => (
                      <li key={n.id} className="rounded-lg border border-[#2C2C2C]/08 bg-[#FAF8F4]/50 px-3 py-2">
                        <p className="text-xs font-bold text-[#2C2C2C]/45">
                          {new Date(n.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          · {n.author_name?.trim() || "Admin"}
                        </p>
                        <p className="mt-1 font-medium text-[#2C2C2C]">{n.note}</p>
                      </li>
                    ))}
                  </ul>
                  {(nState?.total ?? 0) > (nState?.items.length ?? 0) ? (
                    <button
                      type="button"
                      onClick={() => void fetchNotes(emp.id, nState?.items.length ?? 0)}
                      className="mt-2 text-xs font-bold text-[#6B9E6E] underline decoration-[#6B9E6E]/40"
                    >
                      Show more
                    </button>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={internalNoteDraft[emp.id] ?? ""}
                      onChange={(e) =>
                        setInternalNoteDraft((d) => ({ ...d, [emp.id]: e.target.value }))
                      }
                      placeholder="Add an admin note…"
                      className="min-w-[200px] flex-1 rounded-lg border border-[#2C2C2C]/12 px-3 py-2 text-sm font-medium text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                    />
                    <button
                      type="button"
                      disabled={internalNoteBusy === emp.id}
                      onClick={() => void submitInternalNote(emp.id)}
                      className="rounded-lg bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
                    >
                      {internalNoteBusy === emp.id ? "Saving…" : "Add note"}
                    </button>
                  </div>
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

                <AnimatePresence>
                  {emailEmp?.id === emp.id ? (
                    <motion.div
                      key="email-panel"
                      initial={{ x: "100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "100%" }}
                      transition={{ type: "tween", duration: 0.28 }}
                      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-[#2C2C2C]/12 bg-white shadow-2xl"
                    >
                      <div className="flex items-center justify-between border-b border-[#2C2C2C]/08 px-4 py-3">
                        <p className="font-serif text-sm font-bold text-[#2C2C2C]">Send progress update</p>
                        <button
                          type="button"
                          onClick={() => setEmailEmp(null)}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-[#2C2C2C]/60 hover:bg-[#FAF8F4]"
                        >
                          Close
                        </button>
                      </div>
                      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                        <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                          To
                          <input
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 px-3 py-2 font-medium text-[#2C2C2C]"
                          />
                        </label>
                        <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                          CC
                          <input
                            value={emailCc}
                            onChange={(e) => setEmailCc(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 px-3 py-2 font-medium text-[#2C2C2C]"
                          />
                        </label>
                        <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                          Subject
                          <input
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 px-3 py-2 font-medium text-[#2C2C2C]"
                          />
                        </label>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Tone</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {EMAIL_TONES.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setEmailTone(t);
                                  const latest = employees.find((e) => e.id === emp.id) ?? emp;
                                  const dn =
                                    latest.name.trim() || latest.profile?.full_name?.trim() || "Employee";
                                  setEmailHtml(buildProgressEmailHtml(latest, t, dn));
                                }}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                  emailTone === t
                                    ? "bg-[#6B9E6E] text-white"
                                    : "border border-[#2C2C2C]/12 bg-white text-[#2C2C2C]"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                          Message (HTML)
                          <textarea
                            value={emailHtml}
                            onChange={(e) => setEmailHtml(e.target.value)}
                            rows={10}
                            className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4]/40 px-3 py-2 font-mono text-xs font-medium text-[#2C2C2C]"
                          />
                        </label>
                        <p className="text-xs font-bold text-[#2C2C2C]/45">
                          Done items appear in green and pending in gray in the sent email.
                        </p>
                        <button
                          type="button"
                          disabled={emailBusy}
                          onClick={() => void sendEmployeeEmail()}
                          className="w-full rounded-lg bg-[#6B9E6E] py-2.5 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
                        >
                          {emailBusy ? "Sending…" : "Send email"}
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                  </>
                )}
              </article>
            );
                        })}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
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
              {showCompensation ? (
                <>
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
                        setAddForm((f) => ({
                          ...f,
                          rate_period: e.target.value as (typeof HR_RATE_PERIODS)[number],
                        }))
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
                </>
              ) : null}
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Start date
                <input
                  type="date"
                  value={addForm.start_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              {showCompensation ? (
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
              ) : null}
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Work email <span className="font-normal normal-case text-[#2C2C2C]/45">(optional)</span>
                <input
                  type="email"
                  value={addForm.work_email}
                  onChange={(e) => setAddForm((f) => ({ ...f, work_email: e.target.value }))}
                  placeholder="name@bahaygo.com"
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Personal email <span className="font-normal normal-case text-[#2C2C2C]/45">(optional)</span>
                <input
                  type="email"
                  value={addForm.personal_email}
                  onChange={(e) => setAddForm((f) => ({ ...f, personal_email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
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

      {editEmp ? (
        <div className="fixed inset-0 z-[225] flex items-center justify-center bg-black/45 p-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl sm:p-8"
          >
            <h3 className="font-serif text-xl font-bold text-[#2C2C2C]">Edit employee</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Full name
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4]/40 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Role
                <input
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4]/40 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Department
                <select
                  value={editForm.department}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, department: e.target.value as EditFormState["department"] }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
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
                  value={editForm.employment_type}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      employment_type: e.target.value as EditFormState["employment_type"],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                >
                  {HR_EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Status
                <select
                  value={editForm.employment_status}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      employment_status: e.target.value as EditFormState["employment_status"],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                >
                  {HR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                End date <span className="font-normal normal-case text-[#2C2C2C]/45">(optional)</span>
                <input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              {showCompensation ? (
                <>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Rate / salary
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editForm.rate_amount}
                      onChange={(e) => setEditForm((f) => ({ ...f, rate_amount: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold tabular-nums text-[#2C2C2C]"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Currency
                    <select
                      value={editForm.currency}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, currency: e.target.value as EditFormState["currency"] }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
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
                      value={editForm.rate_period}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, rate_period: e.target.value as EditFormState["rate_period"] }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                    >
                      {HR_RATE_PERIODS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Start date
                <input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              {showCompensation ? (
                <>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Equity %
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={editForm.equity_pct}
                      onChange={(e) => setEditForm((f) => ({ ...f, equity_pct: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold tabular-nums text-[#2C2C2C]"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Vesting years
                    <input
                      type="number"
                      step="0.25"
                      value={editForm.equity_vesting_years}
                      onChange={(e) => setEditForm((f) => ({ ...f, equity_vesting_years: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Cliff (months)
                    <input
                      type="number"
                      min={0}
                      value={editForm.equity_cliff_months}
                      onChange={(e) => setEditForm((f) => ({ ...f, equity_cliff_months: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                    />
                  </label>
                </>
              ) : null}
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Work email
                <input
                  type="email"
                  value={editForm.work_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, work_email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Personal email
                <input
                  type="email"
                  value={editForm.personal_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, personal_email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45 sm:col-span-2">
                Notes
                <textarea
                  value={editForm.hr_notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, hr_notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full resize-y rounded-lg border border-[#2C2C2C]/12 bg-[#FAF8F4]/40 px-3 py-2.5 text-sm font-medium text-[#2C2C2C] focus:border-[#6B9E6E] focus:outline-none focus:ring-1 focus:ring-[#6B9E6E]"
                />
              </label>
            </div>
            <div className="mt-8 flex justify-end gap-2 border-t border-[#2C2C2C]/08 pt-5">
              <button
                type="button"
                onClick={() => {
                  setEditEmp(null);
                  setEditForm(emptyEditForm());
                }}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEditEmployee()}
                className="rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}

      {terminateEmp ? (
        <div className="fixed inset-0 z-[226] flex items-center justify-center bg-black/45 p-4">
          <div className="max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl">
            <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">Terminate employee?</h3>
            <p className="mt-2 text-sm font-medium text-[#2C2C2C]/75">
              This will mark the employee as terminated and lock their deliverables. Are you sure?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTerminateEmp(null)}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={terminateBusy}
                onClick={() => void confirmTerminate()}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {terminateBusy ? "Working…" : "Yes, terminate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteEmp ? (
        <div className="fixed inset-0 z-[227] flex items-center justify-center bg-black/45 p-4">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <h3 className="font-serif text-lg font-bold text-red-800">Delete permanently?</h3>
            <p className="mt-2 text-sm font-medium text-[#2C2C2C]/75">
              This permanently deletes this terminated employee record, deliverables, and notes. This cannot be undone.
              Are you sure?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteEmp(null)}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void confirmDeleteEmployee()}
                className="rounded-full bg-red-700 px-5 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Yes, delete forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
