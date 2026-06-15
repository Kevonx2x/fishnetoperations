"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, RefreshCw, Wallet } from "lucide-react";
import { formatTreasuryPeso } from "@/lib/admin-personal-treasury";
import { cn } from "@/lib/utils";

type TreasuryPayload = {
  accountLabel: string;
  accountNumberMasked: string;
  holderName: string;
  currency: string;
  grossBalance: number;
  totalMonthlyExpenses: number;
  availableBalance: number;
  expenses: { id: string; label: string; amount: number; source: string }[];
};

type Props = {
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function PersonalBankAccountView({
  backHref = "/more",
  backLabel = "Back",
  className,
}: Props) {
  const [data, setData] = useState<TreasuryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/personal-account", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: TreasuryPayload;
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error?.message ?? "Could not load account");
      }
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div
      className={cn(
        "flex min-h-[100dvh] flex-col bg-[#f2f4f8] font-sans text-[#1a1a1a]",
        className,
      )}
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a2744] via-[#243352] to-[#2d4a3e] px-5 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {backLabel}
          </Link>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm disabled:opacity-50"
            aria-label="Refresh account"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {data?.accountLabel ?? "Personal account"}
            </p>
            <p className="mt-1 font-serif text-lg font-semibold">{data?.holderName ?? "—"}</p>
            <p className="mt-0.5 text-xs text-white/50">{data?.accountNumberMasked ?? "•••• ••••"}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 backdrop-blur-sm">
            <Wallet className="h-5 w-5 text-white/90" strokeWidth={1.75} />
          </div>
        </div>

        {loading ? (
          <div className="mt-8 h-12 w-48 animate-pulse rounded-lg bg-white/10" />
        ) : error ? (
          <p className="mt-8 text-sm text-red-200">{error}</p>
        ) : data ? (
          <>
            <p className="mt-8 text-xs font-medium text-white/55">Available balance</p>
            <p className="mt-1 font-serif text-[2rem] font-bold leading-none tracking-tight">
              {formatTreasuryPeso(data.availableBalance)}
            </p>
            <p className="mt-3 text-xs text-white/45">
              Gross treasury {formatTreasuryPeso(data.grossBalance)} · after monthly expenses
            </p>
          </>
        ) : null}
      </div>

      <div className="-mt-4 flex min-h-0 flex-1 flex-col rounded-t-[1.75rem] bg-[#f2f4f8] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1a1a1a]">Monthly expenses</h2>
            <p className="text-xs text-[#888888]">{monthLabel}</p>
          </div>
          {data ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
              −{formatTreasuryPeso(data.totalMonthlyExpenses)}
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-black/[0.05] bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-black/[0.04]" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-[#888888]">
              <button
                type="button"
                onClick={() => void load()}
                className="font-semibold text-[#2d4a3e] underline"
              >
                Try again
              </button>
            </div>
          ) : data && data.expenses.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#888888]">No monthly expenses recorded.</p>
          ) : (
            <ul className="divide-y divide-black/[0.05]">
              {data?.expenses.map((expense) => (
                <li key={expense.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2f4f8] text-xs font-bold text-[#2d4a3e]">
                    {expense.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1a1a1a]">{expense.label}</p>
                    <p className="text-[11px] text-[#888888]">Recurring · monthly</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-red-600">
                    −{formatTreasuryPeso(expense.amount, { decimals: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#888888]">Treasury balance</span>
              <span className="font-semibold text-[#1a1a1a]">{formatTreasuryPeso(data.grossBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#888888]">Monthly expenses</span>
              <span className="font-semibold text-red-600">−{formatTreasuryPeso(data.totalMonthlyExpenses)}</span>
            </div>
            <div className="border-t border-black/[0.06] pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#1a1a1a]">Available</span>
                <span className="font-serif text-lg font-bold text-[#2d4a3e]">
                  {formatTreasuryPeso(data.availableBalance)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <Link
          href="/admin"
          className="mt-4 flex items-center justify-between rounded-2xl border border-black/[0.05] bg-white px-4 py-3.5 text-sm font-semibold text-[#1a1a1a] shadow-sm"
        >
          Admin dashboard
          <ChevronRight className="h-4 w-4 text-[#BBBBBB]" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
