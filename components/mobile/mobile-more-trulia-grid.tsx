"use client";

import Link from "next/link";
import { User, type LucideIcon } from "lucide-react";

import { SupabasePublicImage } from "@/components/supabase-public-image";
import { MOBILE_BOTTOM_NAV_OFFSET_CSS } from "@/lib/mobile-bottom-nav-layout";
import { cn } from "@/lib/utils";

export type MobileMoreGridItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
};

type Props = {
  items: MobileMoreGridItem[];
  loading?: boolean;
  signedIn?: boolean;
  signInHref: string;
  signInLabel?: string;
  profileHref?: string;
  profileName?: string;
  profileEmail?: string;
  profileAvatarUrl?: string | null;
  profileInitials?: string;
  profileBadge?: string;
};

export function MobileMoreTruliaGrid({
  items,
  loading,
  signedIn,
  signInHref,
  signInLabel = "Sign In",
  profileHref = "/settings",
  profileName,
  profileEmail,
  profileAvatarUrl,
  profileInitials = "?",
  profileBadge,
}: Props) {
  const totalRows = Math.ceil(items.length / 2);

  return (
    <div
      className="flex flex-col overflow-hidden bg-[#2C2C2C] text-white md:hidden"
      style={{
        height: `calc(100dvh - ${MOBILE_BOTTOM_NAV_OFFSET_CSS})`,
        maxHeight: `calc(100dvh - ${MOBILE_BOTTOM_NAV_OFFSET_CSS})`,
      }}
    >
      <header className="shrink-0 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-lg font-bold tracking-tight text-white">More</h1>
      </header>

      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-white/10" aria-hidden />
        ) : signedIn ? (
          <Link
            href={profileHref}
            className="flex items-center gap-3 active:opacity-90"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#6B9E6E]">
              {profileAvatarUrl ? (
                <SupabasePublicImage
                  src={profileAvatarUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                  {profileInitials}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-base font-semibold text-white">{profileName}</p>
                {profileBadge ? (
                  <span className="shrink-0 rounded bg-[#6B9E6E]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#A8D5AA]">
                    {profileBadge}
                  </span>
                ) : null}
              </div>
              {profileEmail ? (
                <p className="truncate text-xs text-white/50">{profileEmail}</p>
              ) : null}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5">
              <User className="h-8 w-8 text-white/40" strokeWidth={1.25} aria-hidden />
            </div>
            <Link
              href={signInHref}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#6B9E6E] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5d8a60] active:bg-[#527a55]"
            >
              {signInLabel}
            </Link>
          </div>
        )}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-2 border-t border-white/10"
        style={{ gridTemplateRows: `repeat(${Math.max(totalRows, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => {
          const rowIndex = Math.floor(index / 2);
          const colIndex = index % 2;
          const isLastRow = rowIndex === totalRows - 1;
          const isLastCol = colIndex === 1;
          const isOddCountLast = items.length % 2 === 1 && index === items.length - 1;

          const cellClass = cn(
            "flex min-h-0 flex-col items-center justify-center gap-1.5 px-2 py-1.5 text-center transition-colors",
            "border-white/10 active:bg-white/5",
            !isLastCol && !isOddCountLast && "border-r",
            !isLastRow && "border-b",
            isOddCountLast && "col-span-2 border-r-0",
          );

          const iconClass = item.destructive ? "text-red-400" : "text-white/90";
          const labelClass = item.destructive ? "text-red-400" : "text-white/75";

          const inner = (
            <>
              <item.icon className={cn("h-6 w-6 shrink-0", iconClass)} strokeWidth={1.5} aria-hidden />
              <span className={cn("line-clamp-2 text-center text-[10px] font-medium leading-tight sm:text-[11px]", labelClass)}>
                {item.label}
              </span>
            </>
          );

          if (item.onClick) {
            return (
              <button key={item.id} type="button" onClick={item.onClick} className={cellClass}>
                {inner}
              </button>
            );
          }

          if (item.href?.startsWith("mailto:")) {
            return (
              <a key={item.id} href={item.href} className={cellClass}>
                {inner}
              </a>
            );
          }

          return (
            <Link key={item.id} href={item.href ?? "/"} className={cellClass}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
