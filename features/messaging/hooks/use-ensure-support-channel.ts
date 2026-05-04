import { useEffect, useRef } from "react";

import { useAuth } from "@/contexts/auth-context";

type Options = {
  enabled: boolean;
  onEnsured?: () => void;
};

/**
 * Calls the server once per session (per tab) to create the deterministic support channel if missing.
 */
export function useEnsureSupportChannel({ enabled, onEnsured }: Options) {
  const { user } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || !user?.id || ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/stream/ensure-support-channel", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as { ok?: boolean; created?: boolean; existed?: boolean };
        if (json?.ok && (json.created || json.existed)) {
          onEnsured?.();
        }
      } catch {
        /* ignore */
      }
    })();
  }, [enabled, onEnsured, user?.id]);
}
