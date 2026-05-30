"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

const BahayGoHomeMarketplace = dynamic(
  () =>
    import("@/components/marketplace/fishnet-home-marketplace").then((m) => ({
      default: m.BahayGoHomeMarketplace,
    })),
  {
    ssr: false,
    loading: () => (
      <>
        {/* Mobile: SSR LCP strip already painted — avoid duplicate skeleton */}
        <div className="hidden md:block">
          <HomepageLoadShell />
        </div>
      </>
    ),
  },
);

const PostLoginModal = dynamic(
  () =>
    import("@/components/onboarding/post-login-modal").then((m) => ({
      default: m.PostLoginModal,
    })),
  { ssr: false },
);

type Props = {
  listingMode?: "buy" | "rent" | "all";
  initialHomepageProperties?: HomepagePropertiesResult | null;
};

export function HomePageContent({
  listingMode = "rent",
  initialHomepageProperties = null,
}: Props) {
  return (
    <>
      <Suspense fallback={<HomepageLoadShell />}>
        <BahayGoHomeMarketplace
          listingMode={listingMode}
          initialHomepageProperties={initialHomepageProperties}
        />
      </Suspense>
      <PostLoginModal gate="client-home" />
    </>
  );
}
