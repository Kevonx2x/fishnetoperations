import { Suspense } from "react";
import { AgentDashboard } from "@/components/dashboard/agent-dashboard";
import { StreamChatProvider } from "@/features/messaging/components/stream-chat-provider";

export default function AgentDashboardPage() {
  return (
    <StreamChatProvider>
      <Suspense fallback={null}>
        <AgentDashboard />
      </Suspense>
    </StreamChatProvider>
  );
}
