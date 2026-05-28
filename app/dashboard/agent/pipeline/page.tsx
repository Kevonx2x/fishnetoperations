"use client";

import { Suspense } from "react";

import { AgentDashboard } from "@/components/dashboard/agent-dashboard";

/** Mobile pipeline route — do not redirect to `?tab=pipeline` (that loops with layout redirect). */
export default function AgentDashboardPipelinePage() {
  return (
    <Suspense fallback={null}>
      <AgentDashboard />
    </Suspense>
  );
}
