/** Mobile portal nav: default ~68px; compact home ~58px (excluding safe-area inset). */
export const MOBILE_PORTAL_NAV_HEIGHT_PX = 68;
export const MOBILE_PORTAL_NAV_COMPACT_HEIGHT_PX = 58;
export const MOBILE_PORTAL_TOP_NAV_OFFSET =
  "top-[calc(68px+env(safe-area-inset-top,0px))]" as const;
export const MOBILE_PORTAL_TOP_NAV_COMPACT_OFFSET =
  "top-[calc(58px+env(safe-area-inset-top,0px))]" as const;

/** Dormspacers nav: two-line lockup (BahayGo + dormspacers tag) under the same `py-4` bar. */
export const MOBILE_DORMSPACE_PORTAL_NAV_HEIGHT_PX = 76;
export const MOBILE_DORMSPACE_PORTAL_TOP_OFFSET =
  "top-[calc(76px+env(safe-area-inset-top,0px))]" as const;

/** Search input + location row under the portal nav (fallback for legacy callers). */
export const MOBILE_SEARCH_STRIP_FALLBACK_PX = 116;

/** Unified mobile dormspacers home chrome: logo + search + location stick together. */
export const MOBILE_DORMSPACE_UNIFIED_STICKY_CHROME =
  "sticky top-0 z-50 w-full border-b border-black/[0.06] bg-[#FAF8F4]/95 pt-[env(safe-area-inset-top,0px)] shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-[#FAF8F4]/90";

/** Anchor clearance below unified dormspacers sticky chrome on mobile. */
export const MOBILE_DORMSPACE_STICKY_CHROME_SCROLL_MARGIN =
  "scroll-mt-[calc(76px+116px+env(safe-area-inset-top,0px))]" as const;

/** Sticky search strip — stays in document flow and pins below the portal nav while scrolling. */
export const MOBILE_FIXED_SEARCH_CHROME =
  "sticky z-30 w-full border-b border-black/[0.06] bg-[#FAF8F4]/95 shadow-[0_4px_12px_rgba(44,44,44,0.06)] backdrop-blur-sm supports-[backdrop-filter]:bg-[#FAF8F4]/90";

/** Horizontal carousels on mobile — contain x-overscroll so vertical page scroll stays smooth. */
export const MOBILE_HORIZONTAL_SCROLL_STYLE = {
  WebkitOverflowScrolling: "touch",
  overscrollBehaviorX: "contain",
} as const;

export const MOBILE_DORMSPACE_CAROUSEL_TRACK =
  "mt-2.5 flex min-w-0 overflow-x-auto overflow-y-visible px-4 pb-0.5 scrollbar-hide snap-x snap-proximity scroll-pl-4 scroll-pr-4";
