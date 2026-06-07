/** Dormspacers browse carousel — aligned with BahayGo compact widths. */
export const DORMSPACE_LISTING_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.5rem)/2)] shrink-0 md:w-[216px] lg:w-[224px]";

/** Natural card height — content-driven; carousel stretch fills via body footer panel. */
export const DORMSPACE_DESKTOP_CARD_HEIGHT_CLASS = "md:h-full" as const;

export const DORMSPACE_DESKTOP_CARD_IMAGE_HEIGHT_CLASS =
  "md:h-[9.25rem] md:max-h-[9.25rem] md:min-h-[9.25rem] md:shrink-0" as const;

export const DORMSPACE_DESKTOP_CARD_BODY_CLASS =
  "flex min-h-0 flex-1 flex-col max-md:flex-none" as const;
