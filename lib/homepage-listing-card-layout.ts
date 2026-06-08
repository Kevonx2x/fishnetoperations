/** Mobile carousel inside a padded parent (e.g. main px-4): bleed + 16px scroll inset. */
export const HOMEPAGE_MOBILE_CAROUSEL_TRACK =
  "max-md:-mx-4 max-md:px-4 max-md:scroll-pl-4 max-md:scroll-pr-4";

/** Mobile carousel on full-width surface (no parent horizontal padding). */
export const HOMEPAGE_MOBILE_CAROUSEL_INSET =
  "max-md:px-4 max-md:scroll-pl-4 max-md:scroll-pr-4";

/** Two listing cards visible on ~375px mobile browse carousels (Airbnb-style). */
export const HOMEPAGE_BROWSE_LISTING_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.5rem)/1.92)] shrink-0 md:w-[232px] lg:w-[244px]";

/** Trulia-style mobile feed: one large card per row with a peek of the next. */
export const HOMEPAGE_MOBILE_FEED_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.75rem)/1.06)] shrink-0 snap-start md:w-[232px] lg:w-[244px]";

/** Mobile “Trending Near You” hero carousel — ~88% viewport with next-slide peek. */
export const HOMEPAGE_MOBILE_TRENDING_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.625rem)/1.22)] shrink-0 snap-start";

/** ~2.5 peek cards per row — mobile “New This Week” carousel. */
export const HOMEPAGE_MOBILE_PEEK_LISTING_CARD_WIDTH =
  "w-[calc((100vw-2rem-1rem)/2.5)] shrink-0 snap-start";

/** Default category rows on mobile home (no Show More). */
export const HOMEPAGE_MOBILE_FEED_ROW_COUNT = 6;

/**
 * Desktop homepage carousel — content-driven height (no stretched body/footer gap).
 */
export const HOMEPAGE_DESKTOP_CARD_HEIGHT_CLASS = "md:h-auto" as const;

export const HOMEPAGE_DESKTOP_CARD_IMAGE_HEIGHT_CLASS =
  "md:h-[8.75rem] md:max-h-[8.75rem] md:min-h-[8.75rem] md:shrink-0" as const;

export const HOMEPAGE_DESKTOP_CARD_BODY_CLASS = "md:flex md:flex-col md:gap-1" as const;

/** Reserved slot hints inside the desktop card body. */
export const HOMEPAGE_DESKTOP_SLOT = {
  price: "md:shrink-0 md:leading-none",
  meta: "md:shrink-0",
  title: "md:shrink-0",
  agentInBody: "md:shrink-0",
  listedRow: "md:shrink-0",
} as const;

export function homepageListingCardCityLabel(property: {
  city?: string | null;
  neighborhood?: string | null;
}): string {
  return property.city?.trim() || property.neighborhood?.trim() || "";
}

export function homepageListingCardSqftLabel(sqft: string | number | null | undefined): string {
  const raw = sqft == null ? "" : String(sqft).trim();
  if (!raw) return "";
  const n = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Math.round(n)} sqft`;
}

/** Invisible placeholder keeps metadata column width when sqft is missing. */
export const HOMEPAGE_DESKTOP_SQFT_PLACEHOLDER = "000 sqft";
