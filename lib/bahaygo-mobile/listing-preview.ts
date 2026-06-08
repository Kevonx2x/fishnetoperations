import { formatPropertyPriceDisplay, formatSaleAndRentLines } from "@/lib/format-listing-price";
import { formatPropertyFloorAreaDisplay } from "@/lib/format-property-floor-area";
import { listingListedCompactLabel } from "@/lib/listing-listed-time";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import type { MarketplaceBrowseIntent } from "@/lib/bahaygo-mobile/browse-intent";
import type { AgentTrustSignal } from "@/lib/bahaygo-mobile/agent-trust";
import { agentTrustSignalFromMarketplaceAgent } from "@/lib/bahaygo-mobile/agent-trust";
import type { MarketplaceAgent } from "@/lib/marketplace-types";

/**
 * Everything a user needs to decide interest before opening detail.
 * Hierarchy: price → title → specs → location (detail = depth only).
 */
export type BahayGoListingPreviewCard = {
  id: string;
  href: string;
  intent: MarketplaceBrowseIntent;
  /** Primary display price (respects buy vs rent intent). */
  priceLine: string;
  /** When listing is sale+rent dual. */
  salePriceLine: string | null;
  rentPriceLine: string | null;
  title: string;
  neighborhood: string | null;
  cityLine: string;
  beds: number;
  baths: number;
  areaLabel: string;
  specsLine: string;
  statusPills: string[];
  imageUrls: string[];
  imageCount: number;
  listedAtIso: string;
  listedRelativeLabel: string;
  isSaved: boolean;
  isOwnListing: boolean;
  listingRemoved: boolean;
  agentTrust: AgentTrustSignal | null;
};

function statusPillsFor(property: DbProperty): string[] {
  if (property.is_presale) return ["Presale"];
  if (property.status === "both" || property.listing_type === "both") {
    return ["For Sale", "For Rent"];
  }
  if (property.status === "for_rent") return ["For Rent"];
  return ["For Sale"];
}

function primaryPriceLine(
  property: DbProperty,
  intent: MarketplaceBrowseIntent,
): { priceLine: string; salePriceLine: string | null; rentPriceLine: string | null } {
  const isDual =
    !property.is_presale &&
    (property.status === "both" || property.listing_type === "both");

  if (isDual) {
    const lines = formatSaleAndRentLines(property.price, property.rent_price);
    return {
      priceLine: intent === "rent" ? lines.rent : lines.sale,
      salePriceLine: lines.sale,
      rentPriceLine: lines.rent,
    };
  }

  const status =
    intent === "rent" || property.status === "for_rent" ? "for_rent" : property.status;
  const raw =
    intent === "rent" && property.rent_price?.trim()
      ? property.rent_price
      : property.price;

  return {
    priceLine: formatPropertyPriceDisplay(raw, status),
    salePriceLine: null,
    rentPriceLine: null,
  };
}

function cityLineFor(property: DbProperty): string {
  const city = property.city?.trim();
  const neighborhood = property.neighborhood?.trim();
  if (neighborhood && city) return `${neighborhood}, ${city}`;
  return city || property.location?.trim() || "";
}

export type MapListingPreviewOptions = {
  intent: MarketplaceBrowseIntent;
  isSaved?: boolean;
  isOwnListing?: boolean;
  listingRemoved?: boolean;
  connectedAgents?: MarketplaceAgent[];
};

/** Map DB property → calm, scannable card model for feed + carousel UIs. */
export function mapDbPropertyToListingPreview(
  property: DbProperty,
  options: MapListingPreviewOptions,
): BahayGoListingPreviewCard {
  const urls = roomUrlsFor(property);
  const beds = property.beds ?? 0;
  const baths = property.baths ?? 0;
  const areaDisplay = formatPropertyFloorAreaDisplay(property.sqft);
  const areaLabel = areaDisplay === "—" ? "—" : areaDisplay;
  const specsLine = `${beds ? `${beds} beds` : "Studio"} · ${baths} baths${
    areaLabel !== "—" ? ` · ${areaLabel}` : ""
  }`;
  const prices = primaryPriceLine(property, options.intent);
  const firstAgent = options.connectedAgents?.[0];

  return {
    id: property.id,
    href: `/properties/${encodeURIComponent(property.id)}`,
    intent: options.intent,
    priceLine: prices.priceLine,
    salePriceLine: prices.salePriceLine,
    rentPriceLine: prices.rentPriceLine,
    title: property.name?.trim() || property.location,
    neighborhood: property.neighborhood?.trim() || null,
    cityLine: cityLineFor(property),
    beds,
    baths,
    areaLabel,
    specsLine,
    statusPills: statusPillsFor(property),
    imageUrls: urls,
    imageCount: urls.length,
    listedAtIso: property.created_at,
    listedRelativeLabel: listingListedCompactLabel(property.created_at),
    isSaved: options.isSaved ?? false,
    isOwnListing: options.isOwnListing ?? false,
    listingRemoved: options.listingRemoved ?? false,
    agentTrust: agentTrustSignalFromMarketplaceAgent(firstAgent),
  };
}
