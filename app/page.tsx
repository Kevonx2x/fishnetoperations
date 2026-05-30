import { Suspense } from "react";
import { preload } from "react-dom";

import { HomePageContent } from "@/components/client/home-page-content";
import { HomepageLcpOrchestrator } from "@/components/client/homepage-lcp-orchestrator";
import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";
import { HomepageMobileLcpStrip } from "@/components/marketplace/homepage-mobile-lcp-strip";
import { resolveMobileHomepageLcpImageUrl } from "@/lib/homepage-mobile-lcp";
import { fetchHomepagePropertiesServer } from "@/lib/marketplace-home-fetchers-server";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

export const revalidate = 60;

const SSR_LISTINGS_ENABLED = process.env.HOMEPAGE_SSR_LISTINGS !== "false";

export default async function HomePage() {
  let initialHomepageProperties: HomepagePropertiesResult | null = null;
  let lcpImageUrl: string | null = null;

  if (SSR_LISTINGS_ENABLED) {
    try {
      initialHomepageProperties = await fetchHomepagePropertiesServer({
        neighborhoodFilter: null,
        listingTypeFilter: "rent",
      });
      lcpImageUrl = resolveMobileHomepageLcpImageUrl(initialHomepageProperties);
      if (lcpImageUrl) {
        preload(lcpImageUrl, { as: "image", fetchPriority: "high" });
      }
    } catch (error) {
      console.error("[homepage] server listings fetch failed", error);
    }
  }

  const hasLcpStrip = Boolean(lcpImageUrl);

  return (
    <HomepageLcpOrchestrator
      hasLcpStrip={hasLcpStrip}
      lcpStrip={
        initialHomepageProperties ? (
          <HomepageMobileLcpStrip data={initialHomepageProperties} listingMode="rent" />
        ) : null
      }
    >
      <Suspense fallback={<HomepageLoadShell />}>
        <HomePageContent
          listingMode="rent"
          initialHomepageProperties={initialHomepageProperties}
        />
      </Suspense>
    </HomepageLcpOrchestrator>
  );
}
