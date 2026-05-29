"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarkerClusterer,
  MarkerUtils,
  SuperClusterAlgorithm,
  type Marker as ClustererMarker,
} from "@googlemaps/markerclusterer";
import { APIProvider, Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";

import { SearchMapBottomSheet } from "@/components/search/search-map-bottom-sheet";
import {
  BAHAYGO_SEARCH_MAP_CENTER,
  BAHAYGO_SEARCH_MAP_DEFAULT_ZOOM,
} from "@/lib/bahaygo-search-map";
import { createSearchMapClusterRenderer } from "@/lib/search-map-cluster-renderer";
import {
  attachSearchMapPropertyMarkerClickListener,
  createSearchMapPropertyMarker,
  updateSearchMapPropertyMarkerAppearance,
} from "@/lib/search-map-imperative-markers";
import type { SearchMapProperty } from "@/lib/search-map-markers";
import { cn } from "@/lib/utils";

type Props = {
  properties: SearchMapProperty[];
  className?: string;
};

function FitMapToMarkers({ properties }: { properties: SearchMapProperty[] }) {
  const map = useMap();
  const markersKey = useMemo(
    () => properties.map((m) => `${m.id}:${m.lat},${m.lng}`).join("|"),
    [properties],
  );

  useEffect(() => {
    if (!map || properties.length === 0) return;

    if (properties.length === 1) {
      map.setCenter({ lat: properties[0]!.lat, lng: properties[0]!.lng });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const marker of properties) {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
    }
    map.fitBounds(bounds, 56);
  }, [map, properties, markersKey]);

  return null;
}

function SearchMapClusteredMarkers({
  properties,
  mapId,
  selectedPropertyId,
  onPropertyPinClick,
}: {
  properties: SearchMapProperty[];
  mapId: string;
  selectedPropertyId: string | null;
  onPropertyPinClick: (propertyId: string) => void;
}) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markerByIdRef = useRef<Map<string, ClustererMarker>>(new Map());
  const listenerByIdRef = useRef<Map<string, google.maps.MapsEventListener>>(new Map());
  const onPinClickRef = useRef(onPropertyPinClick);
  const selectedPropertyIdRef = useRef(selectedPropertyId);

  onPinClickRef.current = onPropertyPinClick;
  selectedPropertyIdRef.current = selectedPropertyId;

  const propertiesKey = useMemo(
    () => properties.map((m) => `${m.id}:${m.lat},${m.lng}`).join("|"),
    [properties],
  );

  const clearImperativeMarkers = useCallback((clusterer: MarkerClusterer) => {
    clusterer.clearMarkers(true);
    for (const listener of listenerByIdRef.current.values()) {
      google.maps.event.removeListener(listener);
    }
    listenerByIdRef.current.clear();
    for (const marker of markerByIdRef.current.values()) {
      MarkerUtils.setMap(marker, null);
    }
    markerByIdRef.current.clear();
  }, []);

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

      clearImperativeMarkers(clusterer);
      clusterer.setMap(null);
      clustererRef.current = null;
    };
  }, [clearImperativeMarkers, map]);

  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!map || !clusterer) return;

    clearImperativeMarkers(clusterer);

    if (properties.length === 0) {
      clusterer.render();
      return;
    }

    const useAdvancedMarker = Boolean(mapId) && MarkerUtils.isAdvancedMarkerAvailable(map);
    const googleMarkers: ClustererMarker[] = [];

    for (const property of properties) {
      const googleMarker = createSearchMapPropertyMarker(property, {
        useAdvancedMarker,
        selected: property.id === selectedPropertyIdRef.current,
      });
      markerByIdRef.current.set(property.id, googleMarker);

      const listener = attachSearchMapPropertyMarkerClickListener(
        googleMarker,
        property.id,
        (propertyId) => onPinClickRef.current(propertyId),
      );
      listenerByIdRef.current.set(property.id, listener);

      googleMarkers.push(googleMarker);
    }

    clusterer.addMarkers(googleMarkers);

    return () => {
      clearImperativeMarkers(clusterer);
    };
  }, [clearImperativeMarkers, map, mapId, properties, propertiesKey]);

  useEffect(() => {
    if (!map) return;

    const useAdvancedMarker = Boolean(mapId) && MarkerUtils.isAdvancedMarkerAvailable(map);

    for (const property of properties) {
      const marker = markerByIdRef.current.get(property.id);
      if (!marker) continue;

      updateSearchMapPropertyMarkerAppearance(marker, {
        useAdvancedMarker,
        selected: property.id === selectedPropertyId,
        title: property.title,
      });
    }
  }, [map, mapId, properties, selectedPropertyId]);

  return null;
}

function SearchMapMapClickDismiss({
  selectedPropertyId,
  onDismiss,
}: {
  selectedPropertyId: string | null;
  onDismiss: () => void;
}) {
  const map = useMap();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!map || !selectedPropertyId) return;

    const listener = map.addListener("click", () => {
      onDismissRef.current();
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, selectedPropertyId]);

  return null;
}

export function SearchMapCanvas({ properties, className }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const stableProperties = useMemo(() => properties, [properties]);

  const selectedProperty = useMemo(
    () => stableProperties.find((p) => p.id === selectedPropertyId) ?? null,
    [selectedPropertyId, stableProperties],
  );

  const handlePropertyPinClick = useCallback((propertyId: string) => {
    setSelectedPropertyId((prev) => (prev === propertyId ? null : propertyId));
  }, []);

  const handleDismissSheet = useCallback(() => {
    setSelectedPropertyId(null);
  }, []);

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
    <>
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
            <FitMapToMarkers properties={stableProperties} />
            <SearchMapClusteredMarkers
              properties={stableProperties}
              mapId={mapId}
              selectedPropertyId={selectedPropertyId}
              onPropertyPinClick={handlePropertyPinClick}
            />
            <SearchMapMapClickDismiss
              selectedPropertyId={selectedPropertyId}
              onDismiss={handleDismissSheet}
            />
          </GoogleMap>
        </APIProvider>
      </div>

      <SearchMapBottomSheet
        property={selectedProperty}
        open={selectedPropertyId != null}
        onOpenChange={(open) => {
          if (!open) handleDismissSheet();
        }}
      />
    </>
  );
}
