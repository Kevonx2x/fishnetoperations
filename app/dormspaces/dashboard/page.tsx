import { Suspense } from "react";

import { LandlordDashboard } from "@/components/dormspaces/landlord-dashboard";

export default async function DormspaceLandlordDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const welcome = params.welcome === "1" || params.welcome === "true";

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading dashboard…</p>
        </div>
      }
    >
      <LandlordDashboard welcome={welcome} />
    </Suspense>
  );
}
