import { Suspense } from "react";

import { LandlordDashboardAccount } from "@/components/dormspaces/landlord-dashboard-account";

export default function DormspaceLandlordAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading account…</p>
        </div>
      }
    >
      <LandlordDashboardAccount />
    </Suspense>
  );
}
