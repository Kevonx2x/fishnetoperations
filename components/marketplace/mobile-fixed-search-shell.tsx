"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MOBILE_FIXED_SEARCH_CHROME,
  MOBILE_PORTAL_TOP_NAV_COMPACT_OFFSET,
  MOBILE_PORTAL_TOP_NAV_OFFSET,
} from "@/lib/bahaygo-mobile/sticky-mobile-search-chrome";

export function MobileFixedSearchShell({
  children,
  className,
  topOffsetClass = MOBILE_PORTAL_TOP_NAV_OFFSET,
  compactTopOffset = false,
}: {
  children: ReactNode;
  className?: string;
  /** Tailwind `top-*` offset below the sticky portal nav (dormspacers uses a taller lockup). */
  topOffsetClass?: string;
  /** Slightly shorter homepage nav — keeps the search strip tucked closer. */
  compactTopOffset?: boolean;
}) {
  return (
    <div
      className={cn(
        "md:hidden",
        MOBILE_FIXED_SEARCH_CHROME,
        compactTopOffset ? MOBILE_PORTAL_TOP_NAV_COMPACT_OFFSET : topOffsetClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
