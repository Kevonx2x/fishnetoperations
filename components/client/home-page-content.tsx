"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { BahayGoHomeMarketplace } from "@/components/marketplace/fishnet-home-marketplace";
import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

const PostLoginModal = dynamic(
  () =>
    import("@/components/onboarding/post-login-modal").then((m) => ({
      default: m.PostLoginModal,
    })),
  { ssr: false },
);

export function HomePageContent({
  initialHomepageProperties,
}: {
  initialHomepageProperties?: HomepagePropertiesResult;
}) {
  return (
    <>
      <Suspense fallback={<HomepageLoadShell />}>
        <BahayGoHomeMarketplace
          listingMode="rent"
          initialHomepageProperties={initialHomepageProperties}
        />
      </Suspense>
      <PostLoginModal gate="client-home" />
    </>
  );
}
