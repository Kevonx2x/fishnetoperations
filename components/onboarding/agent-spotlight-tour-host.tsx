"use client";

import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentSpotlightTour } from "@/components/onboarding/agent-spotlight-tour";

export const BAHAYGO_AGENT_TOUR_REPLAY_EVENT = "bahaygo-agent-tour-replay";

export function AgentSpotlightTourHost() {
  const { user, profile, loading, role, refreshProfile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [agentVerified, setAgentVerified] = useState(false);
  const [open, setOpen] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  useEffect(() => {
    if (!user?.id || role !== "agent") {
      setAgentVerified(false);
      return;
    }
    void supabase
      .from("agents")
      .select("verification_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAgentVerified(data?.verification_status === "verified");
      });
  }, [user?.id, role, supabase]);

  const eligibleAutoOpen = Boolean(
    !loading && user && role === "agent" && profile && profile.tutorial_completed === false && agentVerified,
  );

  useEffect(() => {
    if (!eligibleAutoOpen || pathname !== "/") return;
    const t = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(t);
  }, [eligibleAutoOpen, pathname]);

  useEffect(() => {
    const onReplay = () => {
      setTourKey((k) => k + 1);
      router.push("/");
      window.setTimeout(() => setOpen(true), 120);
    };
    window.addEventListener(BAHAYGO_AGENT_TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(BAHAYGO_AGENT_TOUR_REPLAY_EVENT, onReplay);
  }, [router]);

  const onTutorialComplete = useCallback(async () => {
    const res = await fetch("/api/profile/complete-tutorial", {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) await refreshProfile();
  }, [refreshProfile]);

  if (!user || role !== "agent") return null;

  return (
    <AgentSpotlightTour
      key={tourKey}
      open={open}
      onOpenChange={setOpen}
      firstName={
        profile?.full_name?.trim().split(/\s+/).filter(Boolean)[0] ||
        user?.email?.split("@")[0] ||
        "there"
      }
      onTutorialComplete={onTutorialComplete}
    />
  );
}
