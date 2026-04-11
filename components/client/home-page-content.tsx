"use client";

import { BahayGoHomeMarketplace } from "@/components/marketplace/fishnet-home-marketplace";
import { WelcomeOnboarding } from "@/components/marketplace/welcome-onboarding";
import { useAuth } from "@/contexts/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileClientDashboard } from "@/components/client/mobile-client-dashboard";

export function HomePageContent() {
  const { profile, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    return <div className="min-h-[40vh] bg-[#FAF8F4]" aria-hidden />;
  }

  if (profile?.role === "client" && isMobile) {
    return <MobileClientDashboard />;
  }

  return (
    <>
      <WelcomeOnboarding />
      <BahayGoHomeMarketplace listingMode="rent" />
    </>
  );
}
