"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ROTATE_MS = 4200;

const SLIDES = [
  {
    id: "client",
    kicker: "For clients",
    body: "Browse verified listings, connect with licensed agents, and move from inquiry to viewing without the usual guesswork.",
  },
  {
    id: "broker",
    kicker: "For agents & brokers",
    body: "List with confidence, manage your pipeline in one place, and reach serious buyers and renters across the Philippines.",
  },
  {
    id: "testimonial",
    kicker: "From our community",
    body: "BahayGo made it easy to compare agents and book a viewing the same week. Everything felt legitimate from the start.",
    attribution: "— Maria L., first-time renter in BGC",
  },
] as const;

/** Diagonal corner flourishes — top-left & bottom-right only, rounded, open frame. */
function DiagonalCornerFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-2xl px-6 py-12 sm:px-10 sm:py-16 md:py-20">
      <span
        className="pointer-events-none absolute left-3 top-4 h-11 w-11 rounded-tl-[1.35rem] border-l border-t border-[#2C2C2C]/12 sm:left-6 sm:top-6 sm:h-14 sm:w-14 sm:rounded-tl-[1.75rem]"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-4 right-3 h-11 w-11 rounded-br-[1.35rem] border-b border-r border-[#2C2C2C]/12 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14 sm:rounded-br-[1.75rem]"
        aria-hidden
      />
      <div className="relative px-2 sm:px-6">{children}</div>
    </div>
  );
}

export function HomepageValueSlider() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const slide = SLIDES[index]!;

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % SLIDES.length);
        setVisible(true);
      }, 280);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      className="mt-10 mb-2 lg:mt-14 lg:mb-4"
      aria-label="Why BahayGo"
      aria-roledescription="carousel"
    >
      <DiagonalCornerFrame>
        <div className="min-h-[4.75rem] sm:min-h-[5.25rem]">
          <div
            className={cn(
              "mx-auto max-w-md text-center transition-opacity duration-500 ease-out sm:max-w-lg",
              visible ? "opacity-100" : "opacity-0",
            )}
            aria-live="polite"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B9E6E]/90">
              {slide.kicker}
            </p>
            <p className="mt-3 font-serif text-[1.05rem] font-medium leading-[1.65] text-[#2C2C2C]/80 sm:mt-4 sm:text-xl sm:leading-[1.7]">
              {slide.body}
            </p>
            {"attribution" in slide && slide.attribution ? (
              <p className="mt-4 text-xs font-medium tracking-wide text-[#2C2C2C]/40">
                {slide.attribution}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2 sm:mt-10" aria-hidden>
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1 rounded-full transition-all duration-500 ease-out",
                i === index ? "w-6 bg-[#6B9E6E]/50" : "w-1 bg-[#2C2C2C]/10",
              )}
            />
          ))}
        </div>
      </DiagonalCornerFrame>
    </section>
  );
}
