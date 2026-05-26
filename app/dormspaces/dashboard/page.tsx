import { Suspense } from "react";

import { LandlordDashboardHub } from "@/components/dormspaces/landlord-dashboard-hub";

export default function DormspaceLandlordDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading dashboard…</p>
        </div>
      }
    >
      <LandlordDashboardHub />
    </Suspense>
  );
}
