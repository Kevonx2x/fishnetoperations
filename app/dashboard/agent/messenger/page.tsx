"use client";

import { Suspense } from "react";

import { AgentDashboard } from "@/components/dashboard/agent-dashboard";

/** In-house messenger route — renders inside the real agent dashboard shell (see `tabFromPathnameAndSearch`). */
export default function AgentInhouseMessengerPage() {
  return (
    <Suspense fallback={null}>
      <AgentDashboard />
    </Suspense>
  );
}
