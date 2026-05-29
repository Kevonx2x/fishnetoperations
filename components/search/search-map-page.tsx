"use client";

import { useCallback, useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

import { SearchMapCanvas } from "@/components/search/search-map-canvas";
import {
  SearchMapHeader,
  type SearchMapLocationFocus,
} from "@/components/search/search-map-header";
import type { SearchMapProperty } from "@/lib/search-map-markers";
import { cn } from "@/lib/utils";

/** Matches MobileLayoutChrome bottom-nav clearance (`pb-[80px]`). */
const MOBILE_BOTTOM_NAV_CLEARANCE = "5rem";

function useVisualViewportHeight() {
  const [height, setHeight] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");

    const update = () => {
      setIsMobile(mq.matches);
      setHeight(window.visualViewport?.height ?? window.innerHeight);
    };

    update();
    mq.addEventListener("change", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return { height, isMobile };
}

export function SearchMapPage({ markers: properties }: { markers: SearchMapProperty[] }) {
  const { height: viewportHeight, isMobile } = useVisualViewportHeight();
  const [locationFocus, setLocationFocus] = useState<SearchMapLocationFocus | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";

  const handleLocationFocus = useCallback((focus: SearchMapLocationFocus) => {
    setLocationFocus(focus);
  }, []);

  const mobileShellStyle =
    isMobile && viewportHeight != null
      ? {
          height: `calc(${viewportHeight}px - ${MOBILE_BOTTOM_NAV_CLEARANCE} - env(safe-area-inset-bottom, 0px))`,
          maxHeight: `calc(${viewportHeight}px - ${MOBILE_BOTTOM_NAV_CLEARANCE} - env(safe-area-inset-bottom, 0px))`,
        }
      : undefined;

  const shell = (
    <>
      <SearchMapHeader onLocationFocus={handleLocationFocus} />
      <div className="relative min-h-0 flex-1">
        {apiKey ? (
          <SearchMapCanvas
            className="absolute inset-0"
            properties={properties}
            locationFocus={locationFocus}
          />
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
        "flex w-full min-w-0 flex-col overflow-hidden bg-[#FAF8F4]",
        "max-md:h-[calc(100dvh-5rem-env(safe-area-inset-bottom,0px))]",
        "md:h-dvh md:max-h-dvh",
      )}
      style={mobileShellStyle}
    >
      {apiKey ? <APIProvider apiKey={apiKey}>{shell}</APIProvider> : shell}
    </div>
  );
}
