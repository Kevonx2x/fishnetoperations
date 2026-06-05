"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AgentDashboardMessengerShell } from "@/components/dashboard/agent-dashboard-messenger-shell";
import { MessengerHost } from "@/features/messenger/components/messenger-host";

function MessagesLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#FAF8F4]">
      <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading messenger" />
    </div>
  );
}

export default function AgentInhouseMessengerPage() {
  return (
    <AgentDashboardMessengerShell>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <Suspense fallback={<MessagesLoading />}>
          <MessengerHost signedOutMessage="Sign in as an agent to view your messages." />
        </Suspense>
      </div>
    </AgentDashboardMessengerShell>
  );
}
