import type { BuiltHomepageRow } from "@/lib/homepage-row-templates";
import type { BahayGoListingPreviewCard } from "@/lib/bahaygo-mobile/listing-preview";
import { mapDbPropertyToListingPreview } from "@/lib/bahaygo-mobile/listing-preview";
import type { MarketplaceBrowseIntent } from "@/lib/bahaygo-mobile/browse-intent";
import type { MarketplaceAgent } from "@/lib/marketplace-types";

export type BahayGoFeedModuleKind =
  | "recommended"
  | "newly_listed"
  | "category"
  | "featured";

export type BahayGoFeedModule = {
  id: string;
  kind: BahayGoFeedModuleKind;
  title: string;
  subtitle: string | null;
  /** Mobile: hide subtitle for calmer scroll (desktop may still show). */
  showSubtitleOnMobile: boolean;
  seeAllHref: string | null;
  listings: BahayGoListingPreviewCard[];
};

function moduleKindFromRowKey(key: string, title: string): BahayGoFeedModuleKind {
  const k = key.toLowerCase();
  const t = title.toLowerCase();
  if (k.includes("newly") || t.includes("newly listed")) return "newly_listed";
  if (k.includes("featured") || rowIsFeatured(title)) return "featured";
  if (t.includes("recommended")) return "recommended";
  return "category";
}

function rowIsFeatured(title: string): boolean {
  return title.toLowerCase().includes("featured");
}

export type BuildFeedModulesOptions = {
  intent: MarketplaceBrowseIntent;
  rows: BuiltHomepageRow[];
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  savedPropertyIds?: Set<string>;
  viewerUserId?: string | null;
  isListingRemoved?: (propertyId: string) => boolean;
};

/**
 * Curated feed modules — not a flat search grid.
 * Powers calm, modular home scroll with "See all" per section.
 */
export function buildBahayGoFeedModules(options: BuildFeedModulesOptions): BahayGoFeedModule[] {
  const {
    intent,
    rows,
    connectedAgentsByPropertyId,
    savedPropertyIds,
    viewerUserId,
    isListingRemoved,
  } = options;

  return rows.map((row) => {
    const kind = moduleKindFromRowKey(row.key, row.title);
    const listings = row.items.map((p) => {
      const agents = connectedAgentsByPropertyId.get(p.id) ?? [];
      const isOwn =
        !!viewerUserId &&
        agents.some((a) => a.userId === viewerUserId);
      return mapDbPropertyToListingPreview(p, {
        intent,
        isSaved: savedPropertyIds?.has(p.id) ?? false,
        isOwnListing: isOwn,
        listingRemoved: isListingRemoved?.(p.id) ?? false,
        connectedAgents: agents,
      });
    });

    return {
      id: row.key,
      kind,
      title: row.title,
      subtitle: row.subtitle?.trim() ? row.subtitle : null,
      showSubtitleOnMobile: false,
      seeAllHref: row.items.length >= 8 ? "/#listings" : null,
      listings,
    };
  });
}
