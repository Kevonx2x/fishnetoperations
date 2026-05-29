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
import {
  attachPlacesAutocomplete,
  placeResultToPayload,
  type GooglePlaceSelectedPayload,
} from "@/lib/google-places-autocomplete";
import { cn } from "@/lib/utils";

export type { GooglePlaceSelectedPayload };

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
  const detachRef = useRef<(() => void) | null>(null);
  const mapsOptionsKeyRef = useRef<string | null>(null);

  const [mode, setMode] = useState<"loading" | "maps" | "fallback">("loading");

  const apiKey = useMemo(() => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "", []);

  const bindAutocomplete = useCallback(() => {
    const el = inputRef.current;
    if (!el || typeof google === "undefined" || !google.maps?.places) return;

    detachRef.current?.();
    detachRef.current = attachPlacesAutocomplete(el, onPlaceSelected);
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
      detachRef.current?.();
      detachRef.current = null;
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

// Preserve named export used by tests or re-exports
export { placeResultToPayload as placeToPayload };
