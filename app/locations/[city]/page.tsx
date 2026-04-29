"use client";

import { Suspense } from "react";
import { notFound, useParams } from "next/navigation";
import {
  BahayGoHomeMarketplace,
  resolveFeaturedCitySlugToKey,
} from "@/components/marketplace/fishnet-home-marketplace";
import { WelcomeOnboarding } from "@/components/marketplace/welcome-onboarding";
import { useAuth } from "@/contexts/auth-context";

export default function FeaturedLocationPage() {
  const params = useParams();
  const slug = typeof params.city === "string" ? params.city : "";
  if (!resolveFeaturedCitySlugToKey(slug)) {
    notFound();
  }

  const { loading } = useAuth();

  if (loading) {
    return <div className="min-h-[40vh] bg-[#FAF8F4]" aria-hidden />;
  }

  return (
    <>
      <WelcomeOnboarding />
      <Suspense fallback={<div>Loading...</div>}>
        <BahayGoHomeMarketplace listingMode="rent" />
      </Suspense>
    </>
  );
}
