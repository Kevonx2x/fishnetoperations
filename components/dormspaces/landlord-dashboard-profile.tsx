"use client";

import { useState } from "react";

import { DormspaceLandlordProfileTab } from "@/components/dormspaces/dormspace-landlord-profile-tab";
import { LandlordDashboardShell } from "@/components/dormspaces/landlord-dashboard-shell";
import { LandlordDashboardSubpageHeader } from "@/components/dormspaces/landlord-dashboard-subpage-header";
import { useAuth } from "@/contexts/auth-context";

export function LandlordDashboardProfile() {
  const { refreshProfile } = useAuth();
  const [error, setError] = useState("");

  return (
    <LandlordDashboardShell loginNext="/dormspaces/dashboard/profile">
      <div className="md:hidden">
        <LandlordDashboardSubpageHeader title="My Profile" />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6 pb-32 md:px-8 md:py-8">
        <h1 className="mb-6 hidden font-serif text-2xl font-bold text-[#2C2C2C] md:block md:text-3xl">
          My Profile
        </h1>
        {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}
        <DormspaceLandlordProfileTab
          onError={setError}
          onSaved={() => void refreshProfile()}
          hideTitle
          hideVerificationBanner
        />
      </div>
    </LandlordDashboardShell>
  );
}
