import { Suspense } from "react";

import { AgentDashboardHub } from "@/components/dashboard/agent-dashboard-hub";

export default function AgentDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AgentDashboardHub />
    </Suspense>
  );
}
