type Highlight = { title: string; subtitle: string; icon: "home" | "map" | "calendar" };

/** Three scannable highlights for the BahayGo property page (mobile editorial). */
export function buildBahayGoPropertyHighlights(property: {
  property_type?: string | null;
  beds?: number;
  baths?: number;
  location?: string;
  city?: string | null;
}): Highlight[] {
  const type = String(property.property_type ?? "").trim().toLowerCase();
  const city =
    property.city?.trim() ||
    property.location?.split(",")[0]?.trim() ||
    "Metro Manila";

  const layout =
    property.beds === 0
      ? "Flexible studio layout"
      : property.beds === 1
        ? "Comfortable 1-bedroom layout"
        : `${property.beds}-bedroom living space`;

  const typeLabel = type.includes("condo")
    ? "Condo living"
    : type.includes("house") || type.includes("town")
      ? "House & lot comfort"
      : type.includes("studio")
        ? "Smart studio setup"
        : "Well-proportioned home";

  return [
    {
      title: typeLabel,
      subtitle: layout,
      icon: "home",
    },
    {
      title: "Prime location",
      subtitle: `In ${city}`,
      icon: "map",
    },
    {
      title: "Ready to explore",
      subtitle: `${property.baths ?? "—"} bath · schedule a visit`,
      icon: "calendar",
    },
  ];
}
