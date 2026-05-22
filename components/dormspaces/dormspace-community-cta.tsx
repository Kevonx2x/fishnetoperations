import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { DORMSPACE_HERO_IMAGE } from "@/lib/dormspaces";

export function DormspaceCommunityCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-[#1e4d3a] shadow-[0_16px_48px_rgba(30,77,58,0.25)]">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A8D4AB]">Community</p>
            <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-white md:text-[1.75rem]">
              Find your people, not just a room
            </h2>
            <p className="mt-3 max-w-lg text-sm font-medium leading-relaxed text-white/85 md:text-base">
              Save listings, compare neighborhoods, and reach verified landlords when you are ready to move.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dormspaces#listings"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#6B9E6E] px-7 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
              >
                Browse dormspaces
              </Link>
              <Link
                href="/dormspaces/welcome"
                className="inline-flex h-11 items-center justify-center rounded-full border-2 border-[#D4A843]/60 bg-transparent px-7 text-sm font-bold text-[#D4A843] transition hover:bg-[#D4A843]/10"
              >
                List your space
              </Link>
            </div>
            <div className="mt-6 hidden max-w-sm rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm sm:block">
              <p className="flex items-start gap-2 text-xs font-medium text-white/90">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-[#D4A843]" aria-hidden />
                <span>
                  <span className="font-bold text-white">Looking for a female roommate!</span>
                  {" "}
                  — typical messages once listings go live in your area.
                </span>
              </p>
            </div>
          </div>
          <div className="relative min-h-[200px] lg:min-h-full">
            <Image
              src={DORMSPACE_HERO_IMAGE}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1e4d3a] via-[#1e4d3a]/50 to-transparent lg:via-[#1e4d3a]/30" />
          </div>
        </div>
      </div>
    </section>
  );
}
