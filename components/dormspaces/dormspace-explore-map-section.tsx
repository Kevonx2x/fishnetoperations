"use client";

import { useMemo } from "react";

import { DormspaceHomeSectionHeader } from "@/components/dormspaces/dormspace-home-section-header";
import { DormspaceListingsMap } from "@/components/dormspaces/dormspace-listings-map";
import { dormspaceListingMapMarkers } from "@/lib/dormspace-map-markers";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";

export function DormspaceExploreMapSection({ listings }: { listings: DormspaceWithPhotos[] }) {
  const markers = useMemo(() => dormspaceListingMapMarkers(listings), [listings]);

  return (
    <section className="hidden bg-[#FAF8F4] py-12 md:block lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-6">
        <DormspaceHomeSectionHeader
          title="Explore on the map"
          subtitle="Browse dormspaces by location"
        />

        <div className="mt-8 overflow-hidden rounded-2xl border border-[#2C2C2C]/10 shadow-sm">
          <DormspaceListingsMap
            markers={markers}
            showCountLabel={false}
            className="h-[400px] min-h-0 lg:h-[500px]"
          />
        </div>
      </div>
    </section>
  );
}
