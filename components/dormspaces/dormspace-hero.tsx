import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Sparkles } from "lucide-react";

import { DORMSPACE_HERO_IMAGE } from "@/lib/dormspaces";

export function DormspaceHero() {
  return (
    <section className="relative -mx-4 h-[min(480px,72vh)] overflow-hidden sm:-mx-6 md:mx-0 md:rounded-3xl md:border md:border-[#2C2C2C]/8">
      <Image src={DORMSPACE_HERO_IMAGE} alt="" fill priority className="object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e22]/95 via-[#1a2e22]/55 to-[#1a2e22]/25" />
      <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />

      <div className="relative flex h-full flex-col items-center justify-end px-5 pb-10 pt-20 text-center sm:px-8 md:pb-12">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#A8D4AB] backdrop-blur-sm">
          <Sparkles className="size-3.5" aria-hidden />
          Youth + community
        </p>
        <h1 className="max-w-3xl font-serif text-4xl font-bold tracking-tight text-white drop-shadow-md md:text-5xl">
          Dormspaces &amp; Coliving
        </h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-white/90 md:text-lg">
          Verified bedspaces for students, BPO workers, and young professionals across Metro Manila
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
            <BadgeCheck className="size-3.5 text-[#A8D4AB]" aria-hidden />
            Verified Landlords
          </span>
          <span className="rounded-full bg-[#D4A843]/35 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
            Free Listings
          </span>
        </div>
        <Link
          href="/dormspaces/submit"
          className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#6B9E6E] px-8 text-sm font-bold text-white shadow-lg transition hover:bg-[#5d8a60]"
        >
          List your dormspace
        </Link>
      </div>
    </section>
  );
}
