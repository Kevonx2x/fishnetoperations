"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { adminTeamPrintPlanStorageKey } from "@/lib/admin-team-print-plan";
import { isAdminPanelRole } from "@/lib/auth-roles";
import { ONBOARDING_WEEK_TITLES } from "@/lib/emmanuel-onboarding-seed";

type PrintItem = {
  week_number: number;
  deliverable_text: string;
  priority: string;
  is_complete: boolean;
  notes: string | null;
};

type PrintPayload = {
  employeeName: string;
  items: PrintItem[];
};

export default function AdminTeamPrintPage() {
  const { profile, loading } = useAuth();
  const [payload, setPayload] = useState<PrintPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const attemptedLoadRef = useRef(false);
  const canViewPlan = isAdminPanelRole(profile?.role);

  useEffect(() => {
    const footer = document.getElementById("bahaygo-site-footer");
    if (!footer) return;
    const prev = footer.style.display;
    footer.style.display = "none";
    return () => {
      footer.style.display = prev;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || loading || attemptedLoadRef.current) return;
    const printId = new URLSearchParams(window.location.search).get("key")?.trim();
    attemptedLoadRef.current = true;
    if (!canViewPlan) {
      try {
        if (printId) localStorage.removeItem(adminTeamPrintPlanStorageKey(printId));
      } catch {
        // Best-effort cleanup only; unauthorized users still cannot render the payload.
      }
      return;
    }
    let nextPayload: PrintPayload | null = null;
    let nextErr: string | null = null;
    try {
      if (!printId) {
        nextErr = "No plan data. Close this tab and use Download Plan again.";
      } else {
        const storageKey = adminTeamPrintPlanStorageKey(printId);
        const raw = localStorage.getItem(storageKey);
        localStorage.removeItem(storageKey);
        if (!raw) {
          nextErr = "No plan data. Close this tab and use Download Plan again.";
        } else {
          const parsed = JSON.parse(raw) as PrintPayload;
          if (!parsed?.employeeName || !Array.isArray(parsed.items)) {
            nextErr = "Invalid plan data.";
          } else {
            nextPayload = parsed;
          }
        }
      }
    } catch {
      nextErr = "Could not read plan data.";
    }
    window.setTimeout(() => {
      setPayload(nextPayload);
      setErr(nextErr);
    }, 0);
  }, [canViewPlan, loading]);

  useEffect(() => {
    if (loading || err || !payload) return;
    if (!canViewPlan) return;
    document.title = `${payload.employeeName} — 30-day plan`;
    const t = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(t);
  }, [canViewPlan, loading, err, payload]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] px-6 py-10 font-sans text-[#2C2C2C]">
        <p className="text-sm font-semibold">Checking access…</p>
      </div>
    );
  }

  if (!canViewPlan) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] px-6 py-10 font-sans text-[#2C2C2C]">
        <p className="text-sm font-semibold">You do not have access to print team plans.</p>
      </div>
    );
  }

  if (err || !payload) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] px-6 py-10 font-sans text-[#2C2C2C]">
        <p className="text-sm font-semibold">{err ?? "Nothing to print."}</p>
      </div>
    );
  }

  const byWeek = [1, 2, 3, 4].map((w) => ({
    week: w,
    title: ONBOARDING_WEEK_TITLES[w as 1 | 2 | 3 | 4],
    items: payload.items.filter((i) => i.week_number === w),
  }));

  return (
    <div className="min-h-screen bg-[#FAF8F4] px-8 pb-16 pt-8 text-[#2C2C2C] print:px-6 print:py-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <p className="no-print mb-6 text-sm text-[#2C2C2C]/70">
        Use your browser&apos;s print dialog (Ctrl/Cmd+P) and choose &quot;Save as PDF&quot;.
      </p>
      <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">{payload.employeeName}</h1>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/60">30-day onboarding deliverables — BahayGo</p>
      {byWeek.map(({ week, title, items }) => (
        <section key={week} className="mt-8">
          <h2 className="border-b-2 border-[#D4A843] pb-1 font-serif text-xl font-bold text-[#2C2C2C]">{title}</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-[#2C2C2C]/55">No items.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[#2C2C2C]/10">
              {items.map((it, idx) => (
                <li
                  key={`${week}-${idx}`}
                  className={`py-3 text-sm leading-relaxed ${it.is_complete ? "text-[#2C2C2C]/50 line-through" : ""}`}
                >
                  <span
                    className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      it.priority === "Critical"
                        ? "bg-red-200 text-red-900"
                        : it.priority === "High"
                          ? "bg-[#fef08a] text-[#713f12]"
                          : "bg-[#bbf7d0] text-green-900"
                    }`}
                  >
                    {it.priority}
                  </span>
                  {it.deliverable_text}
                  {it.notes?.trim() ? (
                    <div className="mt-1 pl-1 text-xs italic text-[#2C2C2C]/55">Notes: {it.notes}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
