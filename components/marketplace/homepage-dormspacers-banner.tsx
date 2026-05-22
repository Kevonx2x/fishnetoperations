"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { pathForDormspacesHomeFromBahayGo } from "@/lib/auth-roles";
import { DORMSPACE_HERO_IMAGE } from "@/lib/dormspaces";

export function HomepageDormspacersBanner() {
  const { profile } = useAuth();
  const href = pathForDormspacesHomeFromBahayGo(profile?.role);

  return (
    <section className="mt-6 lg:mt-10" aria-labelledby="homepage-dormspacers-banner-heading">
      <Link
        href={href}
        className="group relative block overflow-hidden rounded-3xl bg-[#1e4d3a] shadow-[0_16px_48px_rgba(30,77,58,0.25)] transition hover:shadow-[0_20px_52px_rgba(30,77,58,0.32)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/35"
      >
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A8D4AB]">BahayGo dormspacers</p>
            <h2
              id="homepage-dormspacers-banner-heading"
              className="mt-2 font-serif text-2xl font-bold tracking-tight text-white md:text-[1.75rem]"
            >
              Need a dorm for college or work?
            </h2>
            <p className="mt-3 max-w-lg text-sm font-medium leading-relaxed text-white/85 md:text-base">
              Check out verified bedspaces and coliving near campuses and offices across Metro Manila.
            </p>
            <span className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-7 text-sm font-bold text-white shadow-md transition group-hover:bg-[#5d8a60]">
              Explore dormspaces
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
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
      </Link>
    </section>
  );
}
