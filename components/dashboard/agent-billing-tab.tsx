"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  coListLimitForTier,
  formatLimitN,
  listingLimitForTier,
  normalizeListingTier,
  teamMemberLimitForTier,
  TIER_LABEL,
} from "@/lib/agent-listing-limits";
import {
  PAYMONGO_SUBSCRIPTION_TIERS,
  tierAmountCentavos,
  type PaymongoSubscriptionTier,
} from "@/lib/paymongo";

type SubscriptionRow = {
  id: string;
  agent_id: string;
  tier: string;
  status: string | null;
  paymongo_payment_id: string | null;
  amount: number | string | null;
  currency: string | null;
  created_at: string;
  started_at: string | null;
  expires_at: string | null;
};

type AgentBillingTabProps = {
  agentId: string;
  tier: string | null | undefined;
  supabase: SupabaseClient;
  ownedListingCount: number;
  coListedCount: number;
  paymentBannerTier: string | null;
  onDismissPaymentBanner: () => void;
};

const PAID_TIERS: PaymongoSubscriptionTier[] = [...PAYMONGO_SUBSCRIPTION_TIERS];

const TIER_FEATURES: Record<PaymongoSubscriptionTier, string[]> = {
  pro: [
    "Analytics",
    "Templates",
    "Priority support",
    "10 listings + 10 co-listings",
    "3 team seats",
  ],
  featured: [
    "Everything in Pro",
    "Featured Agent gold badge",
    "Top placement on listings",
    "20 owned listings",
    "10 co-lists",
    "5 team seats",
  ],
  broker: [
    "Everything in Featured",
    "Unlimited owned listings",
    "Unlimited co-lists",
    "Unlimited team seats",
    "Brokerage team tools",
  ],
};

function formatMoneyPhpFromCentavos(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `₱${(n / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AgentBillingTab({
  agentId,
  tier,
  supabase,
  ownedListingCount,
  coListedCount,
  paymentBannerTier,
  onDismissPaymentBanner,
}: AgentBillingTabProps) {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<PaymongoSubscriptionTier | null>(null);

  const current = normalizeListingTier(tier);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(`Could not load billing history: ${error.message}`);
      setRows([]);
    } else {
      setRows((data as SubscriptionRow[]) ?? []);
    }
    setLoading(false);
  }, [agentId, supabase]);

  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);

  useEffect(() => {
    if (paymentBannerTier) {
      void loadSubs();
    }
  }, [paymentBannerTier, loadSubs]);

  const ownedLimit = useMemo(() => listingLimitForTier(tier), [tier]);
  const coLimit = useMemo(() => coListLimitForTier(tier), [tier]);
  const teamLimit = useMemo(() => teamMemberLimitForTier(tier), [tier]);

  async function startCheckout(tier: PaymongoSubscriptionTier) {
    setCheckoutTier(tier);
    try {
      const res = await fetch("/api/paymongo/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      console.log("[Billing] checkout response status:", res.status);
      const text = await res.text();
      console.log("[Billing] checkout response body:", text);

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("[Billing] checkout response was not JSON (likely HTML or empty)");
        toast.error("Server returned a non-JSON response. Check the console for details.");
        return;
      }

      const j = data as {
        checkoutUrl?: string;
        success?: boolean;
        error?: { message?: string; code?: string };
      };

      if (!res.ok || j.success === false) {
        toast.error(j?.error?.message ?? "Could not start checkout");
        return;
      }
      if (j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
      } else {
        toast.error("Missing checkout URL");
      }
    } catch (e) {
      console.error("[Billing] checkout request failed:", e);
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutTier(null);
    }
  }

  const showSuccessBanner =
    paymentBannerTier &&
    (paymentBannerTier === "pro" ||
      paymentBannerTier === "featured" ||
      paymentBannerTier === "broker");

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-[#6B9E6E]" aria-hidden />
          <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Billing</h1>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
          Manage your BahayGo plan, limits, and subscription history.
        </p>
      </div>

      {showSuccessBanner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4A843]/40 bg-[#D4A843]/10 px-4 py-3">
          <p className="text-sm font-bold text-[#2C2C2C]">
            🎉 Welcome to {TIER_LABEL[normalizeListingTier(paymentBannerTier)]}!
          </p>
          <button
            type="button"
            onClick={onDismissPaymentBanner}
            className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Current plan</p>
            <p className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{TIER_LABEL[current]}</p>
            <ul className="mt-3 space-y-1 text-sm font-semibold text-[#2C2C2C]/75">
              <li>
                Owned listings: {ownedListingCount} / {formatLimitN(ownedLimit)} used
              </li>
              <li>
                Co-lists: {coListedCount} / {formatLimitN(coLimit)} used
              </li>
              <li>Team seats: up to {formatLimitN(teamLimit)}</li>
            </ul>
          </div>
          <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-xs font-semibold text-[#2C2C2C]/65">
            <Sparkles className="mb-1 inline h-4 w-4 text-[#D4A843]" aria-hidden />
            Upgrade anytime — your new limits apply as soon as payment succeeds.
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Upgrade options</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PAID_TIERS.map((t) => {
            const isCurrent = current === t;
            const price = tierAmountCentavos(t) / 100;
            return (
              <div
                key={t}
                className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${
                  t === "featured" ? "border-[#D4A843]/50 ring-1 ring-[#D4A843]/20" : "border-[#2C2C2C]/10"
                }`}
              >
                <p className="font-serif text-xl font-bold text-[#2C2C2C]">{TIER_LABEL[t]}</p>
                <p className="mt-1 font-serif text-lg font-bold tabular-nums text-[#2C2C2C]">
                  ₱{price.toLocaleString("en-PH")}/mo
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs font-semibold text-[#2C2C2C]/70">
                  {TIER_FEATURES[t].map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={isCurrent || checkoutTier !== null}
                  onClick={() => void startCheckout(t)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkoutTier === t ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : isCurrent ? (
                    "Current plan"
                  ) : (
                    "Upgrade"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Subscription history</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[#2C2C2C]/10 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm font-semibold text-[#2C2C2C]/55">
              <Loader2 className="h-5 w-5 animate-spin text-[#6B9E6E]" />
              Loading history…
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-sm font-semibold text-[#2C2C2C]/55">No subscription payments yet.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                  <th className="px-4 py-3 font-bold text-[#2C2C2C]">Date</th>
                  <th className="px-4 py-3 font-bold text-[#2C2C2C]">Tier</th>
                  <th className="px-4 py-3 font-bold text-[#2C2C2C]">Amount</th>
                  <th className="px-4 py-3 font-bold text-[#2C2C2C]">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#2C2C2C]/5">
                    <td className="px-4 py-3 font-semibold text-[#2C2C2C]/85">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#2C2C2C]">
                      {TIER_LABEL[normalizeListingTier(r.tier)]}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-[#2C2C2C]/85">
                      {formatMoneyPhpFromCentavos(r.amount)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#2C2C2C]/75">{r.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
