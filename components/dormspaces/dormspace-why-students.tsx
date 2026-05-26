"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, ChevronRight, Heart, MapPin, Wifi, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const POINTS: {
  icon: LucideIcon;
  title: string;
  text: string;
}[] = [
  {
    icon: BadgeCheck,
    title: "Verified by our team",
    text: "Landlords submit ID once — not a sketchy Facebook post.",
  },
  {
    icon: Wifi,
    title: "Real amenities listed",
    text: "Wi-Fi, laundry, kitchen — see what is actually included.",
  },
  {
    icon: MapPin,
    title: "Near your campus",
    text: "Filter by school area, commute, and neighborhood vibe.",
  },
  {
    icon: Heart,
    title: "Built for dorm life",
    text: "Bedspaces, shared rooms, and coliving — not generic rentals.",
  },
];

function WhyCard({ icon: Icon, title, text }: (typeof POINTS)[number]) {
  return (
    <article className="flex h-[188px] w-[min(248px,76vw)] shrink-0 snap-start flex-col rounded-2xl bg-[#F3F1EC] p-4 sm:h-[200px] sm:w-[260px]">
      <span className="flex size-10 items-center justify-center rounded-full bg-[#6B9E6E]/18">
        <Icon className="size-5 text-[#2d4a32]" strokeWidth={2} aria-hidden />
      </span>
      <h3 className="mt-3 font-serif text-lg font-bold leading-snug text-[#2C2C2C]">{title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] font-medium leading-relaxed text-[#5c5c5c]">{text}</p>
      <span
        className="mt-3 flex size-8 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(44,44,44,0.08)] ring-1 ring-black/[0.06]"
        aria-hidden
      >
        <ChevronRight className="size-4 text-[#6B9E6E]" strokeWidth={2.5} />
      </span>
    </article>
  );
}

export function DormspaceWhyStudentsSection() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>("[data-why-card]");
    if (cards.length === 0) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActiveIndex(best);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateActiveFromScroll();
    el.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    return () => el.removeEventListener("scroll", updateActiveFromScroll);
  }, [updateActiveFromScroll]);

  return (
    <section className="bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a6d32] sm:text-xs">
          Why dormspacers
        </p>
        <h2 className="mt-1.5 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-[1.75rem]">
          Why students choose us
        </h2>
        <p className="mt-1.5 max-w-md text-sm font-medium text-[#5c5c5c]">
          We focus on what matters for your campus life.
        </p>

        <div
          ref={scrollRef}
          className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:px-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {POINTS.map((point) => (
            <div key={point.title} data-why-card>
              <WhyCard {...point} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-1.5" role="tablist" aria-label="Why dormspacers slides">
          {POINTS.map((_, i) => (
            <span
              key={i}
              role="presentation"
              className={cn(
                "h-1 flex-1 max-w-10 rounded-full transition-colors duration-200",
                i === activeIndex ? "bg-[#1a2e22]" : "bg-[#D4A843]/40",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
