import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { DORMSPACE_HERO_IMAGE } from "@/lib/dormspaces";

export function DormspaceCommunityCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="overflow-hidden rounded-2xl bg-[#1e4d3a] shadow-[0_8px_32px_rgba(30,77,58,0.22)] sm:rounded-3xl">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
          <div className="relative z-10 px-5 py-5 sm:px-8 sm:py-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A8D4AB] sm:text-xs">
              Community
            </p>
            <h2 className="mt-1.5 font-serif text-xl font-bold tracking-tight text-white sm:mt-2 sm:text-2xl md:text-[1.65rem]">
              Find your people, not just a room
            </h2>
            <p className="mt-2 max-w-lg text-[13px] font-medium leading-relaxed text-white/85 sm:mt-3 sm:text-sm">
              Save listings, compare neighborhoods, and reach verified landlords when you are ready to move.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:flex-wrap sm:gap-3">
              <Link
                href="/dormspaces#listings"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-[0_4px_16px_rgba(107,158,110,0.35)] transition hover:bg-[#5d8a60] sm:rounded-full sm:px-7"
              >
                Browse dormspaces
              </Link>
              <Link
                href="/dormspaces/welcome"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D4A843]/50 bg-transparent px-6 text-sm font-bold text-[#D4A843] transition hover:bg-[#D4A843]/10 sm:rounded-full sm:border-2 sm:px-7"
              >
                List your space
              </Link>
            </div>
            <div className="mt-4 hidden max-w-sm rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm sm:block">
              <p className="flex items-start gap-2 text-[11px] font-medium text-white/90">
                <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-[#D4A843]" aria-hidden />
                <span>
                  <span className="font-bold text-white">Looking for a female roommate!</span>
                  {" "}
                  — typical messages once listings go live in your area.
                </span>
              </p>
            </div>
          </div>
          <div className="relative aspect-[2.2/1] max-h-[132px] w-full lg:aspect-auto lg:max-h-none lg:min-h-[200px]">
            <Image
              src={DORMSPACE_HERO_IMAGE}
              alt=""
              fill
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 35vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1e4d3a]/90 via-[#1e4d3a]/30 to-transparent lg:bg-gradient-to-r lg:from-[#1e4d3a] lg:via-[#1e4d3a]/40 lg:to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
