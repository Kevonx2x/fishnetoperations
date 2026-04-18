"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EMMANUEL_UNLOCK_REWARDS, ONBOARDING_WEEK_TITLES } from "@/lib/emmanuel-onboarding-seed";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DeliverableStatus =
  | "not_started"
  | "submitted"
  | "pending_review"
  | "approved"
  | "changes_requested";

type DeliverableRow = {
  id: string;
  week_number: number;
  deliverable_text: string;
  priority: string;
  status: DeliverableStatus | string;
  admin_note: string | null;
};

type TeamMemberRow = {
  id: string;
  name: string;
  role: string;
  department: string | null;
};

function priorityClass(p: string): string {
  if (p === "Critical") return "bg-red-200 text-red-900 ring-1 ring-red-300/60";
  if (p === "High") return "bg-[#fef08a] text-[#713f12] ring-1 ring-[#D4A843]/40";
  return "bg-[#bbf7d0] text-green-900 ring-1 ring-[#6B9E6E]/35";
}

function statusUi(st: string) {
  if (st === "not_started")
    return {
      label: "Not started",
      cls: "bg-[#2C2C2C]/10 text-[#2C2C2C]/70 ring-1 ring-[#2C2C2C]/15",
      icon: null as "clock" | "eye" | "check" | "alert" | null,
    };
  if (st === "submitted")
    return {
      label: "Submitted",
      cls: "bg-[#fef08a] text-[#713f12] ring-1 ring-[#D4A843]/45",
      icon: "clock" as const,
    };
  if (st === "pending_review")
    return {
      label: "Pending review",
      cls: "bg-[#fef08a] text-[#713f12] ring-1 ring-[#D4A843]/45",
      icon: "eye" as const,
    };
  if (st === "approved")
    return {
      label: "Approved",
      cls: "bg-[#6B9E6E]/18 text-[#2C5F32] ring-1 ring-[#6B9E6E]/40",
      icon: "check" as const,
    };
  if (st === "changes_requested")
    return {
      label: "Changes requested",
      cls: "bg-orange-100 text-orange-900 ring-1 ring-orange-200",
      icon: "alert" as const,
    };
  return {
    label: st,
    cls: "bg-[#2C2C2C]/08 text-[#2C2C2C]/60 ring-1 ring-[#2C2C2C]/10",
    icon: null as "clock" | "eye" | "check" | "alert" | null,
  };
}

function firstName(full: string): string {
  const t = full.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="-rotate-90 transform" width="160" height="160" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#2C2C2C14" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#6B9E6E"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl font-bold text-[#2C2C2C]">{pct}%</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Approved</span>
      </div>
    </div>
  );
}

export default function MyPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [member, setMember] = useState<TeamMemberRow | null>(null);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [openWeek, setOpenWeek] = useState<Record<number, boolean>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      const sb = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user?.id) {
        router.replace("/");
        return;
      }
      const { data: tm, error: tmErr } = await sb
        .from("team_members")
        .select("id, name, role, department")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (tmErr) {
        toast.error(tmErr.message);
        setLoadError(tmErr.message);
        setMember(null);
        setDeliverables([]);
        setLoading(false);
        return;
      }
      if (!tm) {
        setMember(null);
        setDeliverables([]);
        setLoading(false);
        return;
      }

      setMember(tm as TeamMemberRow);
      const { data: rows, error: dErr } = await sb
        .from("employee_deliverables")
        .select("id, week_number, deliverable_text, priority, status, admin_note")
        .eq("employee_id", tm.id)
        .order("week_number", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (dErr) {
        toast.error(dErr.message);
        setLoadError(dErr.message);
        setDeliverables([]);
      } else {
        setDeliverables((rows ?? []) as DeliverableRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const stats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let notStarted = 0;
    for (const d of deliverables) {
      const raw = d.status;
      const s =
        typeof raw === "string" && raw.length > 0
          ? raw
          : "not_started";
      if (s === "approved") approved += 1;
      else if (s === "submitted" || s === "pending_review") pending += 1;
      else notStarted += 1;
    }
    const total = deliverables.length;
    const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { approved, pending, notStarted, total, pct };
  }, [deliverables]);

  const displayName = member?.name?.trim() || "there";
  const isEmmanuel = /emmanuel/i.test(member?.name ?? "");

  const submitDeliverable = async (id: string) => {
    setSubmittingId(id);
    try {
      const res = await fetch("/api/my-plan/submit-deliverable", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverable_id: id }),
      });
      const json = (await res.json()) as { error?: string; deliverable?: DeliverableRow };
      if (!res.ok) {
        toast.error(json.error ?? "Could not submit");
        return;
      }
      if (json.deliverable) {
        setDeliverables((prev) => prev.map((d) => (d.id === id ? { ...d, ...json.deliverable! } : d)));
      }
      toast.success("Submitted for review.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#FAF8F4] font-sans text-[#2C2C2C]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" aria-hidden />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] px-4 py-16 font-sans text-[#2C2C2C] sm:px-8">
        <div className="mx-auto max-w-lg text-center">
          <p className="font-serif text-2xl font-bold text-[#2C2C2C]">
            {loadError ? "We could not load your plan." : "You do not have an active plan."}
          </p>
          {loadError ? (
            <p className="mt-2 text-sm font-medium text-[#2C2C2C]/60">{loadError}</p>
          ) : null}
          <p className="mt-8 text-center text-sm font-semibold">
            <Link href="/" className="text-[#6B9E6E] underline decoration-[#6B9E6E]/40">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] px-4 py-10 font-sans text-[#2C2C2C] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="text-center sm:text-left">
          <p className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] sm:text-4xl">
            {greeting()}, {firstName(displayName)}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#2C2C2C] ring-1 ring-[#2C2C2C]/12">
              {member.role}
            </span>
            {member.department ? (
              <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-bold text-[#2C5F32] ring-1 ring-[#6B9E6E]/30">
                {member.department}
              </span>
            ) : null}
          </div>
        </header>

        <div className="mt-10 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
          <ProgressRing pct={stats.pct} />
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/08 px-2 py-3">
              <p className="text-2xl font-bold text-[#2C5F32]">{stats.approved}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#2C2C2C]/50">Approved</p>
            </div>
            <div className="rounded-xl border border-[#D4A843]/35 bg-[#fefce8] px-2 py-3">
              <p className="text-2xl font-bold text-[#8a6d32]">{stats.pending}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a6d32]/90">Pending review</p>
            </div>
            <div className="rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-2 py-3">
              <p className="text-2xl font-bold text-[#2C2C2C]/55">{stats.notStarted}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">Not started</p>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-3">
          {([1, 2, 3, 4] as const).map((week) => {
            const open = !!openWeek[week];
            const title = ONBOARDING_WEEK_TITLES[week];
            const rows = deliverables.filter((d) => d.week_number === week);
            return (
              <div key={week} className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenWeek((w) => ({ ...w, [week]: !open }))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-[#FAF8F4]/80"
                >
                  <span className="font-serif text-lg font-bold text-[#2C2C2C]">{title}</span>
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
                      transition={{ duration: 0.24 }}
                      className="overflow-hidden border-t border-[#2C2C2C]/08"
                    >
                      <ul className="space-y-3 px-4 pb-4 pt-2">
                        {rows.map((d) => {
                          const st =
                            typeof d.status === "string" && d.status.length > 0 ? d.status : "not_started";
                          const su = statusUi(st);
                          const canSubmit = st === "not_started" || st === "changes_requested";
                          return (
                            <li
                              key={d.id}
                              className="rounded-xl border border-[#2C2C2C]/08 bg-[#FAF8F4]/50 px-3 py-3 sm:px-4"
                            >
                              <div className="flex flex-wrap items-start gap-2">
                                <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[#2C2C2C]">
                                  {d.deliverable_text}
                                </p>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityClass(
                                    d.priority,
                                  )}`}
                                >
                                  {d.priority}
                                </span>
                                <span
                                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${su.cls}`}
                                >
                                  {su.icon === "clock" ? <Clock className="h-3 w-3" aria-hidden /> : null}
                                  {su.icon === "eye" ? <Eye className="h-3 w-3" aria-hidden /> : null}
                                  {su.icon === "check" ? <Check className="h-3 w-3" aria-hidden /> : null}
                                  {su.icon === "alert" ? <AlertCircle className="h-3 w-3" aria-hidden /> : null}
                                  {su.label}
                                </span>
                              </div>
                              {st === "changes_requested" && d.admin_note?.trim() ? (
                                <p className="mt-2 text-sm font-medium text-orange-700">{d.admin_note.trim()}</p>
                              ) : null}
                              {canSubmit ? (
                                <button
                                  type="button"
                                  disabled={submittingId === d.id}
                                  onClick={() => void submitDeliverable(d.id)}
                                  className="mt-3 rounded-lg bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
                                >
                                  {submittingId === d.id ? "Submitting…" : "Mark as done"}
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <section className="mt-12 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">What you unlock</h2>
          {isEmmanuel ? (
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm font-semibold text-[#2C2C2C]/85">
              {EMMANUEL_UNLOCK_REWARDS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/55">
              Your rewards will be confirmed with leadership as you complete this plan.
            </p>
          )}
        </section>

        <p className="mt-8 text-center text-xs font-semibold text-[#2C2C2C]/45">
          <Link href="/" className="text-[#6B9E6E] underline decoration-[#6B9E6E]/40">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
