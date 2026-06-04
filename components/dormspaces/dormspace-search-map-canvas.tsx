"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarkerClusterer,
  MarkerUtils,
  SuperClusterAlgorithm,
  type Marker as ClustererMarker,
} from "@googlemaps/markerclusterer";
import { Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";

import { DormspaceSearchMapBottomSheet } from "@/components/dormspaces/dormspace-search-map-bottom-sheet";
import type { SearchMapLocationFocus } from "@/components/search/search-map-header";
import {
  DORMSPACE_SEARCH_MAP_CENTER,
  DORMSPACE_SEARCH_MAP_DEFAULT_ZOOM,
} from "@/lib/dormspace-search-map";
import { createSearchMapClusterRenderer } from "@/lib/search-map-cluster-renderer";
import {
  attachSearchMapPropertyMarkerClickListener,
  createSearchMapGeoMarker,
  updateSearchMapPropertyMarkerAppearance,
} from "@/lib/search-map-imperative-markers";
import {
  nearbySearchMapNavigation,
  sortSearchMapItemsByDistanceFrom,
} from "@/lib/search-map-nearby";
import type { SearchMapDormspace } from "@/lib/search-map-dormspace-markers";
import { SEARCH_MAP_STYLES } from "@/lib/search-map-styles";
import { cn } from "@/lib/utils";

type Props = {
  dormspaces: SearchMapDormspace[];
  className?: string;
  locationFocus: SearchMapLocationFocus | null;
};

function FitMapToMarkers({ dormspaces }: { dormspaces: SearchMapDormspace[] }) {
  const map = useMap();
  const markersKey = useMemo(
    () => dormspaces.map((m) => `${m.id}:${m.lat},${m.lng}`).join("|"),
    [dormspaces],
  );
  const didFitRef = useRef(false);

  useEffect(() => {
    if (!map || dormspaces.length === 0 || didFitRef.current) return;
    didFitRef.current = true;

    if (dormspaces.length === 1) {
      map.setCenter({ lat: dormspaces[0]!.lat, lng: dormspaces[0]!.lng });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const marker of dormspaces) {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
    }
    map.fitBounds(bounds, 56);
  }, [map, dormspaces, markersKey]);

  return null;
}

function SearchMapViewportControl({
  locationFocus,
  selectedDormspaceId,
  dormspaces,
}: {
  locationFocus: SearchMapLocationFocus | null;
  selectedDormspaceId: string | null;
  dormspaces: SearchMapDormspace[];
}) {
  const map = useMap();
  const lastSelectedRef = useRef<string | null>(null);
  const lastFocusTokenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !locationFocus) return;
    if (lastFocusTokenRef.current === locationFocus.token) return;
    lastFocusTokenRef.current = locationFocus.token;
    map.panTo({ lat: locationFocus.lat, lng: locationFocus.lng });
    map.setZoom(locationFocus.zoom);
  }, [locationFocus, map]);

  useEffect(() => {
    if (!map || !selectedDormspaceId) {
      lastSelectedRef.current = null;
      return;
    }
    if (lastSelectedRef.current === selectedDormspaceId) return;

    const dormspace = dormspaces.find((d) => d.id === selectedDormspaceId);
    if (!dormspace) return;

    lastSelectedRef.current = selectedDormspaceId;
    map.panTo({ lat: dormspace.lat, lng: dormspace.lng });
  }, [map, dormspaces, selectedDormspaceId]);

  return null;
}

function DormspaceSearchMapClusteredMarkers({
  dormspaces,
  mapId,
  selectedDormspaceId,
  onDormspacePinClick,
}: {
  dormspaces: SearchMapDormspace[];
  mapId: string;
  selectedDormspaceId: string | null;
  onDormspacePinClick: (dormspaceId: string) => void;
}) {
  const map = useMap();
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markerByIdRef = useRef<Map<string, ClustererMarker>>(new Map());
  const listenerByIdRef = useRef<Map<string, google.maps.MapsEventListener>>(new Map());
  const onPinClickRef = useRef(onDormspacePinClick);
  const selectedDormspaceIdRef = useRef(selectedDormspaceId);

  onPinClickRef.current = onDormspacePinClick;
  selectedDormspaceIdRef.current = selectedDormspaceId;

  const dormspacesKey = useMemo(
    () => dormspaces.map((m) => `${m.id}:${m.lat},${m.lng}`).join("|"),
    [dormspaces],
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

    if (dormspaces.length === 0) {
      clusterer.render();
      return;
    }

    const useAdvancedMarker = Boolean(mapId) && MarkerUtils.isAdvancedMarkerAvailable(map);
    const googleMarkers: ClustererMarker[] = [];

    for (const dormspace of dormspaces) {
      const googleMarker = createSearchMapGeoMarker(
        { lat: dormspace.lat, lng: dormspace.lng, title: dormspace.title },
        {
          useAdvancedMarker,
          selected: dormspace.id === selectedDormspaceIdRef.current,
        },
      );
      markerByIdRef.current.set(dormspace.id, googleMarker);

      const listener = attachSearchMapPropertyMarkerClickListener(
        googleMarker,
        dormspace.id,
        (dormspaceId) => onPinClickRef.current(dormspaceId),
      );
      listenerByIdRef.current.set(dormspace.id, listener);

      googleMarkers.push(googleMarker);
    }

    clusterer.addMarkers(googleMarkers);

    return () => {
      clearImperativeMarkers(clusterer);
    };
  }, [clearImperativeMarkers, map, mapId, dormspaces, dormspacesKey]);

  useEffect(() => {
    if (!map) return;

    const useAdvancedMarker = Boolean(mapId) && MarkerUtils.isAdvancedMarkerAvailable(map);

    for (const dormspace of dormspaces) {
      const marker = markerByIdRef.current.get(dormspace.id);
      if (!marker) continue;

      updateSearchMapPropertyMarkerAppearance(marker, {
        useAdvancedMarker,
        selected: dormspace.id === selectedDormspaceId,
        title: dormspace.title,
      });
    }
  }, [map, mapId, dormspaces, selectedDormspaceId]);

  return null;
}

function SearchMapMapClickDismiss({
  selectedDormspaceId,
  onDismiss,
}: {
  selectedDormspaceId: string | null;
  onDismiss: () => void;
}) {
  const map = useMap();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!map || !selectedDormspaceId) return;

    const listener = map.addListener("click", () => {
      onDismissRef.current();
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, selectedDormspaceId]);

  return null;
}

export function DormspaceSearchMapCanvas({ dormspaces, className, locationFocus }: Props) {
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  const [selectedDormspaceId, setSelectedDormspaceId] = useState<string | null>(null);
  const [swipeAnchorId, setSwipeAnchorId] = useState<string | null>(null);

  const stableDormspaces = useMemo(() => dormspaces, [dormspaces]);

  const selectedDormspace = useMemo(
    () => stableDormspaces.find((d) => d.id === selectedDormspaceId) ?? null,
    [selectedDormspaceId, stableDormspaces],
  );

  const nearbySorted = useMemo(() => {
    if (!swipeAnchorId) return [];
    return sortSearchMapItemsByDistanceFrom(stableDormspaces, swipeAnchorId);
  }, [swipeAnchorId, stableDormspaces]);

  const { next: nextNearby, previous: previousNearby } = useMemo(
    () =>
      selectedDormspaceId
        ? nearbySearchMapNavigation(nearbySorted, selectedDormspaceId)
        : { next: null, previous: null, index: -1 },
    [nearbySorted, selectedDormspaceId],
  );

  const handleDormspacePinClick = useCallback((dormspaceId: string) => {
    setSelectedDormspaceId((prev) => {
      if (prev === dormspaceId) {
        setSwipeAnchorId(null);
        return null;
      }
      setSwipeAnchorId(dormspaceId);
      return dormspaceId;
    });
  }, []);

  const handleDismissSheet = useCallback(() => {
    setSelectedDormspaceId(null);
    setSwipeAnchorId(null);
  }, []);

  const handleSwipeNext = useCallback(() => {
    if (nextNearby) setSelectedDormspaceId(nextNearby.id);
  }, [nextNearby]);

  const handleSwipePrevious = useCallback(() => {
    if (previousNearby) setSelectedDormspaceId(previousNearby.id);
  }, [previousNearby]);

  return (
    <>
      <div className={cn("h-full w-full", className)}>
        <GoogleMap
          {...(mapId ? { mapId } : {})}
          defaultCenter={DORMSPACE_SEARCH_MAP_CENTER}
          defaultZoom={DORMSPACE_SEARCH_MAP_DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
          styles={SEARCH_MAP_STYLES}
          className="h-full w-full"
        >
          <FitMapToMarkers dormspaces={stableDormspaces} />
          <SearchMapViewportControl
            locationFocus={locationFocus}
            selectedDormspaceId={selectedDormspaceId}
            dormspaces={stableDormspaces}
          />
          <DormspaceSearchMapClusteredMarkers
            dormspaces={stableDormspaces}
            mapId={mapId}
            selectedDormspaceId={selectedDormspaceId}
            onDormspacePinClick={handleDormspacePinClick}
          />
          <SearchMapMapClickDismiss
            selectedDormspaceId={selectedDormspaceId}
            onDismiss={handleDismissSheet}
          />
        </GoogleMap>
      </div>

      <DormspaceSearchMapBottomSheet
        dormspace={selectedDormspace}
        open={selectedDormspaceId != null}
        onOpenChange={(open) => {
          if (!open) handleDismissSheet();
        }}
        canSwipeNext={Boolean(nextNearby)}
        canSwipePrevious={Boolean(previousNearby)}
        showSwipeArrows={nearbySorted.length > 1}
        onSwipeNext={handleSwipeNext}
        onSwipePrevious={handleSwipePrevious}
      />
    </>
  );
}
