import Link from "next/link";

import { PhilippineFlagWatermark } from "@/components/philippine-flag-watermark";
import { dormspaceLogoHref } from "@/lib/dormspace-engagement";
import { cn } from "@/lib/utils";

/** Subtle dormspacers brand mark behind all /dormspaces/* content — links to listing home. */
export function DormspacePortalWatermark({ showMobileBrandText = true }: { showMobileBrandText?: boolean }) {
  const homeHref = dormspaceLogoHref();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <PhilippineFlagWatermark />

      <Link
        href={homeHref}
        tabIndex={-1}
        className="pointer-events-none absolute left-3 top-24 block h-[min(36vw,240px)] w-[min(36vw,240px)] sm:left-6 sm:top-28 md:left-8 md:top-32 md:pointer-events-auto md:transition-opacity md:hover:opacity-100"
        aria-hidden
      >
        <svg viewBox="0 0 40 36" className="h-full w-full opacity-[0.045] hover:opacity-[0.08]" aria-hidden>
          <path fill="#D4A843" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
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
