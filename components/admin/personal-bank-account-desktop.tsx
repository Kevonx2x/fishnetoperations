"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw, TrendingDown, Wallet } from "lucide-react";
import { usePersonalTreasury } from "@/hooks/use-personal-treasury";
import { formatTreasuryPeso } from "@/lib/admin-personal-treasury";
import { cn } from "@/lib/utils";

export function PersonalBankAccountDesktop() {
  const { data, loading, error, refreshing, load } = usePersonalTreasury();
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#eef1f6] font-sans text-[#1a1a1a]">
      <header className="border-b border-[#2C2C2C]/10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#2d4a3e] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Admin
            </Link>
            <div className="hidden h-5 w-px bg-[#2C2C2C]/15 sm:block" />
            <div>
              <h1 className="font-serif text-xl font-bold text-[#2C2C2C]">Personal account</h1>
              <p className="text-xs text-[#888888]">Treasury overview · {monthLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm transition hover:bg-[#fafafa] disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {loading ? (
          <div className="space-y-6">
            <div className="h-44 animate-pulse rounded-2xl bg-white/80" />
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/80" />
              ))}
            </div>
            <div className="h-80 animate-pulse rounded-2xl bg-white/80" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-10 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 rounded-lg bg-[#2d4a3e] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Account hero */}
            <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2744] via-[#243352] to-[#2d4a3e] p-8 text-white shadow-lg lg:p-10">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    {data.accountLabel}
                  </p>
                  <p className="mt-2 font-serif text-2xl font-bold">{data.holderName}</p>
                  <p className="mt-1 text-sm text-white/45">{data.accountNumberMasked}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Wallet className="h-7 w-7 text-white/90" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-10 border-t border-white/10 pt-8">
                <p className="text-sm font-medium text-white/55">Available balance</p>
                <p className="mt-2 font-serif text-5xl font-bold tracking-tight lg:text-6xl">
                  {formatTreasuryPeso(data.availableBalance)}
                </p>
                <p className="mt-3 text-sm text-white/40">
                  After {formatTreasuryPeso(data.totalMonthlyExpenses)} in monthly recurring expenses
                </p>
              </div>
            </section>

            {/* Metric cards */}
            <section className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Treasury balance",
                  value: formatTreasuryPeso(data.grossBalance),
                  sub: "Gross holdings",
                  accent: "text-[#2C2C2C]",
                },
                {
                  label: "Monthly expenses",
                  value: `−${formatTreasuryPeso(data.totalMonthlyExpenses)}`,
                  sub: `${data.expenses.length} recurring items`,
                  accent: "text-red-600",
                },
                {
                  label: "Available",
                  value: formatTreasuryPeso(data.availableBalance),
                  sub: "Net after expenses",
                  accent: "text-[#2d4a3e]",
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-[#2C2C2C]/08 bg-white p-6 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#888888]">
                    {metric.label}
                  </p>
                  <p className={cn("mt-2 font-serif text-2xl font-bold", metric.accent)}>
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-[#888888]">{metric.sub}</p>
                </div>
              ))}
            </section>

            {/* Expenses + summary */}
            <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/08 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#2C2C2C]/08 px-6 py-4">
                  <div>
                    <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Monthly expenses</h2>
                    <p className="text-xs text-[#888888]">{monthLabel}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                    <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                    −{formatTreasuryPeso(data.totalMonthlyExpenses)}
                  </span>
                </div>

                {data.expenses.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-[#888888]">
                    No monthly expenses in Credentials yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#2C2C2C]/06 bg-[#fafafa] text-xs font-semibold uppercase tracking-wide text-[#888888]">
                          <th className="px-6 py-3 font-semibold">Service</th>
                          <th className="px-6 py-3 font-semibold">Type</th>
                          <th className="px-6 py-3 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2C2C2C]/06">
                        {data.expenses.map((expense) => (
                          <tr key={expense.id} className="transition hover:bg-[#fafafa]/80">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef1f6] text-xs font-bold text-[#2d4a3e]">
                                  {expense.label.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-semibold text-[#2C2C2C]">{expense.label}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[#888888]">Recurring · monthly</td>
                            <td className="px-6 py-4 text-right font-bold text-red-600">
                              −{formatTreasuryPeso(expense.amount, { decimals: true })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#2C2C2C]/10 bg-[#fafafa]">
                          <td colSpan={2} className="px-6 py-4 font-semibold text-[#2C2C2C]">
                            Total monthly outflow
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-red-600">
                            −{formatTreasuryPeso(data.totalMonthlyExpenses, { decimals: true })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
                <div className="rounded-2xl border border-[#2C2C2C]/08 bg-white p-6 shadow-sm">
                  <h3 className="font-serif text-base font-bold text-[#2C2C2C]">Balance summary</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#888888]">Treasury balance</dt>
                      <dd className="font-semibold text-[#2C2C2C]">
                        {formatTreasuryPeso(data.grossBalance)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#888888]">Monthly expenses</dt>
                      <dd className="font-semibold text-red-600">
                        −{formatTreasuryPeso(data.totalMonthlyExpenses)}
                      </dd>
                    </div>
                    <div className="border-t border-[#2C2C2C]/08 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="font-bold text-[#2C2C2C]">Available</dt>
                        <dd className="font-serif text-xl font-bold text-[#2d4a3e]">
                          {formatTreasuryPeso(data.availableBalance)}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>

                <Link
                  href="/admin"
                  className="block rounded-2xl border border-[#2C2C2C]/08 bg-white p-5 text-sm shadow-sm transition hover:bg-[#fafafa]"
                >
                  <p className="font-semibold text-[#2C2C2C]">Manage expenses</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#888888]">
                    Update recurring costs in Admin → Credentials. Changes appear here on refresh.
                  </p>
                </Link>
              </aside>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
