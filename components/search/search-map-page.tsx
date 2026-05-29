"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

import { SearchMapApiGate } from "@/components/search/search-map-api-gate";
import { SearchMapCanvas } from "@/components/search/search-map-canvas";
import {
  SearchMapHeader,
  type SearchMapLocationFocus,
} from "@/components/search/search-map-header";
import type { SearchMapProperty } from "@/lib/search-map-markers";
import { cn } from "@/lib/utils";

/** Matches MobileBottomNav height (h-14 + py-2 = 5rem). */
const MOBILE_BOTTOM_NAV_OFFSET = "calc(5rem + env(safe-area-inset-bottom, 0px))";

export function SearchMapPage({ markers: properties }: { markers: SearchMapProperty[] }) {
  const [locationFocus, setLocationFocus] = useState<SearchMapLocationFocus | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";

  const handleLocationFocus = useCallback((focus: SearchMapLocationFocus) => {
    setLocationFocus(focus);
  }, []);

  const shell = (
    <>
      <SearchMapHeader onLocationFocus={handleLocationFocus} />
      <div className="relative z-0 min-h-0 flex-1">
        {apiKey ? (
          <SearchMapApiGate className="absolute inset-0">
            <SearchMapCanvas
              className="absolute inset-0"
              properties={properties}
              locationFocus={locationFocus}
            />
          </SearchMapApiGate>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#E8F0E9] px-6 text-center">
            <p className="text-sm font-semibold text-[#2C2C2C]">Map unavailable</p>
            <p className="mt-1 max-w-xs text-xs font-medium text-[#888888]">
              Add{" "}
              <code className="rounded bg-white/70 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API</code> to enable
              the search map.
            </p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        /* Fixed above mobile bottom nav — avoids visualViewport resize glitches after sheet dismiss. */
        "fixed inset-x-0 top-0 z-10 flex flex-col overflow-hidden bg-[#FAF8F4]",
        "bottom-[var(--search-map-bottom-offset)] md:static md:z-auto md:h-dvh md:max-h-dvh md:bottom-auto",
      )}
      style={
        {
          "--search-map-bottom-offset": MOBILE_BOTTOM_NAV_OFFSET,
        } as CSSProperties
      }
    >
      {apiKey ? <APIProvider apiKey={apiKey}>{shell}</APIProvider> : shell}
    </div>
  );
}
