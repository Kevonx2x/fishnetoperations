"use client";

import Link from "next/link";
import { Suspense } from "react";

import { DormspaceSubmitForm } from "@/components/dormspaces/dormspace-submit-form";
import { DormspaceSubmitGate } from "@/components/dormspaces/dormspace-submit-gate";
import { LandlordDashboardShell } from "@/components/dormspaces/landlord-dashboard-shell";
import { LandlordDashboardSubpageHeader } from "@/components/dormspaces/landlord-dashboard-subpage-header";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { useAuth } from "@/contexts/auth-context";
import { isLandlordCapable } from "@/lib/auth-roles";

function SubmitFormFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <p className="text-sm font-medium text-[#484848]">Loading…</p>
    </div>
  );
}

function SubmitFormBlock() {
  return (
    <Suspense fallback={<SubmitFormFallback />}>
      <DormspaceSubmitGate>
        <DormspaceSubmitForm />
      </DormspaceSubmitGate>
    </Suspense>
  );
}

export function DormspaceSubmitPageContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const isReturningLandlord = Boolean(user && profile && isLandlordCapable(profile));

  // Initial session only — keep form mounted during background auth refresh for signed-in users.
  if (authLoading && !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4]">
        <p className="text-sm font-medium text-[#484848]">Loading…</p>
      </div>
    );
  }

  if (isReturningLandlord) {
    return (
      <LandlordDashboardShell loginNext="/dormspaces/submit">
        <div className="md:hidden">
          <LandlordDashboardSubpageHeader title="Add New Listing" />
        </div>
        <div className="mx-auto max-w-3xl px-4 py-6 pb-32 md:px-8 md:py-8">
          <h1 className="mb-6 hidden font-serif text-2xl font-bold text-[#2C2C2C] md:block md:text-3xl">
            Add New Listing
          </h1>
          <SubmitFormBlock />
        </div>
      </LandlordDashboardShell>
    );
  }

  return (
    <DormspacePortalShell variant="landlord">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        <div className="mb-8 text-center md:mb-10">
          <Link href="/dormspaces" className="text-sm font-semibold text-[#6B9E6E] hover:underline">
            ← Back to Dormspaces
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
            List your dormspace
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-[#484848]">
            Free to list. We verify every landlord with ID and proof of billing before your listing goes live.
          </p>
        </div>
        <SubmitFormBlock />
      </main>
    </DormspacePortalShell>
  );
}
