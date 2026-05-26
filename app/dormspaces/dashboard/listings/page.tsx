import { Suspense } from "react";

import { LandlordDashboardListings } from "@/components/dormspaces/landlord-dashboard-listings";

export default async function DormspaceLandlordListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const params = await searchParams;
  const welcome = params.welcome === "1" || params.welcome === "true";

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading listings…</p>
        </div>
      }
    >
      <LandlordDashboardListings welcome={welcome} />
    </Suspense>
  );
}
