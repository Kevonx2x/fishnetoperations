"use client";

import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  active?: boolean;
  className?: string;
  /** Stroke/fill color (defaults to sage when active, grey when idle). */
  color?: string;
};

/**
 * Premium outline home for bottom nav — matches BahayGo roofline, not generic Lucide Home.
 */
export function BahayGoNavHomeIcon({ size = 24, active = false, className, color }: Props) {
  const stroke = color ?? (active ? "#6B9E6E" : "#717171");
  const roofFill = active ? "#6B9E6E" : "none";
  const roofFillOpacity = active ? 0.14 : 0;
  const doorFill = active ? "#D4A843" : "none";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M5 10.5 12 5l7 5.5V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V10.5Z"
        fill={roofFill}
        fillOpacity={roofFillOpacity}
        stroke={stroke}
        strokeWidth={active ? 2 : 1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 20v-5.5h5V20"
        fill={doorFill}
        fillOpacity={active ? 0.85 : 0}
        stroke={stroke}
        strokeWidth={active ? 2 : 1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5v2"
        stroke={active ? "#D4A843" : stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={active ? 1 : 0.35}
      />
    </svg>
  );
}
