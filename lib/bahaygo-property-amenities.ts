import type { LucideIcon } from "lucide-react";
import {
  Bath,
  BedDouble,
  Building2,
  Car,
  Dumbbell,
  Home,
  Shield,
  Sparkles,
  Trees,
  Waves,
  Wifi,
} from "lucide-react";
import { formatPropertyFloorAreaDisplay } from "@/lib/format-property-floor-area";

export type PropertyAmenity = { label: string; icon: LucideIcon };

const KEYWORD_AMENITIES: { pattern: RegExp; label: string; icon: LucideIcon }[] = [
  { pattern: /\bpool\b/i, label: "Pool access", icon: Waves },
  { pattern: /\bgym\b|fitness/i, label: "Gym & fitness", icon: Dumbbell },
  { pattern: /24\s*\/\s*7|security|gated/i, label: "24/7 security", icon: Shield },
  { pattern: /parking|garage/i, label: "Parking", icon: Car },
  { pattern: /furnished|fully furnished/i, label: "Fully furnished", icon: Sparkles },
  { pattern: /wifi|wi-fi|internet/i, label: "High-speed Wi‑Fi", icon: Wifi },
  { pattern: /balcony|terrace|patio/i, label: "Outdoor space", icon: Trees },
  { pattern: /concierge|lobby/i, label: "Building amenities", icon: Building2 },
];

/** Amenity grid for the BahayGo property detail page (desktop editorial). */
export function buildBahayGoPropertyAmenities(property: {
  description?: string | null;
  beds?: number;
  baths?: number;
  sqft?: string | null;
  property_type?: string | null;
}): PropertyAmenity[] {
  const description = String(property.description ?? "");
  const seen = new Set<string>();
  const items: PropertyAmenity[] = [];

  const add = (label: string, icon: LucideIcon) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ label, icon });
  };

  for (const rule of KEYWORD_AMENITIES) {
    if (rule.pattern.test(description)) add(rule.label, rule.icon);
  }

  if (property.beds != null) {
    add(
      property.beds === 0 ? "Studio layout" : `${property.beds} bedroom${property.beds === 1 ? "" : "s"}`,
      BedDouble,
    );
  }
  if (property.baths != null) {
    add(`${property.baths} bathroom${property.baths === 1 ? "" : "s"}`, Bath);
  }

  const area = formatPropertyFloorAreaDisplay(property.sqft);
  if (area !== "—") add(area, Home);

  const type = String(property.property_type ?? "").trim();
  if (type) add(type.charAt(0).toUpperCase() + type.slice(1), Building2);

  if (items.length < 4) add("High-speed Wi‑Fi", Wifi);
  if (items.length < 6) add("Verified listing", Shield);

  return items.slice(0, 8);
}
