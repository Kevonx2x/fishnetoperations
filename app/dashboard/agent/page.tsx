"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AgentDashboard } from "@/components/dashboard/agent-dashboard";
import { AgentDashboardMobileHub } from "@/components/dashboard/agent-dashboard-mobile-hub";

const MOBILE_TAB_SECTIONS = new Set([
  "pipeline",
  "messages",
  "listings",
  "analytics",
  "billing",
  "profile",
  "documents",
  "notifications",
]);

function AgentDashboardPageInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab")?.trim() ?? "";
  const showMobileWorkspace = tab.length > 0 && MOBILE_TAB_SECTIONS.has(tab);

  return (
    <>
      <div className="hidden md:block">
        <AgentDashboard />
      </div>
      <div className="md:hidden">
        {showMobileWorkspace ? <AgentDashboard /> : <AgentDashboardMobileHub />}
      </div>
    </>
  );
}

export default function AgentDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AgentDashboardPageInner />
    </Suspense>
  );
}
