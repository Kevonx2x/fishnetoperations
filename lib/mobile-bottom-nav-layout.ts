/** Measured height of the full mobile footer chrome (sticky slot + nav). Set by `MobileBottomChrome`. */
export const MOBILE_BOTTOM_CHROME_HEIGHT_VAR = "--bahaygo-mobile-bottom-chrome-height" as const;

/** Nav-only height (sticky slot + nav). Legacy name kept for teasers / map offset. */
export const MOBILE_BOTTOM_NAV_HEIGHT_VAR = "--bahaygo-mobile-bottom-nav-height" as const;

export const MOBILE_BOTTOM_NAV_OFFSET_FALLBACK_CSS =
  "calc(4rem + env(safe-area-inset-bottom))" as const;

/** Distance from viewport bottom to top of bottom nav (nav-only pages). */
export const MOBILE_BOTTOM_NAV_OFFSET_CSS = `var(${MOBILE_BOTTOM_NAV_HEIGHT_VAR}, ${MOBILE_BOTTOM_NAV_OFFSET_FALLBACK_CSS})` as const;

/** Scroll padding when sticky actions sit in the mobile footer chrome. */
export const MOBILE_CONTENT_PAD_WITH_STICKY_ACTIONS_CLASS =
  `max-md:pb-[var(${MOBILE_BOTTOM_CHROME_HEIGHT_VAR},calc(4rem+4.25rem+env(safe-area-inset-bottom)))]` as const;
