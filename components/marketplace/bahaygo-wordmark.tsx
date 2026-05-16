import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** `nav` = homepage header. `sidebar` = dashboard sidebars (same mark, slightly smaller). `onboarding` / `login` = larger hero contexts. */
  size?: "nav" | "sidebar" | "onboarding" | "login";
};

/** Geometric gold house + bahay (charcoal) / go (sage) wordmark — inline SVG, same source as homepage nav */
export function BahayGoWordmark({ className, size = "nav" }: Props) {
  const isNav = size === "nav";
  const isSidebar = size === "sidebar";
  const isOnboarding = size === "onboarding";
  const isLogin = size === "login";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        (isOnboarding || isLogin) && "mx-auto",
        isSidebar && "gap-1.5",
        className,
      )}
    >
      <svg
        viewBox="0 0 40 36"
        className={cn(
          "w-auto shrink-0",
          isNav && "h-9",
          isSidebar && "h-7",
          isOnboarding && "h-20",
          isLogin && "h-16",
        )}
        aria-hidden
      >
        <path fill="#D4A843" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
        <rect x="16" y="22" width="8" height="10" rx="1" fill="#FAF8F4" />
      </svg>
      <span
        className={cn(
          "items-baseline gap-0 font-serif font-bold leading-none tracking-tight",
          isOnboarding && "inline-flex text-xl sm:text-2xl",
          isLogin && "inline-flex text-lg sm:text-xl",
          isNav && "hidden text-[1.35rem] sm:inline-flex",
          isSidebar && "inline-flex text-[0.95rem] leading-tight sm:text-[1.05rem]",
        )}
      >
        <span className="text-[#2C2C2C]">bahay</span>
        <span className="text-[#6B9E6E]">go</span>
      </span>
    </span>
  );
}

/** Homepage-style wordmark wrapped for navigation home (dashboard sidebars, etc.). */
export function BahayGoWordmarkHomeLink({ className, size = "sidebar" }: Pick<Props, "className" | "size">) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex shrink-0 items-center leading-none transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F4]",
        className,
      )}
      aria-label="BahayGo home"
    >
      <BahayGoWordmark size={size} />
    </Link>
  );
}
