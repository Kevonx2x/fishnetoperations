"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MOBILE_FIXED_SEARCH_CHROME,
  MOBILE_PORTAL_TOP_NAV_OFFSET,
} from "@/lib/bahaygo-mobile/sticky-mobile-search-chrome";

/** Reserve space so content does not sit under the fixed search strip before measure. */
const FALLBACK_SEARCH_STRIP_HEIGHT_PX = 108;

export function MobileFixedSearchShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = useState(FALLBACK_SEARCH_STRIP_HEIGHT_PX);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const syncHeight = () => {
      setSpacerHeight(el.offsetHeight);
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
        style={{ height: spacerHeight }}
        aria-hidden
      />
      <div
        ref={barRef}
        className={cn("md:hidden", MOBILE_FIXED_SEARCH_CHROME, MOBILE_PORTAL_TOP_NAV_OFFSET, className)}
      >
        {children}
      </div>
    </>
  );
}
