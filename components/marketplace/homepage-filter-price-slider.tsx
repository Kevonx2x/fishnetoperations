"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  HOMEPAGE_FILTER_MAX_PRICE,
  formatHomepageFilterPrice,
  formatPesoInputLong,
} from "@/lib/homepage-marketplace-filters";

export function HomepageFilterDualPriceSlider({
  minPrice,
  maxPrice,
  onChange,
}: {
  minPrice: number;
  maxPrice: number;
  onChange: (next: { minPrice: number; maxPrice: number }) => void;
}) {
  const maxP = HOMEPAGE_FILTER_MAX_PRICE;
  const step = 1_000_000;
  const [active, setActive] = useState<"min" | "max" | null>(null);

  const rangeBase =
    "pointer-events-none absolute left-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#6B9E6E] [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#6B9E6E] [&::-moz-range-thumb]:shadow-md";

  const minPct = (minPrice / maxP) * 100;
  const maxPct = (maxPrice / maxP) * 100;

  return (
    <div className="w-full">
      <div className="relative mx-1 h-5 min-h-[1.25rem]">
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-[#2C2C2C]"
          style={{ left: `${minPct}%` }}
        >
          {formatHomepageFilterPrice(minPrice)}
        </span>
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-[#2C2C2C]"
          style={{ left: `${maxPct}%` }}
        >
          {formatHomepageFilterPrice(maxPrice)}
        </span>
      </div>
      <div className="relative mx-1 mt-0.5 h-7 touch-none" onPointerUp={() => setActive(null)}>
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-200" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#6B9E6E]"
          style={{
            left: `${minPct}%`,
            width: `${Math.max(0, maxPct - minPct)}%`,
          }}
        />
        <input
          type="range"
          min={0}
          max={maxP}
          step={step}
          value={minPrice}
          aria-label="Minimum price"
          onPointerDown={() => setActive("min")}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ minPrice: Math.min(v, maxPrice), maxPrice });
          }}
          className={cn(rangeBase, active === "min" ? "z-[36]" : "z-[30]")}
        />
        <input
          type="range"
          min={0}
          max={maxP}
          step={step}
          value={maxPrice}
          aria-label="Maximum price"
          onPointerDown={() => setActive("max")}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ minPrice, maxPrice: Math.max(v, minPrice) });
          }}
          className={cn(rangeBase, active === "max" ? "z-[36]" : "z-[32]")}
        />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#2C2C2C]/40">
            Min
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={formatPesoInputLong(minPrice)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              const n = digits ? Number(digits) : 0;
              if (!Number.isFinite(n)) return;
              onChange({ minPrice: Math.min(Math.max(0, n), maxPrice), maxPrice });
            }}
            className="w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
            aria-label="Minimum price (pesos)"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#2C2C2C]/40">
            Max
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={formatPesoInputLong(maxPrice)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d]/g, "");
              const n = digits ? Number(digits) : HOMEPAGE_FILTER_MAX_PRICE;
              if (!Number.isFinite(n)) return;
              onChange({
                minPrice,
                maxPrice: Math.max(Math.min(HOMEPAGE_FILTER_MAX_PRICE, n), minPrice),
              });
            }}
            className="w-full rounded-lg border border-black/10 bg-[#FAF8F4] px-2.5 py-2 text-xs font-semibold text-[#2C2C2C]/85"
            aria-label="Maximum price (pesos)"
          />
        </div>
      </div>
    </div>
  );
}
