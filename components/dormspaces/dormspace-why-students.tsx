import { BadgeCheck, Heart, MapPin, Wallet, Wifi } from "lucide-react";

const POINTS = [
  {
    icon: BadgeCheck,
    title: "Verified by our team",
    text: "Landlords submit ID once — not a sketchy Facebook post.",
  },
  {
    icon: Wallet,
    title: "No listing fees for students",
    text: "Browse, save, and message without platform charges.",
  },
  {
    icon: MapPin,
    title: "Near your campus",
    text: "Filter by school area, commute, and neighborhood vibe.",
  },
  {
    icon: Wifi,
    title: "Real amenities listed",
    text: "Wi-Fi, laundry, kitchen — see what is actually included.",
  },
  {
    icon: Heart,
    title: "Built for dorm life",
    text: "Bedspaces, shared rooms, and coliving — not generic rentals.",
  },
] as const;

export function DormspaceWhyStudentsSection() {
  return (
    <section className="bg-white py-6 sm:py-8">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a6d32]">Why dormspacers</p>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">
            Why students choose us
          </h2>
          <p className="mt-3 max-w-md text-sm font-medium leading-relaxed text-[#484848]">
            BahayGo dormspacers is a student-first corner of BahayGo — less corporate listing site, more
            campus housing community.
          </p>
        </div>
        <ul className="space-y-2.5 sm:space-y-3">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-xl bg-[#FAF8F4] px-3.5 py-3 ring-1 ring-black/[0.05] sm:rounded-2xl sm:px-4 sm:py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/12 sm:size-10">
                <Icon className="size-4 text-[#6B9E6E] sm:size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-[#2C2C2C]">{title}</p>
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-[#484848]">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
