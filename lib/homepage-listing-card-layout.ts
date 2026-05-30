/** Mobile carousel inside a padded parent (e.g. main px-4): bleed + 16px scroll inset. */
export const HOMEPAGE_MOBILE_CAROUSEL_TRACK =
  "max-md:-mx-4 max-md:px-4 max-md:scroll-pl-4 max-md:scroll-pr-4";

/** Mobile carousel on full-width surface (no parent horizontal padding). */
export const HOMEPAGE_MOBILE_CAROUSEL_INSET =
  "max-md:px-4 max-md:scroll-pl-4 max-md:scroll-pr-4";

/** Two listing cards visible on ~375px mobile browse carousels (Airbnb-style). */
export const HOMEPAGE_BROWSE_LISTING_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.625rem)/2)] shrink-0 md:w-[232px] lg:w-[240px]";

/** Trulia-style mobile feed: one large card per row with a peek of the next. */
export const HOMEPAGE_MOBILE_FEED_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.75rem)/1.06)] shrink-0 snap-start md:w-[232px] lg:w-[240px]";

/** Mobile “Trending Near You” hero carousel — ~88% viewport with next-slide peek. */
export const HOMEPAGE_MOBILE_TRENDING_CARD_WIDTH =
  "w-[calc((100vw-2rem-0.625rem)/1.22)] shrink-0 snap-start";

/** ~2.5 peek cards per row — mobile “New This Week” carousel. */
export const HOMEPAGE_MOBILE_PEEK_LISTING_CARD_WIDTH =
  "w-[calc((100vw-2rem-1rem)/2.5)] shrink-0 snap-start";

/** Default category rows on mobile home (no Show More). */
export const HOMEPAGE_MOBILE_FEED_ROW_COUNT = 6;
