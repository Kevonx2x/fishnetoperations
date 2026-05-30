"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { BahayGoHomeMarketplace } from "@/components/marketplace/fishnet-home-marketplace";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

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
      <BahayGoHomeMarketplace
        listingMode={listingMode}
        initialHomepageProperties={initialHomepageProperties}
      />
      <PostLoginModal gate="client-home" />
    </>
  );
}
