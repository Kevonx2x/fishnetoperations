"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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

export type PhLocationInputProps = {
  value: string;
  onChange: (value: string) => void;
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

  const suggestions = useMemo(() => filterLocations(value), [value]);

  const showDropdown = open && value.trim().length >= 2;

  const selectOption = useCallback(
    (o: PhLocationOption) => {
      onChange(formatPhLocation(o));
      setOpen(false);
      setHighlighted(-1);
    },
    [onChange],
  );

  useEffect(() => {
    if (!showDropdown) setHighlighted(-1);
  }, [showDropdown, suggestions.length]);

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
    if (!showDropdown && (e.key === "ArrowDown" || e.key === "ArrowUp") && value.trim().length >= 2) {
      e.preventDefault();
      setOpen(true);
      setHighlighted(0);
      return;
    }
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
        setHighlighted(-1);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < suggestions.length) {
        selectOption(suggestions[highlighted]!);
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
          highlighted >= 0 && suggestions[highlighted] ? `${id}-opt-${highlighted}` : undefined
        }
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length >= 2) setOpen(true);
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
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm font-semibold text-[#2C2C2C]/50">No matching locations</li>
          ) : (
            suggestions.map((o, i) => {
              const label = formatPhLocation(o);
              const active = i === highlighted;
              return (
                <li
                  key={`${o.area}-${o.city}-${i}`}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm font-semibold text-[#2C2C2C]",
                    active ? "bg-[#6B9E6E]/20" : "hover:bg-[#6B9E6E]/15",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(o);
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
