"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Airbnb-style overlay control: white chevron, no circular background. */
export const galleryNavButtonClass =
  "absolute top-1/2 z-20 flex -translate-y-1/2 items-center justify-center p-1 text-white opacity-90 transition-opacity hover:opacity-100 disabled:pointer-events-none disabled:opacity-30";

export const galleryNavIconClass = "drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]";

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8 sm:h-10 sm:w-10",
} as const;

export type GalleryNavButtonProps = {
  direction: "prev" | "next";
  className?: string;
  iconClassName?: string;
  size?: keyof typeof iconSizes;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function GalleryNavButton({
  direction,
  className,
  iconClassName,
  size = "md",
  ...props
}: GalleryNavButtonProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const sideClass = direction === "prev" ? "left-2" : "right-2";

  return (
    <button
      type="button"
      className={cn(galleryNavButtonClass, sideClass, className)}
      {...props}
    >
      <Icon
        className={cn(iconSizes[size], galleryNavIconClass, iconClassName)}
        strokeWidth={2.5}
        aria-hidden
      />
    </button>
  );
}

/** Horizontal row scroll (cream background): no circle, charcoal chevron. */
export const rowScrollNavButtonClass =
  "hidden shrink-0 self-center p-1.5 text-[#2C2C2C] opacity-70 transition hover:opacity-100 md:flex";

export type RowScrollNavButtonProps = {
  direction: "prev" | "next";
  className?: string;
  iconClassName?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function RowScrollNavButton({
  direction,
  className,
  iconClassName,
  ...props
}: RowScrollNavButtonProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button type="button" className={cn(rowScrollNavButtonClass, className)} {...props}>
      <Icon className={cn("h-4 w-4", iconClassName)} strokeWidth={2.25} aria-hidden />
    </button>
  );
}
