import Link from "next/link";
import { Check } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

export const metadata = {
  title: "Pricing — BahayGo",
  description: "Agent listing plans: Free and Pro.",
};

const rows: { feature: string; free: string; pro: string }[] = [
  { feature: "Monthly price", free: "₱0", pro: "₱999" },
  { feature: "Active property listings", free: "Up to 3", pro: "Up to 20" },
  { feature: "Verified agent profile", free: "Included", pro: "Included" },
  { feature: "Leads & viewings dashboard", free: "Included", pro: "Included" },
  { feature: "Priority placement", free: "—", pro: "Coming soon" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <div className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/45">
          For agents
        </p>
        <h1 className="mt-2 text-center font-serif text-3xl font-bold text-[#2C2C2C] md:text-4xl">
          Listing plans
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm font-semibold text-[#2C2C2C]/55">
          Start free with three listings, or upgrade to Pro for more inventory on BahayGo. Payments are not live yet —
          this page shows what we will offer.
        </p>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                <th className="px-4 py-4 font-bold text-[#2C2C2C] md:px-6">Feature</th>
                <th className="px-4 py-4 font-bold text-[#2C2C2C] md:px-6">Free</th>
                <th className="relative px-4 py-4 font-bold text-[#2C2C2C] md:px-6">
                  <span className="rounded-full bg-[#C9A84C]/20 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                    Pro
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[#2C2C2C]/55">₱999 / month</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-b border-[#2C2C2C]/5 last:border-0">
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C]/85 md:px-6">{row.feature}</td>
                  <td className="px-4 py-3.5 text-[#2C2C2C]/75 md:px-6">{row.free}</td>
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C] md:px-6">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Free</h2>
            <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
              Best for new agents testing the platform.
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-start gap-2 text-sm font-semibold text-[#2C2C2C]/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7C9A7E]" aria-hidden />
                Up to 3 active listings
              </li>
              <li className="flex items-start gap-2 text-sm font-semibold text-[#2C2C2C]/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7C9A7E]" aria-hidden />
                Full dashboard (when verified)
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-[#C9A84C]/40 bg-gradient-to-b from-[#C9A84C]/8 to-white p-6 shadow-sm">
            <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Pro</h2>
            <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
              For agents with a larger portfolio.
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-start gap-2 text-sm font-semibold text-[#2C2C2C]/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" aria-hidden />
                Up to 20 active listings
              </li>
              <li className="flex items-start gap-2 text-sm font-semibold text-[#2C2C2C]/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" aria-hidden />
                Same tools as Free, higher cap
              </li>
            </ul>
            <p className="mt-4 text-xs font-semibold text-[#8a6d32]">
              Upgrade checkout will be available here after billing is connected.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard/agent?tab=listings"
            className="inline-flex rounded-full bg-[#2C2C2C] px-6 py-3 text-sm font-bold text-white hover:bg-[#7C9A7E]"
          >
            Go to agent dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-full border border-[#2C2C2C]/20 bg-white px-6 py-3 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4]"
          >
            Back to home
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
