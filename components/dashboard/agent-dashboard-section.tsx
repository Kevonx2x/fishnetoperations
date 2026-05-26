"use client";

import { Suspense } from "react";

import { AgentDashboard } from "@/components/dashboard/agent-dashboard";
import {
  AGENT_SECTION_TITLES,
  AGENT_SECTION_TO_TAB,
  type AgentDashboardSectionId,
} from "@/lib/agent-dashboard-routes";

type Props = {
  section: AgentDashboardSectionId;
};

function AgentDashboardSectionInner({ section }: Props) {
  return (
    <AgentDashboard
      surface="section"
      sectionTab={AGENT_SECTION_TO_TAB[section]}
      sectionTitle={AGENT_SECTION_TITLES[section]}
    />
  );
}

export function AgentDashboardSection({ section }: Props) {
  return (
    <Suspense fallback={null}>
      <AgentDashboardSectionInner section={section} />
    </Suspense>
  );
}
