"use client";

import { useCallback, useEffect, useState } from "react";

export type TreasuryPayload = {
  accountLabel: string;
  accountNumberMasked: string;
  holderName: string;
  currency: string;
  grossBalance: number;
  totalMonthlyExpenses: number;
  availableBalance: number;
  expenses: { id: string; label: string; amount: number; source: string }[];
};

export function usePersonalTreasury() {
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

  return { data, loading, error, refreshing, load };
}
