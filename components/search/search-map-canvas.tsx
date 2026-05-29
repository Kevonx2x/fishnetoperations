"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MarkerClusterer,
  MarkerUtils,
  SuperClusterAlgorithm,
  type Marker as ClustererMarker,
} from "@googlemaps/markerclusterer";
import { APIProvider, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";

import {
  BAHAYGO_SEARCH_MAP_CENTER,
  BAHAYGO_SEARCH_MAP_DEFAULT_ZOOM,
} from "@/lib/bahaygo-search-map";
import { createSearchMapClusterRenderer } from "@/lib/search-map-cluster-renderer";
import { createSearchMapPropertyMarker } from "@/lib/search-map-imperative-markers";
import type { SearchMapMarker } from "@/lib/search-map-markers";
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

function SearchMapClusteredMarkers({
  markers,
  mapId,
}: {
  markers: SearchMapMarker[];
  mapId: string;
}) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markerByIdRef = useRef<Map<string, ClustererMarker>>(new Map());

  const markersKey = useMemo(() => markers.map((m) => `${m.id}:${m.lat},${m.lng}`).join("|"), [markers]);

  useEffect(() => {
    if (!map) return;

    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: [],
        algorithm: new SuperClusterAlgorithm({}),
        renderer: createSearchMapClusterRenderer(),
      });
    }

    return () => {
      const clusterer = clustererRef.current;
      if (!clusterer) return;

      clusterer.clearMarkers(true);
      for (const marker of markerByIdRef.current.values()) {
        MarkerUtils.setMap(marker, null);
      }
      markerByIdRef.current.clear();
      clusterer.setMap(null);
      clustererRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!map || !clusterer) return;

    clusterer.clearMarkers(true);
    for (const marker of markerByIdRef.current.values()) {
      MarkerUtils.setMap(marker, null);
    }
    markerByIdRef.current.clear();

    if (markers.length === 0) {
      clusterer.render();
      return;
    }

    const useAdvancedMarker = Boolean(mapId) && MarkerUtils.isAdvancedMarkerAvailable(map);
    const googleMarkers: ClustererMarker[] = [];

    for (const property of markers) {
      const googleMarker = createSearchMapPropertyMarker(property, useAdvancedMarker);
      markerByIdRef.current.set(property.id, googleMarker);
      googleMarkers.push(googleMarker);
    }

    clusterer.addMarkers(googleMarkers);

    return () => {
      clusterer.clearMarkers(true);
      for (const marker of markerByIdRef.current.values()) {
        MarkerUtils.setMap(marker, null);
      }
      markerByIdRef.current.clear();
    };
  }, [map, mapId, markers, markersKey]);

  return null;
}

export function SearchMapCanvas({ markers, className }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";

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
        <GoogleMap
          {...(mapId ? { mapId } : {})}
          defaultCenter={BAHAYGO_SEARCH_MAP_CENTER}
          defaultZoom={BAHAYGO_SEARCH_MAP_DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
          className="h-full w-full"
        >
          <FitMapToMarkers markers={stableMarkers} />
          <SearchMapClusteredMarkers markers={stableMarkers} mapId={mapId} />
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
