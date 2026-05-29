"use client";

import { useEffect, useId, useRef } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

import {
  attachPlacesAutocomplete,
  type GooglePlaceSelectedPayload,
} from "@/lib/google-places-autocomplete";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (payload: GooglePlaceSelectedPayload) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
};

/** Places Autocomplete for /search — must render inside vis.gl APIProvider (no standalone loader). */
export function SearchMapPlacesInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Search location, neighborhood, or city",
  disabled = false,
  className,
  inputClassName,
  id: idProp,
}: Props) {
  const genId = useId();
  const inputId = idProp ?? genId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  const placesLibrary = useMapsLibrary("places");
  const placesReady = placesLibrary != null;

  useEffect(() => {
    const input = inputRef.current;
    if (!placesReady || !input) return;

    return attachPlacesAutocomplete(input, (payload) => {
      onPlaceSelectedRef.current(payload);
    });
  }, [placesReady]);

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        autoComplete="off"
        disabled={disabled || !placesReady}
        value={value}
        placeholder={placesReady ? placeholder : "Loading place search…"}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          inputClassName,
          !placesReady && "italic text-[#888888] placeholder:text-[#888888] placeholder:italic",
        )}
      />
    </div>
  );
}

export type { GooglePlaceSelectedPayload };
