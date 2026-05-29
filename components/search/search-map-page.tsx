"use client";

import { useEffect, useState } from "react";

import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { SearchMapCanvas } from "@/components/search/search-map-canvas";
import type { SearchMapMarker } from "@/lib/search-map-markers";
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

export function SearchMapPage({ markers }: { markers: SearchMapMarker[] }) {
  const { height: viewportHeight, isMobile } = useVisualViewportHeight();

  const mobileShellStyle =
    isMobile && viewportHeight != null
      ? {
          height: `calc(${viewportHeight}px - ${MOBILE_BOTTOM_NAV_CLEARANCE} - env(safe-area-inset-bottom, 0px))`,
          maxHeight: `calc(${viewportHeight}px - ${MOBILE_BOTTOM_NAV_CLEARANCE} - env(safe-area-inset-bottom, 0px))`,
        }
      : undefined;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col overflow-hidden bg-[#FAF8F4]",
        "max-md:h-[calc(100dvh-5rem-env(safe-area-inset-bottom,0px))]",
        "md:h-dvh md:max-h-dvh",
      )}
      style={mobileShellStyle}
    >
      <MaddenTopNav />
      <div className="relative min-h-0 flex-1">
        <SearchMapCanvas className="absolute inset-0" markers={markers} />
      </div>
    </div>
  );
}
