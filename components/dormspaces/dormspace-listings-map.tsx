"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useMap,
  useMarkerRef,
} from "@vis.gl/react-google-maps";

import {
  DORMSPACE_MAP_DEFAULT_CENTER,
  DORMSPACE_MAP_DEFAULT_ZOOM,
  type DormspaceMapMarker,
} from "@/lib/dormspace-map-markers";
import { cn } from "@/lib/utils";

type Props = {
  markers?: DormspaceMapMarker[];
  selectedMarkerId?: string | null;
  onMarkerClick?: (markerId: string) => void;
  className?: string;
  showCountLabel?: boolean;
};

function FitMapToMarkers({ markers }: { markers: DormspaceMapMarker[] }) {
  const map = useMap();

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
  }, [map, markers]);

  return null;
}

function ListingMarker({
  marker,
  selected,
  onSelect,
}: {
  marker: DormspaceMapMarker;
  selected: boolean;
  onSelect: (markerId: string) => void;
}) {
  const [markerRef, mapMarker] = useMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  const markerIcon: google.maps.Symbol = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: selected ? "#2C2C2C" : "#6B9E6E",
    fillOpacity: 1,
    strokeColor: selected ? "#D4A843" : "#ffffff",
    strokeWeight: selected ? 3 : 2,
    scale: selected ? 12 : 10,
  };

  return (
    <>
      <Marker
        ref={markerRef}
        position={{ lat: marker.lat, lng: marker.lng }}
        title={marker.title}
        icon={markerIcon}
        onClick={() => {
          onSelect(marker.id);
          setInfoOpen(true);
        }}
      />
      {infoOpen && mapMarker ? (
        <InfoWindow anchor={mapMarker} onCloseClick={() => setInfoOpen(false)}>
          <div className="flex max-w-[240px] gap-3">
            {marker.imageUrl ? (
              <div className="relative size-[60px] shrink-0 overflow-hidden rounded-lg bg-[#F3F0EA]">
                <Image
                  src={marker.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="60px"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-[#2C2C2C]">{marker.title}</p>
              <p className="mt-1 text-sm font-semibold text-[#6B9E6E]">{marker.label}</p>
              <Link
                href={marker.href}
                className="mt-2 inline-flex text-xs font-bold text-[#6B9E6E] hover:underline"
              >
                View details
              </Link>
            </div>
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}

function MapMarkers({
  markers,
  selectedMarkerId,
  onMarkerClick,
}: {
  markers: DormspaceMapMarker[];
  selectedMarkerId: string | null;
  onMarkerClick?: (markerId: string) => void;
}) {
  return (
    <>
      {markers.map((marker) => (
        <ListingMarker
          key={marker.id}
          marker={marker}
          selected={selectedMarkerId === marker.id}
          onSelect={(markerId) => onMarkerClick?.(markerId)}
        />
      ))}
    </>
  );
}

export function DormspaceListingsMap({
  markers = [],
  selectedMarkerId = null,
  onMarkerClick,
  className,
  showCountLabel = true,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";

  if (!apiKey) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[360px] flex-col items-center justify-center bg-[#E8F0E9] px-6 text-center",
          className,
        )}
      >
        <p className="text-sm font-semibold text-[#2C2C2C]">Map preview</p>
        <p className="mt-1 max-w-xs text-xs font-medium text-[#888888]">
          Add <code className="rounded bg-white/70 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API</code> to show
          the interactive map.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full min-h-[360px] w-full bg-[#E8F0E9]", className)}>
      <APIProvider apiKey={apiKey}>
        <Map
          {...(mapId ? { mapId } : {})}
          defaultCenter={DORMSPACE_MAP_DEFAULT_CENTER}
          defaultZoom={DORMSPACE_MAP_DEFAULT_ZOOM}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          zoomControl
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          className="h-full w-full"
        >
          <FitMapToMarkers markers={markers} />
          <MapMarkers
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            onMarkerClick={onMarkerClick}
          />
        </Map>
      </APIProvider>

      {showCountLabel ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="rounded-full border border-black/10 bg-white/95 px-4 py-2 text-xs font-semibold text-[#2C2C2C] shadow-md backdrop-blur-sm">
            {markers.length > 0
              ? `${markers.length} ${markers.length === 1 ? "space" : "spaces"} on map`
              : "Map ready — markers will appear here"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
