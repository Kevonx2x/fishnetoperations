import { Suspense } from "react";

import { LandlordDashboardProfile } from "@/components/dormspaces/landlord-dashboard-profile";

export default function DormspaceLandlordProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading profile…</p>
        </div>
      }
    >
      <LandlordDashboardProfile />
    </Suspense>
  );
}
