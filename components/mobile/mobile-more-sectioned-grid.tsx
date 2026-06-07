"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, User, type LucideIcon } from "lucide-react";

import { PhilippineFlagWatermark } from "@/components/philippine-flag-watermark";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { MOBILE_BOTTOM_NAV_OFFSET_CSS } from "@/lib/mobile-bottom-nav-layout";
import { cn } from "@/lib/utils";

/** Fixed tile height — compact 2-col grid rows (mockup density). */
const TILE_H = "h-11";

export type MobileMoreGridItem = {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  iconMarkup?: ReactNode;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  badge?: string;
  badgeGold?: boolean;
};

export type MobileMoreGridSection = {
  id: string;
  title: string;
  /** Full-width first row inside the section grid (e.g. cross-product link). */
  featuredItem?: MobileMoreGridItem;
  items: MobileMoreGridItem[];
};

type Props = {
  sections: MobileMoreGridSection[];
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
  /** When false, parent shell already renders the flag (e.g. dormspaces portal). */
  showFlagWatermark?: boolean;
};

function gridCellInner(item: MobileMoreGridItem, options?: { showChevron?: boolean }) {
  const iconClass = item.destructive ? "text-red-500" : "text-[#6B9E6E]";
  const labelClass = item.destructive ? "text-red-500" : "text-[#2C2C2C]";

  return (
    <div className="flex h-full w-full min-w-0 items-center gap-2.5 px-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {item.iconMarkup ??
          (item.icon ? (
            <item.icon className={cn("h-5 w-5", iconClass)} strokeWidth={1.75} aria-hidden />
          ) : null)}
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-none", labelClass)}>
        {item.label}
      </span>
      {item.badge ? (
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            item.badgeGold ? "bg-[#D4A843] text-white" : "bg-[#6B9E6E]/10 text-[#6B9E6E]",
          )}
        >
          {item.badge}
        </span>
      ) : null}
      {options?.showChevron && !item.destructive ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[#BBBBBB]" aria-hidden />
      ) : null}
    </div>
  );
}

function GridCell({ item }: { item: MobileMoreGridItem }) {
  const inner = gridCellInner(item);
  const cellClass = cn(
    TILE_H,
    "flex min-w-0 items-stretch text-left transition-colors",
    "hover:bg-black/[0.02] active:bg-black/[0.04]",
  );

  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className={cellClass}>
        {inner}
      </button>
    );
  }

  if (item.href?.startsWith("mailto:")) {
    return (
      <a href={item.href} className={cellClass}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={item.href ?? "/"} className={cellClass}>
      {inner}
    </Link>
  );
}

function FeaturedGridRow({ item }: { item: MobileMoreGridItem }) {
  const inner = gridCellInner(item, { showChevron: true });
  const rowClass = cn(
    TILE_H,
    "col-span-2 flex min-w-0 items-stretch text-left transition-colors",
    "hover:bg-black/[0.02] active:bg-black/[0.04]",
  );

  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className={rowClass}>
        {inner}
      </button>
    );
  }

  if (item.href?.startsWith("mailto:")) {
    return (
      <a href={item.href} className={rowClass}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={item.href ?? "/"} className={rowClass}>
      {inner}
    </Link>
  );
}

function SectionGrid({ section }: { section: MobileMoreGridSection }) {
  if (!section.featuredItem && section.items.length === 0) return null;

  const needsPlaceholder = section.items.length % 2 === 1;

  return (
    <section className="shrink-0">
      <h2 className="mb-1 px-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#888888]">
        {section.title}
      </h2>
      <div
        className={cn(
          "grid grid-cols-2 overflow-hidden rounded-2xl border border-black/[0.06] bg-white",
          "divide-x divide-y divide-black/[0.06]",
        )}
        style={{ gridAutoRows: "2.75rem" }}
      >
        {section.featuredItem ? <FeaturedGridRow item={section.featuredItem} /> : null}
        {section.items.map((item) => (
          <GridCell key={item.id} item={item} />
        ))}
        {needsPlaceholder ? <div className={cn(TILE_H, "bg-white")} aria-hidden /> : null}
      </div>
    </section>
  );
}

export function MobileMoreSectionedGrid({
  sections,
  loading,
  signedIn,
  signInHref,
  signInLabel = "Sign in or create account",
  profileHref = "/settings",
  profileName,
  profileEmail,
  profileAvatarUrl,
  profileInitials = "?",
  profileBadge,
  showFlagWatermark = true,
}: Props) {
  const visibleSections = sections.filter((s) => s.featuredItem || s.items.length > 0);

  return (
    <div
      className="relative flex flex-col overflow-hidden bg-[#FAF8F4] font-sans text-[#2C2C2C] md:hidden"
      style={{
        height: `calc(100dvh - ${MOBILE_BOTTOM_NAV_OFFSET_CSS})`,
        maxHeight: `calc(100dvh - ${MOBILE_BOTTOM_NAV_OFFSET_CSS})`,
      }}
    >
      {showFlagWatermark ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <PhilippineFlagWatermark />
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header className="mb-1.5 shrink-0">
          <h1 className="font-serif text-[1.35rem] font-bold leading-none tracking-tight text-[#2C2C2C]">
            More
          </h1>
        </header>

        <div className="mb-2.5 shrink-0">
          {loading ? (
            <div className="h-14 animate-pulse rounded-2xl bg-white/80" aria-hidden />
          ) : signedIn ? (
            <Link
              href={profileHref}
              className="flex h-14 items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white px-3 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]">
                {profileAvatarUrl ? (
                  <SupabasePublicImage
                    src={profileAvatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                    {profileInitials}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[14px] font-semibold leading-tight text-[#2C2C2C]">{profileName}</p>
                  {profileBadge ? (
                    <span className="shrink-0 rounded-full bg-[#6B9E6E]/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-[#6B9E6E]">
                      {profileBadge}
                    </span>
                  ) : null}
                </div>
                {profileEmail ? (
                  <p className="truncate text-[11px] leading-tight text-[#888888]">{profileEmail}</p>
                ) : null}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#BBBBBB]" aria-hidden />
            </Link>
          ) : (
            <div className="flex h-14 items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white px-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
                <User className="h-5 w-5 text-[#6B9E6E]/70" strokeWidth={1.5} aria-hidden />
              </div>
              <Link
                href={signInHref}
                className="flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-xl bg-[#6B9E6E] px-3 text-[13px] font-semibold leading-tight text-white transition-colors hover:bg-[#5d8a60] active:bg-[#527a55]"
              >
                {signInLabel}
              </Link>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
          {visibleSections.map((section) => (
            <SectionGrid key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
