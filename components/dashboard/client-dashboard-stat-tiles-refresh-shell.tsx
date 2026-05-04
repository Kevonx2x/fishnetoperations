"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-runs server components in this route when the tab regains focus so DB-backed tiles stay fresh.
 */
export function ClientDashboardStatTilesRefreshShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      void router.refresh();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  return <>{children}</>;
}
