"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MOBILE_FIXED_SEARCH_CHROME,
  MOBILE_PORTAL_TOP_NAV_OFFSET,
  MOBILE_SEARCH_STRIP_FALLBACK_PX,
} from "@/lib/bahaygo-mobile/sticky-mobile-search-chrome";

/** Reserve space so content does not sit under the fixed search strip before measure. */
const SPACER_BUFFER_PX = 6;

export function MobileFixedSearchShell({
  children,
  className,
  topOffsetClass = MOBILE_PORTAL_TOP_NAV_OFFSET,
}: {
  children: ReactNode;
  className?: string;
  /** Tailwind `top-*` offset below the sticky portal nav (dormspacers uses a taller lockup). */
  topOffsetClass?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = useState(MOBILE_SEARCH_STRIP_FALLBACK_PX);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const syncHeight = () => {
      const measured = el.offsetHeight;
      const next = Math.max(
        MOBILE_SEARCH_STRIP_FALLBACK_PX,
        measured > 0 ? measured + SPACER_BUFFER_PX : MOBILE_SEARCH_STRIP_FALLBACK_PX,
      );
      setSpacerHeight(next);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        className="md:hidden"
        style={{ height: spacerHeight, minHeight: MOBILE_SEARCH_STRIP_FALLBACK_PX }}
        aria-hidden
      />
      <div
        ref={barRef}
        className={cn("md:hidden", MOBILE_FIXED_SEARCH_CHROME, topOffsetClass, className)}
      >
        {children}
      </div>
    </>
  );
}
