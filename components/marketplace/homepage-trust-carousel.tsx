"use client";

import { Building2, Lock, ShieldCheck, Zap, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TRUST_ITEMS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: ShieldCheck,
    title: "Verified Agents",
    body: "PRC licensed and verified",
  },
  {
    icon: Building2,
    title: "Licensed Agencies",
    body: "Registered and monitored",
  },
  {
    icon: Lock,
    title: "Anti-Scam Protection",
    body: "Report & remove instantly",
  },
  {
    icon: Zap,
    title: "Fast & Safe Messaging",
    body: "Direct chat with verified agents",
  },
];

function TrustCard({ icon: Icon, title, body }: (typeof TRUST_ITEMS)[number]) {
  return (
    <article
      className={cn(
        "flex shrink-0 snap-start flex-col items-center rounded-2xl bg-white px-4 py-5 text-center",
        "shadow-[0_4px_20px_rgba(44,44,44,0.08)] ring-1 ring-black/[0.05]",
        "w-[min(168px,44vw)] sm:w-[180px] sm:py-6",
        "md:w-full md:shrink",
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-[#6B9E6E]/14 sm:size-12">
        <Icon className="size-5 text-[#2d4a32] sm:size-6" strokeWidth={2} aria-hidden />
      </span>
      <h3 className="mt-3 font-serif text-[15px] font-bold leading-snug text-[#2C2C2C] sm:text-base">{title}</h3>
      <p className="mt-1.5 text-[11px] font-medium leading-snug text-[#5c5c5c] sm:text-xs">{body}</p>
    </article>
  );
}

export function HomepageTrustCarousel() {
  return (
    <section className="mt-6 lg:mt-12" aria-label="Why BahayGo">
      <div
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide",
          "sm:mx-0 sm:gap-4 sm:px-0",
          "md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0",
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {TRUST_ITEMS.map((item) => (
          <TrustCard key={item.title} {...item} />
        ))}
      </div>
    </section>
  );
}
