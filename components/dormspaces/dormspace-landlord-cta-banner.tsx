import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Sparkles, Users } from "lucide-react";

import { DORMSPACE_HERO_IMAGE } from "@/lib/dormspaces";

export function DormspaceLandlordCtaBanner() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-3xl bg-[#3d6b40] shadow-[0_12px_40px_rgba(44,44,44,0.15)]">
        <div className="grid lg:grid-cols-[1fr_1.1fr_auto] lg:items-stretch">
          <div className="px-6 py-8 sm:px-8 lg:py-10">
            <h2 className="font-serif text-2xl font-bold tracking-tight text-white md:text-3xl">
              List your dormspace today
            </h2>
            <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-white/85 md:text-base">
              Join thousands of verified landlords earning monthly from students and young professionals.
            </p>
            <Link
              href="/dormspaces/welcome"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#D4A843] px-7 text-sm font-bold text-[#2C2C2C] shadow-md transition hover:bg-[#c49a3d]"
            >
              List Your Space
            </Link>
          </div>

          <div className="grid gap-6 border-t border-white/10 px-6 py-8 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:py-10">
            <Pillar
              icon={<Sparkles className="size-5 text-[#D4A843]" />}
              title="100% Free"
              text="No listing fees ever."
            />
            <Pillar
              icon={<BadgeCheck className="size-5 text-[#D4A843]" />}
              title="Verified Platform"
              text="We verify landlords for your safety."
            />
            <Pillar
              icon={<Users className="size-5 text-[#D4A843]" />}
              title="Reach Thousands"
              text="Get seen by students actively looking."
            />
          </div>

          <div className="relative hidden min-h-[200px] w-[200px] shrink-0 lg:block xl:w-[240px]">
            <Image
              src={DORMSPACE_HERO_IMAGE}
              alt=""
              fill
              className="object-cover"
              sizes="240px"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#3d6b40] via-[#3d6b40]/40 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillar({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div>
      <div>{icon}</div>
      <p className="mt-2 text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-xs font-medium text-white/75">{text}</p>
    </div>
  );
}
