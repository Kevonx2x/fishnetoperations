import "server-only";

import { normalizeBrowseLocationLabel } from "@/lib/browse-location-label";

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: string };

type GeocodeAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GeocodeApiResult = {
  partial_match?: boolean;
  formatted_address?: string;
  address_components?: GeocodeAddressComponent[];
  geometry?: {
    location?: { lat?: number; lng?: number };
    location_type?: string;
  };
};

type GeocodeApiResponse = {
  status?: string;
  error_message?: string;
  results?: GeocodeApiResult[];
};

export type ReverseGeocodeResult =
  | { ok: true; label: string; city: string; neighborhood: string | null }
  | { ok: false; reason: string };

function pickCityFromComponents(components: GeocodeAddressComponent[] | undefined): string {
  if (!components?.length) return "";
  for (const t of ["locality", "administrative_area_level_2"] as const) {
    const c = components.find((x) => x.types?.includes(t));
    const n = c?.long_name?.trim();
    if (n) return n;
  }
  return "";
}

function pickNeighborhoodFromComponents(components: GeocodeAddressComponent[] | undefined): string {
  if (!components?.length) return "";
  for (const t of ["sublocality_level_1", "sublocality", "neighborhood"] as const) {
    const c = components.find((x) => x.types?.includes(t));
    const n = c?.long_name?.trim();
    if (n && !/(^|\b)(barangay|brgy)\b/i.test(n)) return n;
  }
  return "";
}

/** Human-readable label for browse search (area + city when possible). */
export function formatBrowseLocationFromGeocodeResult(result: GeocodeApiResult): string {
  const components = result.address_components ?? [];
  const city = pickCityFromComponents(components);
  const neighborhood = pickNeighborhoodFromComponents(components);
  if (neighborhood && city && neighborhood.toLowerCase() !== city.toLowerCase()) {
    return normalizeBrowseLocationLabel(`${neighborhood}, ${city}`);
  }
  if (city) return normalizeBrowseLocationLabel(city);
  const formatted = result.formatted_address?.trim();
  if (formatted) {
    const parts = formatted.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts[0]) return normalizeBrowseLocationLabel(parts[0]);
  }
  return "Manila";
}

export type GoogleMapsKeySource = "GOOGLE_MAPS_SERVER_KEY" | "NEXT_PUBLIC_GOOGLE_MAPS_API" | "none";

export function resolveGoogleMapsKeySource(): {
  key: string | null;
  source: GoogleMapsKeySource;
} {
  const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (serverKey) return { key: serverKey, source: "GOOGLE_MAPS_SERVER_KEY" };
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim();
  if (publicKey) return { key: publicKey, source: "NEXT_PUBLIC_GOOGLE_MAPS_API" };
  return { key: null, source: "none" };
}

function googleMapsServerKey(): string | null {
  return resolveGoogleMapsKeySource().key;
}

export function maskGeocodeUrl(url: URL): string {
  const masked = new URL(url.toString());
  if (masked.searchParams.has("key")) {
    masked.searchParams.set("key", "***");
  }
  return masked.toString();
}

/** UI-safe failure text — first 100 chars so admins can see the real error class. */
export function truncateGeocodeFailureReason(message: string, max = 100): string {
  if (message.length <= max) return message;
  return message.slice(0, max);
}

/** Build a geocodable address from property columns that exist today. */
export function buildPropertyGeocodeAddress(property: {
  formatted_address?: string | null;
  location?: string | null;
  city?: string | null;
}): string | null {
  const parts: string[] = [];

  const formatted = property.formatted_address?.trim();
  if (formatted) {
    parts.push(formatted);
  } else {
    const location = property.location?.trim();
    if (location) parts.push(location);
  }

  const city = property.city?.trim();
  const joinedSoFar = parts.join(", ");
  if (city && !joinedSoFar.toLowerCase().includes(city.toLowerCase())) {
    parts.push(city);
  }

  const address = parts.filter(Boolean).join(", ").trim();
  if (!address) return null;

  if (!/philippines/i.test(address)) {
    return `${address}, Philippines`;
  }
  return address;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const { key, source } = resolveGoogleMapsKeySource();
  if (!key) {
    return { ok: false, reason: "Missing GOOGLE_MAPS_SERVER_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API" };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);
  url.searchParams.set("region", "ph");

  console.log("[google-geocoding] preparing request", {
    keySource: source,
    keyPresent: Boolean(key),
    keyLength: key.length,
    url: maskGeocodeUrl(url),
    address,
  });

  let payload: GeocodeApiResponse;
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    const bodyText = await res.text();

    if (!res.ok) {
      console.error("[google-geocoding] HTTP response not ok", {
        keySource: source,
        keyLength: key.length,
        url: maskGeocodeUrl(url),
        address,
        status: res.status,
        statusText: res.statusText,
        bodyText: bodyText || null,
      });
    }

    try {
      payload = JSON.parse(bodyText) as GeocodeApiResponse;
    } catch (parseError) {
      const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.error("[google-geocoding] response JSON parse failed", {
        keySource: source,
        keyLength: key.length,
        url: maskGeocodeUrl(url),
        address,
        status: res.status,
        statusText: res.statusText,
        parseMessage,
        parseName: parseError instanceof Error ? parseError.name : undefined,
        parseStack: parseError instanceof Error ? parseError.stack : undefined,
        bodyText: bodyText || null,
      });
      const reason = truncateGeocodeFailureReason(
        `Geocoding request failed: invalid JSON response (${parseMessage})`,
      );
      return { ok: false, reason };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[google-geocoding] fetch failed", {
      keySource: source,
      keyPresent: Boolean(key),
      keyLength: key.length,
      url: maskGeocodeUrl(url),
      address,
      message,
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      cause:
        error instanceof Error && error.cause != null
          ? error.cause instanceof Error
            ? { message: error.cause.message, name: error.cause.name, stack: error.cause.stack }
            : String(error.cause)
          : undefined,
    });
    const reason = truncateGeocodeFailureReason(`Geocoding request failed: ${message}`);
    return { ok: false, reason };
  }

  if (payload.status !== "OK") {
    const detail = payload.error_message ?? payload.status ?? "UNKNOWN";
    return { ok: false, reason: `Geocoding API error: ${detail}` };
  }

  const results = payload.results ?? [];
  if (results.length === 0) {
    return { ok: false, reason: "No geocoding results" };
  }

  if (results.length > 1) {
    return { ok: false, reason: `Ambiguous geocoding result (${results.length} matches)` };
  }

  const lat = results[0]?.geometry?.location?.lat;
  const lng = results[0]?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "Geocoding result missing coordinates" };
  }

  return { ok: true, lat, lng };
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const { key, source } = resolveGoogleMapsKeySource();
  if (!key) {
    return { ok: false, reason: "Missing GOOGLE_MAPS_SERVER_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API" };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", key);
  url.searchParams.set("region", "ph");

  console.log("[google-geocoding] reverse geocode preparing", {
    keySource: source,
    url: maskGeocodeUrl(url),
    lat,
    lng,
  });

  let payload: GeocodeApiResponse;
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    const bodyText = await res.text();
    try {
      payload = JSON.parse(bodyText) as GeocodeApiResponse;
    } catch (parseError) {
      const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
      return {
        ok: false,
        reason: truncateGeocodeFailureReason(
          `Reverse geocoding failed: invalid JSON (${parseMessage})`,
        ),
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: truncateGeocodeFailureReason(`Reverse geocoding request failed: ${message}`),
    };
  }

  if (payload.status !== "OK") {
    const detail = payload.error_message ?? payload.status ?? "UNKNOWN";
    return { ok: false, reason: `Reverse geocoding API error: ${detail}` };
  }

  const result = payload.results?.[0];
  if (!result) {
    return { ok: false, reason: "No reverse geocoding results" };
  }

  const city = pickCityFromComponents(result.address_components);
  const neighborhood = pickNeighborhoodFromComponents(result.address_components) || null;
  const label = formatBrowseLocationFromGeocodeResult(result);

  return { ok: true, label, city: city || label, neighborhood };
}
