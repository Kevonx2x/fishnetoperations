"use client";

import { useAgentTourStore } from "@/lib/agent-tour/tour-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { HelpCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/** Auto-start on `/` for eligible verified agents with tutorial incomplete. */
export function AgentTourBootstrap() {
  const pathname = usePathname();
  const { user, profile, loading, role } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [agentVerified, setAgentVerified] = useState(false);

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

  const firstName =
    profile?.full_name?.trim().split(/\s+/).filter(Boolean)[0] ||
    user?.email?.split("@")[0] ||
    "there";

  useEffect(() => {
    if (loading || !user?.id || !profile) return;
    if (role !== "agent") return;
    if (!agentVerified) return;
    if (pathname !== "/") return;

    if (useAgentTourStore.getState().pendingHelpStart) {
      useAgentTourStore.getState().consumeHelpStart();
      useAgentTourStore.getState().start(firstName);
      return;
    }

    if (profile.tutorial_completed !== false) return;

    const t = window.setTimeout(() => {
      if (useAgentTourStore.getState().isOpen) return;
      useAgentTourStore.getState().start(firstName);
    }, 800);

    return () => window.clearTimeout(t);
  }, [loading, user?.id, profile, role, agentVerified, pathname, firstName]);

  return null;
}

export function AgentTourSidebarHelp() {
  const router = useRouter();

  return (
    <button
      type="button"
      title="Take the tour again."
      aria-label="Take the tour again."
      onClick={() => {
        useAgentTourStore.getState().requestHelpStart();
        router.push("/");
      }}
      className="mx-1 mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#2C2C2C]/50 transition hover:bg-white/80 hover:text-[#6B9E6E]"
    >
      <HelpCircle className="h-5 w-5" aria-hidden />
    </button>
  );
}
