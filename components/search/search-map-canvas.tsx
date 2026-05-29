"use client";

import { APIProvider, Map } from "@vis.gl/react-google-maps";

import {
  BAHAYGO_SEARCH_MAP_CENTER,
  BAHAYGO_SEARCH_MAP_DEFAULT_ZOOM,
} from "@/lib/bahaygo-search-map";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function SearchMapCanvas({ className }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";

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
        />
      </APIProvider>
    </div>
  );
}
