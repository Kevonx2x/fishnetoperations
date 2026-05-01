"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";

import { fetchAgentViewings, type ParsedViewing } from "@/lib/viewings";

type AgentViewingsContextValue = {
  viewings: ParsedViewing[];
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const AgentViewingsContext = createContext<AgentViewingsContextValue | null>(null);

export function AgentViewingsProvider({
  agentUserId,
  supabase,
  refetchRef,
  children,
}: {
  agentUserId: string;
  supabase: SupabaseClient;
  /** Optional: parent assigns `refetch` here so `loadData` can refresh viewings without using the hook. */
  refetchRef?: MutableRefObject<(() => Promise<void>) | null>;
  children: ReactNode;
}) {
  const [viewings, setViewings] = useState<ParsedViewing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!agentUserId.trim()) {
      setViewings([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await fetchAgentViewings(supabase, agentUserId, undefined, undefined, {
        excludeCancelled: true,
      });
      setViewings(rows);
    } finally {
      setIsLoading(false);
    }
  }, [agentUserId, supabase]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!agentUserId.trim()) {
        setViewings([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const rows = await fetchAgentViewings(supabase, agentUserId, undefined, undefined, {
          excludeCancelled: true,
        });
        if (!cancelled) setViewings(rows);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setIsLoading(false);
    };
  }, [agentUserId, supabase]);

  useEffect(() => {
    const onFocus = () => {
      void refetch();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  useLayoutEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = refetch;
    return () => {
      refetchRef.current = null;
    };
  }, [refetchRef, refetch]);

  const value = useMemo<AgentViewingsContextValue>(
    () => ({ viewings, isLoading, refetch }),
    [viewings, isLoading, refetch],
  );

  return <AgentViewingsContext.Provider value={value}>{children}</AgentViewingsContext.Provider>;
}

export function useAgentViewings(): AgentViewingsContextValue {
  const ctx = useContext(AgentViewingsContext);
  if (!ctx) {
    throw new Error("useAgentViewings must be used within AgentViewingsProvider");
  }
  return ctx;
}
