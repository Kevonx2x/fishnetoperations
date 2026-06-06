import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { ClientDashboardShell } from "@/components/dashboard/client-dashboard-shell";

export default function DashboardClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading" />
        </div>
      }
    >
      <ClientDashboardShell>{children}</ClientDashboardShell>
    </Suspense>
  );
}
