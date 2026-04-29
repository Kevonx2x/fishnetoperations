import { ClientDashboardShell } from "@/components/dashboard/client-dashboard-shell";

export default function DashboardClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientDashboardShell>{children}</ClientDashboardShell>;
}
