"use client";

import { memo, useEffect, useMemo } from "react";
import {
  AdvancedMarker,
  APIProvider,
  Map,
  Marker,
  Pin,
  useApiIsLoaded,
  useMap,
} from "@vis.gl/react-google-maps";

import {
  BAHAYGO_SEARCH_MAP_CENTER,
  BAHAYGO_SEARCH_MAP_DEFAULT_ZOOM,
} from "@/lib/bahaygo-search-map";
import {
  SEARCH_MAP_PIN_SVG,
  SEARCH_MAP_SAGE,
  SEARCH_MAP_SAGE_BORDER,
  type SearchMapMarker,
} from "@/lib/search-map-markers";
import { cn } from "@/lib/utils";

type Props = {
  markers: SearchMapMarker[];
  className?: string;
};

function FitMapToMarkers({ markers }: { markers: SearchMapMarker[] }) {
  const map = useMap();
  const markersKey = useMemo(() => markers.map((m) => `${m.id}:${m.lat},${m.lng}`).join("|"), [markers]);

  useEffect(() => {
    if (!map || markers.length === 0) return;

    if (markers.length === 1) {
      map.setCenter({ lat: markers[0]!.lat, lng: markers[0]!.lng });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const marker of markers) {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
    }
    map.fitBounds(bounds, 56);
  }, [map, markers, markersKey]);

  return null;
}

const SearchMapAdvancedMarker = memo(function SearchMapAdvancedMarker({
  marker,
}: {
  marker: SearchMapMarker;
}) {
  return (
    <AdvancedMarker
      position={{ lat: marker.lat, lng: marker.lng }}
      title={marker.title}
      clickable={false}
    >
      <Pin
        background={SEARCH_MAP_SAGE}
        borderColor={SEARCH_MAP_SAGE_BORDER}
        glyphColor="#ffffff"
        scale={0.92}
      />
    </AdvancedMarker>
  );
});

const SearchMapClassicMarker = memo(function SearchMapClassicMarker({
  marker,
}: {
  marker: SearchMapMarker;
}) {
  const mapReady = useApiIsLoaded();

  const icon = useMemo((): google.maps.Icon | undefined => {
    if (!mapReady || typeof google === "undefined") return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${SEARCH_MAP_PIN_SVG}`,
      scaledSize: new google.maps.Size(32, 41),
      anchor: new google.maps.Point(16, 41),
    };
  }, [mapReady]);

  return (
    <Marker
      position={{ lat: marker.lat, lng: marker.lng }}
      title={marker.title}
      clickable={false}
      {...(icon ? { icon } : {})}
    />
  );
});

const SearchMapPropertyMarkers = memo(function SearchMapPropertyMarkers({
  markers,
  useAdvancedMarker,
}: {
  markers: SearchMapMarker[];
  useAdvancedMarker: boolean;
}) {
  return (
    <>
      {markers.map((marker) =>
        useAdvancedMarker ? (
          <SearchMapAdvancedMarker key={marker.id} marker={marker} />
        ) : (
          <SearchMapClassicMarker key={marker.id} marker={marker} />
        ),
      )}
    </>
  );
});

export function SearchMapCanvas({ markers, className }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  const useAdvancedMarker = Boolean(mapId);

  const stableMarkers = useMemo(() => markers, [markers]);

  if (!apiKey) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center bg-[#E8F0E9] px-6 text-center",
          className,
        )}
      >
        <p className="text-sm font-semibold text-[#2C2C2C]">Map unavailable</p>
        <p className="mt-1 max-w-xs text-xs font-medium text-[#888888]">
          Add <code className="rounded bg-white/70 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API</code> to enable
          the search map.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full", className)}>
      <APIProvider apiKey={apiKey}>
        <Map
          {...(mapId ? { mapId } : {})}
          defaultCenter={BAHAYGO_SEARCH_MAP_CENTER}
          defaultZoom={BAHAYGO_SEARCH_MAP_DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
          className="h-full w-full"
        >
          <FitMapToMarkers markers={stableMarkers} />
          <SearchMapPropertyMarkers markers={stableMarkers} useAdvancedMarker={useAdvancedMarker} />
        </Map>
      </APIProvider>
    </div>
  );
}
