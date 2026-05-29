import "server-only";

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: string };

type GeocodeApiResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    partial_match?: boolean;
    geometry?: {
      location?: { lat?: number; lng?: number };
      location_type?: string;
    };
  }>;
};

function googleMapsServerKey(): string | null {
  const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (serverKey) return serverKey;
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim();
  return publicKey || null;
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
  const key = googleMapsServerKey();
  if (!key) {
    return { ok: false, reason: "Missing GOOGLE_MAPS_SERVER_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API" };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);
  url.searchParams.set("region", "ph");

  let payload: GeocodeApiResponse;
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    payload = (await res.json()) as GeocodeApiResponse;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Network error";
    return { ok: false, reason: `Geocoding request failed: ${msg}` };
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
