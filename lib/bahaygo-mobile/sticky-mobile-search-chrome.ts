/** Mobile portal nav: `py-4` + BahayGo/dormspacers lockup (~68px rendered). */
export const MOBILE_PORTAL_NAV_HEIGHT_PX = 68;
export const MOBILE_PORTAL_TOP_NAV_OFFSET = "top-[68px]" as const;

/** Search input + location row under the portal nav (measure + fallback reserve). */
export const MOBILE_SEARCH_STRIP_FALLBACK_PX = 116;

/** Combined nav + search strip — use for scroll-margin / anchor clearance on dormspaces mobile. */
export const MOBILE_DORMSPACE_STICKY_CHROME_SCROLL_MARGIN =
  "scroll-mt-[11.5rem]" as const;

/** Fixed search strip below portal nav — avoids broken `sticky` inside overflow ancestors. */
export const MOBILE_FIXED_SEARCH_CHROME =
  "fixed left-0 right-0 z-30 border-b border-black/[0.06] bg-[#FAF8F4]/95 shadow-[0_4px_12px_rgba(44,44,44,0.06)] backdrop-blur-sm supports-[backdrop-filter]:bg-[#FAF8F4]/90";
