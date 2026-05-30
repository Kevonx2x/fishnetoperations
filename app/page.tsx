import { Suspense } from "react";
import { preload } from "react-dom";

import { HomePageContent } from "@/components/client/home-page-content";
import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";
import { resolveMobileHomepageLcpImageUrl } from "@/lib/homepage-mobile-lcp";
import { fetchHomepagePropertiesServer } from "@/lib/marketplace-home-fetchers-server";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

export const revalidate = 60;

const SSR_LISTINGS_ENABLED = process.env.HOMEPAGE_SSR_LISTINGS !== "false";

export default async function HomePage() {
  let initialHomepageProperties: HomepagePropertiesResult | null = null;

  if (SSR_LISTINGS_ENABLED) {
    try {
      initialHomepageProperties = await fetchHomepagePropertiesServer({
        neighborhoodFilter: null,
        listingTypeFilter: "rent",
      });
      const lcpImageUrl = resolveMobileHomepageLcpImageUrl(initialHomepageProperties);
      if (lcpImageUrl) {
        preload(lcpImageUrl, { as: "image", fetchPriority: "high" });
      }
    } catch (error) {
      console.error("[homepage] server listings fetch failed", error);
    }
  }

  return (
    <Suspense fallback={<HomepageLoadShell />}>
      <HomePageContent
        listingMode="rent"
        initialHomepageProperties={initialHomepageProperties}
      />
    </Suspense>
  );
}
