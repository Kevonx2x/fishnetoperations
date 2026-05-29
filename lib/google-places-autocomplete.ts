import { normalizeCity } from "@/lib/normalize-city";

export type GooglePlaceSelectedPayload = {
  location: string;
  formatted_address: string | null;
  place_id: string | null;
  lat: number;
  lng: number;
  city: string;
  region: string | null;
  neighborhood: string | null;
};

export const MANILA_PLACES_BIAS_SW = { lat: 14.4, lng: 120.9 };
export const MANILA_PLACES_BIAS_NE = { lat: 14.8, lng: 121.2 };

function pickCityLongName(components: google.maps.GeocoderAddressComponent[] | undefined): string {
  if (!components?.length) return "";
  for (const t of ["locality", "administrative_area_level_2"] as const) {
    const c = components.find((x) => x.types.includes(t));
    const n = c?.long_name?.trim();
    if (n) return n;
  }
  return "";
}

function stripSuffix(s: string, suffix: string) {
  const t = s.trim();
  const re = new RegExp(`\\s+${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  return t.replace(re, "").trim();
}

function pickRegionLongName(components: google.maps.GeocoderAddressComponent[] | undefined): string {
  if (!components?.length) return "";
  const c = components.find((x) => x.types.includes("administrative_area_level_1"));
  return c?.long_name?.trim() ?? "";
}

function normalizeRegion(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower === "national capital region" || lower === "ncr") return "Metro Manila";
  if (lower.includes("metro manila")) return "Metro Manila";
  const stripped = stripSuffix(stripSuffix(t, "Region"), "Province");
  return stripped;
}

function pickNeighborhoodLongName(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): string {
  if (!components?.length) return "";
  for (const t of ["sublocality_level_1", "sublocality", "neighborhood"] as const) {
    const c = components.find((x) => x.types.includes(t));
    const n = c?.long_name?.trim();
    if (n) return n;
  }
  return "";
}

function normalizeNeighborhood(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/(^|\b)(barangay|brgy)\b/i.test(t)) return "";
  if (/^\d+$/i.test(t)) return "";
  if (/^barangay\s*\d+$/i.test(t)) return "";
  return t;
}

function buildLocationLine(place: google.maps.places.PlaceResult): string {
  const name = (place.name ?? "").trim();
  const cityRaw = pickCityLongName(place.address_components);
  const formatted = (place.formatted_address ?? "").trim();

  if (name && cityRaw && name.toLowerCase() !== cityRaw.toLowerCase()) {
    return `${name}, ${cityRaw}`;
  }
  if (name) return name;
  if (formatted) {
    const parts = formatted.split(",").map((s) => s.trim()).filter(Boolean);
    if (cityRaw && parts[0] && parts[0].toLowerCase() !== cityRaw.toLowerCase()) {
      return `${parts[0]}, ${cityRaw}`;
    }
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return parts[0] ?? formatted;
  }
  return cityRaw;
}

export function placeResultToPayload(
  place: google.maps.places.PlaceResult,
): GooglePlaceSelectedPayload | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  const lat = loc.lat();
  const lng = loc.lng();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const location = buildLocationLine(place).trim() || (place.formatted_address ?? "").trim();
  if (!location) return null;

  const cityRaw = pickCityLongName(place.address_components);
  const cityClean = cityRaw ? stripSuffix(cityRaw, "City") : "";
  const city = cityClean ? cityClean : normalizeCity(location);

  const regionRaw = pickRegionLongName(place.address_components);
  const regionClean = regionRaw ? normalizeRegion(regionRaw) : "";

  const neighborhoodRaw = pickNeighborhoodLongName(place.address_components);
  const neighborhoodClean = neighborhoodRaw ? normalizeNeighborhood(neighborhoodRaw) : "";

  return {
    location,
    formatted_address: place.formatted_address?.trim() || null,
    place_id: place.place_id?.trim() || null,
    lat,
    lng,
    city,
    region: regionClean || null,
    neighborhood: neighborhoodClean || null,
  };
}

/** Attach legacy Places Autocomplete to an input. Caller must ensure `places` library is loaded. */
export function attachPlacesAutocomplete(
  input: HTMLInputElement,
  onPlaceSelected: (payload: GooglePlaceSelectedPayload) => void,
): () => void {
  const bounds = new google.maps.LatLngBounds(MANILA_PLACES_BIAS_SW, MANILA_PLACES_BIAS_NE);
  const ac = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: "ph" },
    bounds,
    strictBounds: false,
  });
  ac.setFields(["formatted_address", "geometry", "name", "place_id", "address_components"]);

  const listener = ac.addListener("place_changed", () => {
    const payload = placeResultToPayload(ac.getPlace());
    if (payload) onPlaceSelected(payload);
  });

  return () => {
    google.maps.event.removeListener(listener);
    google.maps.event.clearInstanceListeners(ac);
  };
}
