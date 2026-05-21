import Link from "next/link";

import { dormspaceLogoHref } from "@/lib/dormspace-engagement";

/** Subtle dormspacers brand mark behind all /dormspaces/* content — links to listing home. */
export function DormspacePortalWatermark() {
  const homeHref = dormspaceLogoHref();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <Link
        href={homeHref}
        className="pointer-events-auto absolute -right-8 top-24 block h-[min(42vw,280px)] w-[min(42vw,280px)] transition-opacity hover:opacity-100 sm:right-4 sm:top-32"
        aria-label="Browse dormspaces"
      >
        <svg viewBox="0 0 40 36" className="h-full w-full opacity-[0.04] hover:opacity-[0.07]" aria-hidden>
          <path fill="#6B9E6E" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
          <rect x="16" y="22" width="8" height="10" rx="1" fill="#FAF8F4" />
        </svg>
      </Link>
      <Link
        href={homeHref}
        tabIndex={-1}
        className="pointer-events-auto absolute bottom-[12%] left-[4%] max-w-[min(90vw,420px)] transition-opacity hover:opacity-100"
        aria-hidden
      >
        <span className="font-serif text-[clamp(3.5rem,14vw,7rem)] font-bold leading-none tracking-tight text-[#2C2C2C]/[0.03] select-none hover:text-[#2C2C2C]/[0.05]">
          dormspacers
        </span>
      </Link>
    </div>
  );
}
