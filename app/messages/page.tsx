"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { AGENT_MESSENGER_TAB_PATH } from "@/lib/agent-messages-path";
import { CLIENT_MESSENGER_PATH } from "@/lib/messenger/client-messages-path";

function isAgentRole(role: string | null | undefined): boolean {
  return role === "agent" || role === "broker" || role === "team_member";
}

function MessagesRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const conversationId = searchParams.get("c")?.trim();
    const buildHref = (base: string) => {
      if (!conversationId) return base;
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}c=${encodeURIComponent(conversationId)}`;
    };

    if (!user) {
      router.replace(`/auth/login?next=${encodeURIComponent("/messages")}`);
      return;
    }

    if (isAgentRole(role)) {
      router.replace(buildHref(AGENT_MESSENGER_TAB_PATH));
      return;
    }

    router.replace(buildHref(CLIENT_MESSENGER_PATH));
  }, [loading, role, router, searchParams, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
      <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Redirecting to messages" />
    </div>
  );
}

/** Legacy `/messages` → in-house messenger (client or agent dashboard). */
export default function MessagesRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Redirecting to messages" />
        </div>
      }
    >
      <MessagesRedirectInner />
    </Suspense>
  );
}
