"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { normalizeCity } from "@/lib/normalize-city";
import { cn } from "@/lib/utils";

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
        setOptions({ key: apiKey, v: "weekly", libraries: ["places"] });
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
    </div>
  );
}
