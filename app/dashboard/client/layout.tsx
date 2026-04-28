import { ClientDashboardShell } from "@/components/dashboard/client-dashboard-shell";
import { StreamChatProvider } from "@/features/messaging/components/stream-chat-provider";

export default function DashboardClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <StreamChatProvider>
      <ClientDashboardShell>{children}</ClientDashboardShell>
    </StreamChatProvider>
  );
}
