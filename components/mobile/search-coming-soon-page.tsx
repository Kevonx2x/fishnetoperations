"use client";

import Link from "next/link";
import { Map, Search } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "bahaygo" | "dormspaces";

const COPY: Record<
  Variant,
  { title: string; body: string; homeHref: string; homeLabel: string; accent: string }
> = {
  bahaygo: {
    title: "Search is coming soon",
    body: "Map search, filters, and smart matching are on the way. Browse homes from Home for now.",
    homeHref: "/",
    homeLabel: "Back to Home",
    accent: "#6B9E6E",
  },
  dormspaces: {
    title: "Search is coming soon",
    body: "Campus map search and dorm filters are almost ready. Explore listings from Home for now.",
    homeHref: "/dormspaces",
    homeLabel: "Back to Dormspaces",
    accent: "#6B9E6E",
  },
};

export function SearchComingSoonPage({ variant }: { variant: Variant }) {
  const copy = COPY[variant];

  return (
    <div
      className={cn(
        "flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-6 py-12 text-center md:min-h-[60vh]",
        variant === "dormspaces" ? "bg-[#FAF8F4]" : "bg-[#FAF8F4]",
      )}
    >
      <div
        className="flex size-20 items-center justify-center rounded-3xl bg-white shadow-[0_8px_28px_rgba(44,44,44,0.08)] ring-1 ring-black/[0.05]"
        aria-hidden
      >
        <div className="relative">
          <Search className="size-9 text-[#2C2C2C]/25" strokeWidth={1.75} />
          <Map
            className="absolute -bottom-1 -right-1 size-6 text-[#6B9E6E]"
            strokeWidth={2}
            fill="#6B9E6E"
            fillOpacity={0.15}
          />
        </div>
      </div>

      <p
        className="mt-6 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{ backgroundColor: `${copy.accent}18`, color: copy.accent }}
      >
        Coming soon
      </p>

      <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C]">{copy.title}</h1>
      <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-[#484848]">{copy.body}</p>

      <Link
        href={copy.homeHref}
        className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-8 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
      >
        {copy.homeLabel}
      </Link>
    </div>
  );
}
