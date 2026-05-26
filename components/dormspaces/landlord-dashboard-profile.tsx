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
      <LandlordDashboardSubpageHeader title="My Profile" />
      <div className="mx-auto max-w-5xl px-4 pb-32">
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
