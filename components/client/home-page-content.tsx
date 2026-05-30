"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { BahayGoHomeMarketplace } from "@/components/marketplace/fishnet-home-marketplace";
import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";

const PostLoginModal = dynamic(
  () =>
    import("@/components/onboarding/post-login-modal").then((m) => ({
      default: m.PostLoginModal,
    })),
  { ssr: false },
);

export function HomePageContent() {
  return (
    <>
      <Suspense fallback={<HomepageLoadShell />}>
        <BahayGoHomeMarketplace listingMode="rent" />
      </Suspense>
      <PostLoginModal gate="client-home" />
    </>
  );
}
