import { HomePageContent } from "@/components/client/home-page-content";
import { homepageFirstHeroImageUrl } from "@/lib/homepage-hero-ssr";
import { fetchHomepagePropertiesServer } from "@/lib/marketplace-home-fetchers-server";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

export default async function HomePage() {
  let initialHomepageProperties: HomepagePropertiesResult | undefined;
  let heroPreloadUrl: string | null = null;

  try {
    initialHomepageProperties = await fetchHomepagePropertiesServer({
      neighborhoodFilter: null,
      listingTypeFilter: "rent",
    });
    heroPreloadUrl = homepageFirstHeroImageUrl(initialHomepageProperties);
  } catch {
    /* Client will fetch via SWR if server fetch fails. */
  }

  return (
    <>
      {heroPreloadUrl ? <link rel="preload" as="image" href={heroPreloadUrl} /> : null}
      <HomePageContent initialHomepageProperties={initialHomepageProperties} />
    </>
  );
}
