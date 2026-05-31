import { Suspense } from "react";
import { preload } from "react-dom";

import { HomePageContentLazy } from "@/components/client/home-page-content-lazy";
import { HomepageLcpOrchestrator } from "@/components/client/homepage-lcp-orchestrator";
import { HomepageLcpPreloadLink } from "@/components/marketplace/homepage-lcp-preload-link";
import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";
import { HomepageMobileLcpStrip } from "@/components/marketplace/homepage-mobile-lcp-strip";
import { isHomepageSsrListingsEnabled } from "@/lib/homepage-ssr-config";
import { resolveMobileHomepageLcpImageUrl } from "@/lib/homepage-mobile-lcp";
import { fetchHomepagePropertiesServer } from "@/lib/marketplace-home-fetchers-server";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

export const revalidate = 60;

export default async function HomePage() {
  let initialHomepageProperties: HomepagePropertiesResult | null = null;
  let lcpImageUrl: string | null = null;

  if (isHomepageSsrListingsEnabled()) {
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

  const hasLcpStrip = Boolean(initialHomepageProperties);

  return (
    <>
      {lcpImageUrl ? <HomepageLcpPreloadLink href={lcpImageUrl} /> : null}
      <HomepageLcpOrchestrator
        hasLcpStrip={hasLcpStrip}
        lcpStrip={
          initialHomepageProperties ? (
            <HomepageMobileLcpStrip data={initialHomepageProperties} listingMode="rent" />
          ) : null
        }
      >
        <Suspense fallback={<HomepageLoadShell />}>
          <HomePageContentLazy
            listingMode="rent"
            initialHomepageProperties={initialHomepageProperties}
          />
        </Suspense>
      </HomepageLcpOrchestrator>
    </>
  );
}
