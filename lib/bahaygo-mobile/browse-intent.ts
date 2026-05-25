/** Buy vs rent — drives search, pricing display, and feed curation. */
export type MarketplaceBrowseIntent = "buy" | "rent";

export function browseIntentFromListingMode(
  mode: "buy" | "rent" | "all",
): MarketplaceBrowseIntent {
  return mode === "buy" ? "buy" : "rent";
}

export function recommendedSectionTitle(intent: MarketplaceBrowseIntent): string {
  return intent === "rent" ? "Recommended Rentals" : "Recommended For Sale";
}
