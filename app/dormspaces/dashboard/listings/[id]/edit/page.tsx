import { Suspense } from "react";

import { DormspaceEditForm } from "@/components/dormspaces/dormspace-edit-form";
import { LandlordDashboardShell } from "@/components/dormspaces/landlord-dashboard-shell";
import { LandlordDashboardSubpageHeader } from "@/components/dormspaces/landlord-dashboard-subpage-header";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Edit listing | Dormspaces`,
    description: `Edit dormspace listing ${id}`,
  };
}

export default async function EditDormspaceListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading…</p>
        </div>
      }
    >
      <LandlordDashboardShell loginNext={`/dormspaces/dashboard/listings/${id}/edit`}>
        <LandlordDashboardSubpageHeader
          title="Edit listing"
          backHref="/dormspaces/dashboard/listings"
          backLabel="My Listings"
        />
        <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
          <DormspaceEditForm listingId={id} />
        </main>
      </LandlordDashboardShell>
    </Suspense>
  );
}
