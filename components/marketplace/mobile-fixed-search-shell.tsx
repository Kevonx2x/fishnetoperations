"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MOBILE_FIXED_SEARCH_CHROME,
  MOBILE_PORTAL_TOP_NAV_OFFSET,
} from "@/lib/bahaygo-mobile/sticky-mobile-search-chrome";

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
  return (
    <div className={cn("md:hidden", MOBILE_FIXED_SEARCH_CHROME, topOffsetClass, className)}>
      {children}
    </div>
  );
}
