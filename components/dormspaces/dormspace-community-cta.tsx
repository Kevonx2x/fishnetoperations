"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle, ShieldCheck, Users } from "lucide-react";

import { BahayGoHouseMark } from "@/components/dormspaces/dormspace-welcome-logo";
import { useAuth } from "@/contexts/auth-context";
import { DORMSPACE_COMMUNITY_BANNER_IMAGE } from "@/lib/dormspaces";

const FEATURES = [
  { icon: ShieldCheck, line1: "Verified", line2: "Listings" },
  { icon: MessageCircle, line1: "Direct", line2: "Messaging" },
  { icon: Users, line1: "Student", line2: "Community" },
] as const;

export function DormspaceCommunityCta() {
  const { user, loading } = useAuth();

  const pillHref = user ? "/dormspaces/welcome" : "/auth/register?next=/dormspaces";
  const pillLabel = user ? "List your room" : "Sign up";

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative h-[200px] overflow-hidden rounded-[24px] bg-[#1a2e22] shadow-[0_10px_36px_rgba(26,46,34,0.26)] sm:h-[220px] sm:rounded-[28px] md:h-[248px] md:rounded-[32px]">
        {/* Photo — always right, never stacked below */}
        <div className="absolute inset-y-0 right-0 w-[46%] min-w-[132px] max-w-[52%] sm:w-[44%] md:w-[42%]">
          <Image
            src={DORMSPACE_COMMUNITY_BANNER_IMAGE}
            alt=""
            fill
            className="object-cover object-center"
            sizes="(max-width: 768px) 46vw, 320px"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#1a2e22] from-5% via-[#1a2e22]/55 via-35% to-transparent to-100%"
            aria-hidden
          />
        </div>

        {/* Copy — left column */}
        <div className="relative z-10 flex h-full min-w-0 flex-col justify-center px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 px-2 py-0.5 sm:gap-2 sm:px-3 sm:py-1">
            <BahayGoHouseMark className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/70 sm:text-[10px]">
              BahayGo Community
            </span>
          </div>

          <h2 className="mt-2 font-serif text-[1.15rem] font-bold leading-[1.12] tracking-tight text-white sm:mt-2.5 sm:text-[1.65rem] md:text-[2rem]">
            Your campus life, made <span className="text-[#D4A843]">easier.</span>
          </h2>
          <p className="mt-1 hidden text-[11px] font-medium text-white/75 sm:block sm:text-sm">
            Verified dorms. Real people. Better living.
          </p>

          <ul className="mt-2 flex gap-3 sm:mt-3 sm:gap-5 md:gap-6">
            {FEATURES.map(({ icon: Icon, line1, line2 }) => (
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

          {!loading ? (
            <Link
              href={pillHref}
              className="mt-2.5 inline-flex h-9 w-fit items-center justify-center rounded-full bg-[#D4A843] px-5 text-[11px] font-bold text-[#1a2e22] shadow-sm transition hover:bg-[#c49a3d] sm:mt-3 sm:h-10 sm:px-6 sm:text-xs md:h-11 md:text-sm"
            >
              {pillLabel}
            </Link>
          ) : (
            <span className="mt-2.5 inline-block h-9 w-24 animate-pulse rounded-full bg-white/10 sm:mt-3" aria-hidden />
          )}
        </div>
      </div>
    </section>
  );
}
