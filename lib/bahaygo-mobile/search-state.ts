import type { MarketplaceBrowseIntent } from "@/lib/bahaygo-mobile/browse-intent";
import { BAHAYGO_SEARCH_TRUST_BADGES } from "@/lib/bahaygo-mobile/trust";

/**
 * Mobile search hero state — intent first, filters secondary.
 * Filters are applied via sheet/modal; search CTA is primary.
 */
export type BahayGoMobileSearchState = {
  intent: MarketplaceBrowseIntent;
  locationQuery: string;
  trustBadges: typeof BAHAYGO_SEARCH_TRUST_BADGES;
  filtersOpen: boolean;
};

export function defaultMobileSearchState(
  intent: MarketplaceBrowseIntent = "rent",
): BahayGoMobileSearchState {
  return {
    intent,
    locationQuery: "",
    trustBadges: BAHAYGO_SEARCH_TRUST_BADGES,
    filtersOpen: false,
  };
}
