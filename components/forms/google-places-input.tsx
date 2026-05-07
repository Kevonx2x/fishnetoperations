"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import {
  AdvancedMarker,
  APIProvider,
  Map,
  Marker,
  Pin,
  useApiIsLoaded,
  useMarkerRef,
} from "@vis.gl/react-google-maps";
import { normalizeCity } from "@/lib/normalize-city";
import { cn } from "@/lib/utils";

const SAGE_MAP_PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56"><path fill="#6B9E6E" stroke="#3d6b40" stroke-width="1.5" d="M22 4C13.2 4 6.3 10.6 6.3 19c0 11.2 15.7 31.8 15.7 31.8S37.7 30.2 37.7 19C37.7 10.6 30.8 4 22 4zm0 24.5a9.5 9.5 0 110-19 9.5 9.5 0 010 19z"/></svg>`,
);

function FormAddressClassicMarker({ center }: { center: { lat: number; lng: number } }) {
  const mapReady = useApiIsLoaded();
  const [markerRef] = useMarkerRef();
  const icon = useMemo((): google.maps.Icon | undefined => {
    if (!mapReady || typeof google === "undefined") return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${SAGE_MAP_PIN_SVG}`,
      scaledSize: new google.maps.Size(44, 56),
      anchor: new google.maps.Point(22, 56),
    };
  }, [mapReady]);

  return (
    <Marker
      ref={markerRef}
      position={center}
      title="Selected location"
      {...(icon ? { icon } : {})}
    />
  );
}

function FormAddressMapPreview({
  apiKey,
  center,
  mapInstanceId,
}: {
  apiKey: string;
  center: { lat: number; lng: number };
  mapInstanceId: string;
}) {
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  const useAdvancedMarker = Boolean(mapId);

  return (
    <div className="absolute inset-0">
      <APIProvider apiKey={apiKey}>
        <Map
          id={mapInstanceId}
          center={center}
          zoom={16}
          gestureHandling="greedy"
          mapTypeId="roadmap"
          className="h-full w-full"
          {...(useAdvancedMarker ? { mapId } : {})}
        >
          {useAdvancedMarker ? (
            <AdvancedMarker position={center} title="Selected location">
              <Pin background="#6B9E6E" borderColor="#3d6b40" glyphColor="#ffffff" />
            </AdvancedMarker>
          ) : (
            <FormAddressClassicMarker center={center} />
          )}
        </Map>
      </APIProvider>
    </div>
  );
}

export type GooglePlaceSelectedPayload = {
  location: string;
  formatted_address: string | null;
  place_id: string | null;
  lat: number;
  lng: number;
  /** City label derived from address_components or normalizeCity(location). */
  city: string;
  /** Region/province derived from address_components (administrative_area_level_1). */
  region: string | null;
  /**
   * Neighborhood derived from address_components (sublocality/neighborhood).
   * Null when missing or too generic (e.g. barangay).
   */
  neighborhood: string | null;
};

const MANILA_BIAS_SW = { lat: 14.4, lng: 120.9 };
const MANILA_BIAS_NE = { lat: 14.8, lng: 121.2 };

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
  // Better omit than clutter: avoid generic barangay labels.
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

function placeToPayload(place: google.maps.places.PlaceResult): GooglePlaceSelectedPayload | null {
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

export type GooglePlacesInputProps = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (payload: GooglePlaceSelectedPayload) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  name?: string;
  required?: boolean;
  /** Renders a fixed-height map preview under the input when coordinates exist. */
  addressMapPreview?: boolean;
  /** Last selected coordinates; `null` shows the “select an address” placeholder. */
  mapPreviewCenter?: { lat: number; lng: number } | null;
  /** Distinct `Map` id when multiple previews can exist (e.g. new listing vs edit). */
  mapPreviewInstanceId?: string;
};

export function GooglePlacesInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Search address…",
  disabled = false,
  className,
  inputClassName,
  id: idProp,
  name,
  required,
  addressMapPreview = false,
  mapPreviewCenter = null,
  mapPreviewInstanceId = "listing-address-map-preview",
}: GooglePlacesInputProps) {
  const genId = useId();
  const inputId = idProp ?? genId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const mapsOptionsKeyRef = useRef<string | null>(null);

  const [mode, setMode] = useState<"loading" | "maps" | "fallback">("loading");

  const apiKey = useMemo(() => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "", []);

  const bindAutocomplete = useCallback(() => {
    const el = inputRef.current;
    if (!el || typeof google === "undefined" || !google.maps?.places) return;

    if (acRef.current) {
      if (listenerRef.current) {
        google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
      google.maps.event.clearInstanceListeners(acRef.current);
      acRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds(MANILA_BIAS_SW, MANILA_BIAS_NE);
    const ac = new google.maps.places.Autocomplete(el, {
      componentRestrictions: { country: "ph" },
      bounds,
      strictBounds: false,
    });
    ac.setFields(["formatted_address", "geometry", "name", "place_id", "address_components"]);

    listenerRef.current = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const payload = placeToPayload(place);
      if (!payload) return;
      onPlaceSelected(payload);
    });
    acRef.current = ac;
  }, [onPlaceSelected]);

  useEffect(() => {
    if (!apiKey) {
      setMode("fallback");
      return;
    }

    let cancelled = false;
    try {
      if (mapsOptionsKeyRef.current !== apiKey) {
        setOptions({ key: apiKey, v: "weekly", libraries: ["places", "maps", "marker"] });
        mapsOptionsKeyRef.current = apiKey;
      }
    } catch {
      if (!cancelled) setMode("fallback");
      return () => {
        cancelled = true;
      };
    }

    importLibrary("places")
      .then(() => {
        if (cancelled) return;
        setMode("maps");
      })
      .catch(() => {
        if (cancelled) return;
        setMode("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (mode !== "maps") return;
    bindAutocomplete();
    return () => {
      if (acRef.current && typeof google !== "undefined" && google.maps?.event) {
        if (listenerRef.current) {
          google.maps.event.removeListener(listenerRef.current);
          listenerRef.current = null;
        }
        google.maps.event.clearInstanceListeners(acRef.current);
      }
      acRef.current = null;
    };
  }, [mode, bindAutocomplete]);

  const effectivePlaceholder =
    mode === "loading" && apiKey ? "Loading place search…" : placeholder;
  const showLoadingStyle = mode === "loading" && apiKey;

  const previewCenterOk =
    mapPreviewCenter != null &&
    Number.isFinite(mapPreviewCenter.lat) &&
    Number.isFinite(mapPreviewCenter.lng);

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        required={required}
        autoComplete="off"
        disabled={disabled || (mode === "loading" && Boolean(apiKey))}
        value={value}
        placeholder={effectivePlaceholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          inputClassName,
          showLoadingStyle && "italic text-gray-500 placeholder:text-gray-500 placeholder:italic",
        )}
      />
      {addressMapPreview ? (
        <div
          className={cn(
            "relative mt-2 h-[200px] w-full overflow-hidden rounded-xl ring-1 ring-black/10",
            previewCenterOk ? "bg-white" : "bg-[#FAF8F4]",
          )}
          aria-label="Address map preview"
        >
          {!apiKey ? (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm font-medium text-[#2C2C2C]/55">
              Map preview needs <code className="mx-1 rounded bg-black/5 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API</code>.
            </div>
          ) : previewCenterOk ? (
            <FormAddressMapPreview
              apiKey={apiKey}
              center={{ lat: mapPreviewCenter.lat, lng: mapPreviewCenter.lng }}
              mapInstanceId={mapPreviewInstanceId}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm font-medium text-[#2C2C2C]/55">
              Map will appear here after selecting an address
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
