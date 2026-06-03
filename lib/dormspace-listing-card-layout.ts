/** Dormspacers browse carousel — aligned with BahayGo compact widths. */
export const DORMSPACE_LISTING_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.625rem)/2)] shrink-0 md:w-[200px] lg:w-[208px]";

/**
 * Desktop dorm carousel — fixed geometry (layout stability).
 * Grid layout unchanged; only scale and reserved slots tightened.
 */
export const DORMSPACE_DESKTOP_CARD_HEIGHT_CLASS = "md:h-[20.5rem]" as const;

export const DORMSPACE_DESKTOP_CARD_IMAGE_HEIGHT_CLASS =
  "md:h-[7.75rem] md:max-h-[7.75rem] md:min-h-[7.75rem] md:shrink-0" as const;

export const DORMSPACE_DESKTOP_CARD_BODY_CLASS = "md:min-h-0 md:flex-1 md:flex md:flex-col" as const;

export const DORMSPACE_DESKTOP_SLOT = {
  price: "md:h-5 md:shrink-0",
  title: "md:min-h-[2.25rem] md:shrink-0",
  meta: "md:h-4 md:shrink-0",
  location: "md:h-4 md:shrink-0",
  walk: "md:h-4 md:shrink-0",
  landlord: "md:h-[2.625rem] md:shrink-0",
} as const;

/** Keeps walk-times row width when no universities are linked. */
export const DORMSPACE_DESKTOP_WALK_PLACEHOLDER = "0 min walk";
