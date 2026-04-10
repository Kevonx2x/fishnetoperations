import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** `nav` = homepage header. `onboarding` / `login` = wordmark always visible; SVG heights match nav geometry. */
  size?: "nav" | "onboarding" | "login";
};

/** Geometric gold house + bahay (charcoal) / go (sage) wordmark — inline SVG, same source as homepage nav */
export function BahayGoWordmark({ className, size = "nav" }: Props) {
  const isNav = size === "nav";
  const isOnboarding = size === "onboarding";
  const isLogin = size === "login";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        (isOnboarding || isLogin) && "mx-auto",
        className,
      )}
    >
      <svg
        viewBox="0 0 40 36"
        className={cn(
          "w-auto shrink-0",
          isNav && "h-9",
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
        )}
      >
        <span className="text-[#2C2C2C]">bahay</span>
        <span className="text-[#6B9E6E]">go</span>
      </span>
    </span>
  );
}
