/** Subtle dormspacers brand mark behind all /dormspaces/* content. */
export function DormspacePortalWatermark() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <svg
        viewBox="0 0 40 36"
        className="absolute -right-8 top-24 h-[min(42vw,280px)] w-auto opacity-[0.04] sm:right-4 sm:top-32"
      >
        <path fill="#6B9E6E" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
        <rect x="16" y="22" width="8" height="10" rx="1" fill="#FAF8F4" />
      </svg>
      <p className="absolute bottom-[12%] left-[4%] max-w-[min(90vw,420px)] font-serif text-[clamp(3.5rem,14vw,7rem)] font-bold leading-none tracking-tight text-[#2C2C2C]/[0.03] select-none">
        dormspacers
      </p>
    </div>
  );
}
