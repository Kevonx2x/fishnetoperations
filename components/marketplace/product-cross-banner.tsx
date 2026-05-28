"use client";

import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type CrossBannerPill = {
  label: string;
  href: string;
  variant: "primary" | "outline";
};

export type CrossBannerFeature = {
  icon: LucideIcon;
  line1: string;
  line2: string;
};

type Props = {
  id?: string;
  eyebrow: React.ReactNode;
  headline: React.ReactNode;
  subline?: string;
  features?: readonly CrossBannerFeature[];
  imageSrc: string;
  pills: CrossBannerPill[];
  /** `split` = image on right panel; `fullBleed` = image edge-to-edge with text scrim. */
  imageLayout?: "split" | "fullBleed";
  bgClassName?: string;
  className?: string;
};

export function ProductCrossBanner({
  id,
  eyebrow,
  headline,
  subline,
  features,
  imageSrc,
  pills,
  imageLayout = "split",
  bgClassName = "bg-[#1a2e22]",
  className,
}: Props) {
  const fullBleed = imageLayout === "fullBleed";

  return (
    <section className={cn("mx-auto max-w-6xl px-0 py-0", className)} aria-labelledby={id}>
      <div
        className={cn(
          "relative h-[200px] overflow-hidden rounded-[24px] shadow-[0_10px_36px_rgba(26,46,34,0.22)] sm:h-[220px] sm:rounded-[28px] md:h-[248px] md:rounded-[32px]",
          fullBleed ? "bg-[#1a2e22]" : bgClassName,
        )}
      >
        {fullBleed ? (
          <>
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 1152px"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.42) 28%, rgba(0,0,0,0.18) 48%, transparent 68%)",
              }}
              aria-hidden
            />
          </>
        ) : (
          <div
            className="absolute inset-y-0 right-0 w-[46%] min-w-[132px] max-w-[52%] sm:w-[44%] md:w-[42%]"
            style={{
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 20%)",
              maskImage: "linear-gradient(to right, transparent 0%, #000 20%)",
            }}
          >
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 46vw, 320px"
            />
          </div>
        )}

        <div className="relative z-10 flex h-full min-w-0 flex-col justify-center px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          {eyebrow}
          <h2
            id={id}
            className="mt-2 font-serif text-[1.15rem] font-bold leading-[1.12] tracking-tight text-white sm:mt-2.5 sm:text-[1.65rem] md:text-[2rem]"
          >
            {headline}
          </h2>
          {subline ? (
            <p className="mt-1 hidden text-[11px] font-medium text-white/75 sm:block sm:text-sm">{subline}</p>
          ) : null}

          {features && features.length > 0 ? (
            <ul className="mt-2 flex gap-3 sm:mt-3 sm:gap-5 md:gap-6">
              {features.map(({ icon: Icon, line1, line2 }) => (
                <li key={line1} className="flex items-center gap-1.5 sm:gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#6B9E6E]/35 bg-[#6B9E6E]/10 sm:size-8">
                    <Icon className="size-3 text-[#A8D4AB] sm:size-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="flex flex-col text-[9px] font-semibold leading-tight text-white/90 sm:text-[10px]">
                    <span>{line1}</span>
                    <span>{line2}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3 sm:gap-2.5">
            {pills.map((pill) => (
              <Link
                key={pill.href + pill.label}
                href={pill.href}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-full px-4 text-[11px] font-bold transition sm:h-10 sm:px-5 sm:text-xs md:h-11 md:text-sm",
                  pill.variant === "primary"
                    ? "bg-[#D4A843] text-[#1a2e22] shadow-sm hover:bg-[#c49a3d]"
                    : "border border-[#6B9E6E]/55 text-[#A8D4AB] hover:border-[#6B9E6E] hover:bg-[#6B9E6E]/10",
                )}
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
