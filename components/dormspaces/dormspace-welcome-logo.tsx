import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/**
 * BahayGo + dormspacers stacked lockup — used only on /dormspaces/* welcome surfaces.
 * Parent wordmark unchanged; sub-brand tag sits beneath "bahaygo", left-aligned.
 */
export function DormspaceWelcomeLogo({ className }: Props) {
  return (
    <Link
      href="/dormspaces"
      className={cn(
        "inline-flex shrink-0 items-start gap-2 leading-none transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F4]",
        className,
      )}
      aria-label="BahayGo dormspacers"
    >
      <svg viewBox="0 0 40 36" className="h-9 w-auto shrink-0" aria-hidden>
        <path fill="#D4A843" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
        <rect x="16" y="22" width="8" height="10" rx="1" fill="#FAF8F4" />
      </svg>
      <span className="flex flex-col items-start pt-0.5">
        <span className="inline-flex items-baseline gap-0 font-serif text-[1.35rem] font-bold leading-none tracking-tight">
          <span className="text-[#2C2C2C]">bahay</span>
          <span className="text-[#6B9E6E]">go</span>
        </span>
        <span className="mt-0.5 font-serif text-[0.65rem] font-semibold leading-none tracking-[0.14em] text-[#888888]">
          dormspacers
        </span>
      </span>
    </Link>
  );
}
