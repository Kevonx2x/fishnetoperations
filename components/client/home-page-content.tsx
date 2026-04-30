"use client";

import { Suspense } from "react";
import { BahayGoHomeMarketplace } from "@/components/marketplace/fishnet-home-marketplace";
import { useAuth } from "@/contexts/auth-context";

export function HomePageContent() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="min-h-[40vh] bg-[#FAF8F4]" aria-hidden />;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BahayGoHomeMarketplace listingMode="rent" />
    </Suspense>
  );
}
