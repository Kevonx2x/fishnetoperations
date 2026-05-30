import Link from "next/link";

import { dormspaceLogoHref } from "@/lib/dormspace-engagement";
import { cn } from "@/lib/utils";

/** Subtle Philippine flag — centered, large, low opacity wallpaper. */
function PhilippineFlagWatermark() {
  return (
    <div
      className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    >
      <svg
        viewBox="0 0 960 480"
        className="h-[min(52vh,460px)] w-[min(88vw,760px)] opacity-[0.055] mix-blend-multiply"
        role="img"
        aria-hidden
      >
        <rect width="960" height="240" y="0" fill="#0038A8" />
        <rect width="960" height="240" y="240" fill="#CE1126" />
        <polygon points="0,0 0,480 480,240" fill="#FFFFFF" />
        <circle cx="168" cy="240" r="52" fill="#FCD116" opacity="0.92" />
        <g fill="#FCD116" opacity="0.88">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <polygon
              key={deg}
              points="0,-10 3,-3 10,0 3,3 0,10 -3,3 -10,0 -3,-3"
              transform={`translate(168 240) rotate(${deg}) translate(0,-78)`}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Subtle dormspacers brand mark behind all /dormspaces/* content — links to listing home. */
export function DormspacePortalWatermark({ showMobileBrandText = true }: { showMobileBrandText?: boolean }) {
  const homeHref = dormspaceLogoHref();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <PhilippineFlagWatermark />

      <Link
        href={homeHref}
        tabIndex={-1}
        className="pointer-events-none absolute -right-8 top-24 block h-[min(42vw,280px)] w-[min(42vw,280px)] sm:right-4 sm:top-32 md:pointer-events-auto md:transition-opacity md:hover:opacity-100"
        aria-hidden
      >
        <svg viewBox="0 0 40 36" className="h-full w-full opacity-[0.04] hover:opacity-[0.07]" aria-hidden>
          <path fill="#6B9E6E" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
          <rect x="16" y="22" width="8" height="10" rx="1" fill="#FAF8F4" />
        </svg>
      </Link>
      <Link
        href={homeHref}
        tabIndex={-1}
        className={cn(
          "pointer-events-none absolute bottom-[12%] left-[4%] max-w-[min(90vw,420px)] md:pointer-events-auto md:transition-opacity md:hover:opacity-100",
          !showMobileBrandText && "max-md:hidden",
        )}
        aria-hidden
      >
        <span className="font-serif text-[clamp(3.5rem,14vw,7rem)] font-bold leading-none tracking-tight text-[#2C2C2C]/[0.03] select-none hover:text-[#2C2C2C]/[0.05]">
          dormspacers
        </span>
      </Link>
    </div>
  );
}
