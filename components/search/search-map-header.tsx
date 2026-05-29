"use client";

import { useCallback, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import {
  SearchMapPlacesInput,
  type GooglePlaceSelectedPayload,
} from "@/components/search/search-map-places-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type SearchMapLocationFocus = {
  lat: number;
  lng: number;
  zoom: number;
  token: number;
};

type Props = {
  onLocationFocus: (focus: SearchMapLocationFocus) => void;
};

export function SearchMapHeader({ onLocationFocus }: Props) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const focusTokenRef = useRef(0);

  const handlePlaceSelected = useCallback(
    (payload: GooglePlaceSelectedPayload) => {
      setQuery(payload.location);
      focusTokenRef.current += 1;
      onLocationFocus({
        lat: payload.lat,
        lng: payload.lng,
        zoom: 14,
        token: focusTokenRef.current,
      });
    },
    [onLocationFocus],
  );

  return (
    <>
      <header
        className={cn(
          "relative z-30 shrink-0 border-b border-[#E0DCD4] bg-[#FAF8F4]",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
        )}
      >
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
          <SearchMapPlacesInput
            value={query}
            onChange={setQuery}
            onPlaceSelected={handlePlaceSelected}
            placeholder="Search location, neighborhood, or city"
            className="min-w-0 flex-1"
            inputClassName={cn(
              "h-11 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3.5 text-sm font-medium text-[#2C2C2C]",
              "placeholder:text-[#888888] focus:border-[#6B9E6E] focus:outline-none focus:ring-2 focus:ring-[#6B9E6E]/30",
            )}
          />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#6B9E6E]/45 bg-white text-[#6B9E6E] shadow-sm active:bg-[#6B9E6E]/8"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="z-[100] rounded-t-2xl border-[#2C2C2C]/10 bg-[#FAF8F4] px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2C2C2C]/15" aria-hidden />
          <SheetHeader className="px-4 text-left">
            <SheetTitle className="font-sans text-base font-semibold text-[#2C2C2C]">
              Filters
            </SheetTitle>
            <SheetDescription className="text-sm text-[#888888]">
              Filters coming soon
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2 pt-4">
            <p className="text-sm font-medium text-[#2C2C2C]/75">
              Price, beds, property type, and more filters are on the way.
            </p>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#6B9E6E] px-4 text-sm font-semibold text-white active:bg-[#5d8a60]"
            >
              Got it
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
