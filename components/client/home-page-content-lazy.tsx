"use client";

import dynamic from "next/dynamic";

import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";
import type { HomepagePropertiesResult } from "@/lib/marketplace-home-fetchers";

const HomePageContent = dynamic(
  () =>
    import("@/components/client/home-page-content").then((m) => ({
      default: m.HomePageContent,
    })),
  {
    ssr: false,
    loading: () => (
      <>
        <div className="hidden md:block">
          <HomepageLoadShell />
        </div>
      </>
    ),
  },
);

type Props = {
  listingMode?: "buy" | "rent" | "all";
  initialHomepageProperties?: HomepagePropertiesResult | null;
};

/** Deferred client boundary — keeps Turbopack from bundling the marketplace on first `/` compile. */
export function HomePageContentLazy(props: Props) {
  return <HomePageContent {...props} />;
}
