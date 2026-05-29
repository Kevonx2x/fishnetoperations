import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { AUTH_SIGN_IN_CTA_LABEL, authLoginHref } from "@/lib/auth-login-path";
import { cn } from "@/lib/utils";

/** Standard BahayGo primary auth CTA — charcoal pill, white label. */
export const AUTH_SIGN_IN_CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1f1f1f] active:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2C2C2C]/20 disabled:cursor-not-allowed disabled:opacity-50";

/** Compact variant for top nav (longer label). */
export const AUTH_SIGN_IN_NAV_CTA_CLASS =
  "inline-flex min-h-11 max-w-[11.5rem] items-center justify-center rounded-full bg-[#2C2C2C] px-3.5 py-1.5 text-center text-[12px] font-medium leading-tight text-white transition-colors hover:bg-[#1f1f1f] active:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2C2C2C]/20 sm:max-w-none sm:px-5 sm:text-sm";

export function AuthSignInLink({
  href,
  className,
  children = AUTH_SIGN_IN_CTA_LABEL,
  nav = false,
}: {
  href: string;
  className?: string;
  children?: string;
  nav?: boolean;
}) {
  return (
    <Link href={href} className={cn(nav ? AUTH_SIGN_IN_NAV_CTA_CLASS : AUTH_SIGN_IN_CTA_CLASS, className)}>
      {children}
    </Link>
  );
}

export function AuthSignInLinkForPath({
  nextPath,
  className,
  nav = false,
}: {
  nextPath: string;
  className?: string;
  nav?: boolean;
}) {
  return <AuthSignInLink href={authLoginHref(nextPath)} className={className} nav={nav} />;
}

export function AuthSignInButton({
  className,
  children = "Sign in",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: string }) {
  return (
    <button type="submit" className={cn(AUTH_SIGN_IN_CTA_CLASS, "w-full", className)} {...props}>
      {children}
    </button>
  );
}
