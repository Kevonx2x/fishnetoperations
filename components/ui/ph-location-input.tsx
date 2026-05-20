"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type PhLocationOption = {
  area: string;
  city: string;
};

/** Hardcoded Philippine locations for listing/search autocomplete (Area, City). */
export const PH_LOCATION_OPTIONS: PhLocationOption[] = [
  { area: "BGC", city: "Taguig" },
  { area: "Makati CBD", city: "Makati" },
  { area: "Ortigas Center", city: "Pasig" },
  { area: "Mandaluyong", city: "Mandaluyong" },
  { area: "Eastwood", city: "Quezon City" },
  { area: "Cubao", city: "Quezon City" },
  { area: "Katipunan", city: "Quezon City" },
  { area: "Commonwealth", city: "Quezon City" },
  { area: "Quezon City", city: "Quezon City" },
  { area: "Greenhills", city: "San Juan" },
  { area: "San Juan", city: "San Juan" },
  { area: "Marikina", city: "Marikina" },
  { area: "Pasay", city: "Pasay" },
  { area: "Paranaque", city: "Paranaque" },
  { area: "Las Pinas", city: "Las Pinas" },
  { area: "Muntinlupa", city: "Muntinlupa" },
  { area: "Valenzuela", city: "Valenzuela" },
  { area: "Malabon", city: "Malabon" },
  { area: "Navotas", city: "Navotas" },
  { area: "Caloocan", city: "Caloocan" },
  { area: "Manila", city: "Manila" },
  { area: "Intramuros", city: "Manila" },
  { area: "Cebu City", city: "Cebu City" },
  { area: "Lapu-Lapu", city: "Lapu-Lapu" },
  { area: "Mandaue", city: "Mandaue" },
  { area: "Talisay", city: "Talisay" },
  { area: "Minglanilla", city: "Minglanilla" },
  { area: "Davao City", city: "Davao City" },
  { area: "Tagum", city: "Tagum" },
  { area: "Digos", city: "Digos" },
  { area: "Iloilo City", city: "Iloilo City" },
  { area: "Bacolod", city: "Bacolod" },
  { area: "Cagayan de Oro", city: "Cagayan de Oro" },
  { area: "Zamboanga", city: "Zamboanga" },
  { area: "Baguio", city: "Baguio" },
  { area: "Clark", city: "Pampanga" },
  { area: "Angeles", city: "Pampanga" },
  { area: "Cavite", city: "Cavite" },
  { area: "Laguna", city: "Laguna" },
  { area: "Batangas", city: "Batangas" },
  { area: "Antipolo", city: "Rizal" },
  { area: "Taytay", city: "Rizal" },
];

export function formatPhLocation(o: PhLocationOption): string {
  return `${o.area}, ${o.city}`;
}

function filterLocations(query: string): PhLocationOption[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return PH_LOCATION_OPTIONS.filter((o) => {
    const label = formatPhLocation(o).toLowerCase();
    return (
      label.includes(q) ||
      o.area.toLowerCase().includes(q) ||
      o.city.toLowerCase().includes(q)
    );
  });
}

type DropdownEntry =
  | { kind: "recent"; query: string }
  | { kind: "location"; option: PhLocationOption };

export type PhLocationInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called when Enter is pressed and no suggestion is being selected from the dropdown. */
  onSubmitSearch?: () => void;
  /** Last N hero searches (shown when input is focused and query is short). */
  recentSearches?: string[];
  /** Fired when user picks a recent search row (parent should run search). */
  onRecentSearchPick?: (query: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
};

export function PhLocationInput({
  value,
  onChange,
  onSubmitSearch,
  recentSearches = [],
  onRecentSearchPick,
  id: idProp,
  name,
  placeholder = "City, area, or neighborhood",
  disabled,
  required,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: PhLocationInputProps) {
  const genId = useId();
  const id = idProp ?? `ph-loc-${genId.replace(/:/g, "")}`;
  const listboxId = `${id}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const locationSuggestions = useMemo(() => filterLocations(value), [value]);
  const showLocationSuggestions = value.trim().length >= 2;

  const dropdownEntries = useMemo((): DropdownEntry[] => {
    if (showLocationSuggestions) {
      return locationSuggestions.map((option) => ({ kind: "location", option }));
    }
    return recentSearches.map((query) => ({ kind: "recent", query }));
  }, [showLocationSuggestions, locationSuggestions, recentSearches]);

  const showDropdown = open && dropdownEntries.length > 0;

  const selectLocation = useCallback(
    (o: PhLocationOption) => {
      onChange(formatPhLocation(o));
      setOpen(false);
      setHighlighted(-1);
    },
    [onChange],
  );

  const selectRecent = useCallback(
    (query: string) => {
      onChange(query);
      setOpen(false);
      setHighlighted(-1);
      onRecentSearchPick?.(query);
    },
    [onChange, onRecentSearchPick],
  );

  useEffect(() => {
    if (!showDropdown) setHighlighted(-1);
  }, [showDropdown, dropdownEntries.length]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el?.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      const canOpen =
        (showLocationSuggestions && locationSuggestions.length > 0) ||
        (!showLocationSuggestions && recentSearches.length > 0);
      if (canOpen) {
        e.preventDefault();
        setOpen(true);
        setHighlighted(0);
      }
      return;
    }

    if (!showDropdown || dropdownEntries.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
        setHighlighted(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSubmitSearch?.();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i < dropdownEntries.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? dropdownEntries.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = highlighted >= 0 ? dropdownEntries[highlighted] : undefined;
      if (entry?.kind === "location") {
        selectLocation(entry.option);
      } else if (entry?.kind === "recent") {
        selectRecent(entry.query);
      } else {
        onSubmitSearch?.();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlighted(-1);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        disabled={disabled}
        required={required}
        autoComplete="off"
        aria-label={ariaLabel}
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          highlighted >= 0 && dropdownEntries[highlighted]
            ? `${id}-opt-${highlighted}`
            : undefined
        }
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length >= 2 || recentSearches.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] placeholder:text-[#2C2C2C]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/50",
          inputClassName,
        )}
      />
      {showDropdown ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] py-1 shadow-lg ring-1 ring-black/5"
        >
          {!showLocationSuggestions && recentSearches.length > 0 ? (
            <li className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/40">
              Recent searches
            </li>
          ) : null}
          {showLocationSuggestions && locationSuggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm font-semibold text-[#2C2C2C]/50">No matching locations</li>
          ) : (
            dropdownEntries.map((entry, i) => {
              const active = i === highlighted;
              if (entry.kind === "recent") {
                return (
                  <li
                    key={`recent-${entry.query}`}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-[#2C2C2C] [overflow-wrap:break-word] [word-break:normal]",
                      active ? "bg-[#6B9E6E]/20" : "hover:bg-[#6B9E6E]/15",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectRecent(entry.query);
                    }}
                    onMouseEnter={() => setHighlighted(i)}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#2C2C2C]/40" aria-hidden />
                    <span className="min-w-0">{entry.query}</span>
                  </li>
                );
              }
              const label = formatPhLocation(entry.option);
              return (
                <li
                  key={`${entry.option.area}-${entry.option.city}-${i}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm font-semibold text-[#2C2C2C]",
                    active ? "bg-[#6B9E6E]/20" : "hover:bg-[#6B9E6E]/15",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectLocation(entry.option);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  {label}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
