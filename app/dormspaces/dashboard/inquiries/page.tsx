import { Suspense } from "react";

import { LandlordDashboardInquiries } from "@/components/dormspaces/landlord-dashboard-inquiries";

export default function DormspaceLandlordInquiriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading inquiries…</p>
        </div>
      }
    >
      <LandlordDashboardInquiries />
    </Suspense>
  );
}
