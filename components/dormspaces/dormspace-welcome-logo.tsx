import Link from "next/link";
import { cn } from "@/lib/utils";

/** Gold house mark from the dormspacers lockup (nav dropdown, compact UI). */
export function BahayGoHouseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 36" className={cn("h-4 w-4 shrink-0", className)} aria-hidden>
      <path fill="#D4A843" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
      <rect x="16" y="22" width="8" height="10" rx="1" fill="#FAF8F4" />
    </svg>
  );
}

type Props = {
  className?: string;
  href?: string;
  compact?: boolean;
  /** Light text on photo hero (welcome split layout). */
  onHero?: boolean;
};

/**
 * BahayGo + dormspacers stacked lockup — used only on /dormspaces/* welcome surfaces.
 * Parent wordmark unchanged; sub-brand tag sits beneath "BahayGo", left-aligned.
 */
export function DormspaceWelcomeLogo({
  className,
  href = "/dormspaces",
  compact = false,
  onHero = false,
}: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-start leading-none transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F4]",
        compact ? "gap-1.5" : "gap-2",
        className,
      )}
      aria-label="BahayGo dormspacers"
    >
      <BahayGoHouseMark className={cn("w-auto shrink-0", compact ? "h-6" : "h-9")} />
      <span className={cn("flex flex-col items-start", compact ? "pt-0" : "pt-0.5")}>
        <span
          className={cn(
            "inline-flex items-baseline gap-0 font-serif font-bold leading-none tracking-tight",
            compact ? "text-[1.2rem]" : "text-[1.35rem]",
          )}
        >
          <span className={onHero ? "text-white" : "text-[#2C2C2C]"}>Bahay</span>
          <span className={onHero ? "text-[#b8e0bb]" : "text-[#6B9E6E]"}>Go</span>
        </span>
        <span
          className={cn(
            "font-serif font-semibold leading-none tracking-[0.14em]",
            onHero ? "text-white/75" : "text-[#888888]",
            compact ? "mt-px text-[0.58rem]" : "mt-0.5 text-[0.65rem]",
          )}
        >
          dormspacers
        </span>
      </span>
    </Link>
  );
}
