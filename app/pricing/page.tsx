import Link from "next/link";
import { Check } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

export const metadata = {
  title: "Pricing — BahayGo",
  description: "Agent plans: Free, Pro, Featured, and Broker — listing limits, co-lists, and team seats.",
};

const GOLD = "#D4A843";

type TierCard = {
  id: string;
  name: string;
  price: string;
  highlight?: "popular";
  owned: string;
  coList: string;
  team: string;
  perks: string[];
};

const tiers: TierCard[] = [
  {
    id: "free",
    name: "Free",
    price: "₱0",
    owned: "1 owned listing",
    coList: "2 co-lists",
    team: "0 team members",
    perks: ["Basic profile", "Lead capture", "Verified profile when approved"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₱999/mo",
    owned: "20 owned listings",
    coList: "10 co-lists",
    team: "3 team members",
    perks: ["Analytics", "Templates", "Priority support", "Everything in Free"],
  },
  {
    id: "featured",
    name: "Featured",
    price: "₱1,499/mo",
    highlight: "popular",
    owned: "20 owned listings",
    coList: "10 co-lists",
    team: "5 team members",
    perks: [
      "Everything in Pro",
      "Top placement on listings",
      "Featured Agent gold badge",
      "Priority lead notifications",
      "Advanced analytics",
    ],
  },
  {
    id: "broker",
    name: "Broker",
    price: "₱4,000/mo",
    owned: "Unlimited owned",
    coList: "Unlimited co-lists",
    team: "Unlimited team seats",
    perks: ["Everything in Featured", "Team management", "All agents under your brokerage"],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <div className="px-4 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/45">
            For agents &amp; brokers
          </p>
          <h1 className="mt-2 text-center font-serif text-3xl font-bold text-[#2C2C2C] md:text-4xl">
            Listing plans
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm font-semibold text-[#2C2C2C]/55">
            Choose a tier based on how many listings you own, how many co-listing slots you need, and team seats for
            showing assistants. Payments are not live yet — this page shows what we will offer.
          </p>

          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            {tiers.map((tier) => {
              const isFeatured = tier.highlight === "popular";
              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-sm ${
                    isFeatured
                      ? "border-2 shadow-md ring-2 ring-[#D4A843]/25"
                      : "border border-[#2C2C2C]/10"
                  }`}
                  style={isFeatured ? { borderColor: GOLD } : undefined}
                >
                  {isFeatured ? (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-[#2C2C2C] shadow-sm"
                      style={{ backgroundColor: GOLD }}
                    >
                      Most Popular
                    </span>
                  ) : null}
                  <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">{tier.name}</h2>
                  <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-[#2C2C2C]">{tier.price}</p>
                  <ul className="mt-4 space-y-1.5 text-xs font-semibold text-[#2C2C2C]/65">
                    <li>{tier.owned}</li>
                    <li>{tier.coList}</li>
                    <li>{tier.team}</li>
                  </ul>
                  <ul className="mt-5 flex-1 space-y-2.5 border-t border-[#2C2C2C]/10 pt-5">
                    {tier.perks.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm font-semibold text-[#2C2C2C]/85">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${isFeatured ? "text-[#B8860B]" : "text-[#6B9E6E]"}`}
                          aria-hidden
                        />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-12 overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                  <th className="px-4 py-4 font-bold text-[#2C2C2C] md:px-6">Feature</th>
                  <th className="px-4 py-4 font-bold text-[#2C2C2C] md:px-6">Free</th>
                  <th className="px-4 py-4 font-bold text-[#2C2C2C] md:px-6">Pro</th>
                  <th className="px-4 py-4 font-bold text-[#2C2C2C] md:px-6">
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: `${GOLD}33` }}>
                      Featured
                    </span>
                  </th>
                  <th className="px-4 py-4 font-bold text-[#2C2C2C] md:px-6">Broker</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#2C2C2C]/5">
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C]/85 md:px-6">Monthly price</td>
                  <td className="px-4 py-3.5 md:px-6">₱0</td>
                  <td className="px-4 py-3.5 md:px-6">₱999</td>
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C] md:px-6">₱1,499</td>
                  <td className="px-4 py-3.5 md:px-6">₱4,000</td>
                </tr>
                <tr className="border-b border-[#2C2C2C]/5">
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C]/85 md:px-6">Owned listings</td>
                  <td className="px-4 py-3.5 md:px-6">1</td>
                  <td className="px-4 py-3.5 md:px-6">20</td>
                  <td className="px-4 py-3.5 md:px-6">20</td>
                  <td className="px-4 py-3.5 md:px-6">Unlimited</td>
                </tr>
                <tr className="border-b border-[#2C2C2C]/5">
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C]/85 md:px-6">Co-list slots</td>
                  <td className="px-4 py-3.5 md:px-6">2</td>
                  <td className="px-4 py-3.5 md:px-6">10</td>
                  <td className="px-4 py-3.5 md:px-6">10</td>
                  <td className="px-4 py-3.5 md:px-6">Unlimited</td>
                </tr>
                <tr className="border-b border-[#2C2C2C]/5">
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C]/85 md:px-6">Team members</td>
                  <td className="px-4 py-3.5 md:px-6">0</td>
                  <td className="px-4 py-3.5 md:px-6">3</td>
                  <td className="px-4 py-3.5 md:px-6">5</td>
                  <td className="px-4 py-3.5 md:px-6">Unlimited</td>
                </tr>
                <tr className="border-b border-[#2C2C2C]/5">
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C]/85 md:px-6">Featured Agent badge</td>
                  <td className="px-4 py-3.5 text-[#2C2C2C]/50 md:px-6">—</td>
                  <td className="px-4 py-3.5 text-[#2C2C2C]/50 md:px-6">—</td>
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C] md:px-6">Gold badge</td>
                  <td className="px-4 py-3.5 md:px-6">Included</td>
                </tr>
                <tr>
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C]/85 md:px-6">Brokerage team tools</td>
                  <td className="px-4 py-3.5 text-[#2C2C2C]/50 md:px-6">—</td>
                  <td className="px-4 py-3.5 text-[#2C2C2C]/50 md:px-6">—</td>
                  <td className="px-4 py-3.5 text-[#2C2C2C]/50 md:px-6">—</td>
                  <td className="px-4 py-3.5 font-semibold text-[#2C2C2C] md:px-6">Full access</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-center text-xs font-semibold text-[#2C2C2C]/45">
            Co-lists are properties where you are a co-agent but not the listing owner. Owned listings are properties you
            list under your account.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard/agent?tab=listings"
              className="inline-flex rounded-full bg-[#2C2C2C] px-6 py-3 text-sm font-bold text-white hover:bg-[#6B9E6E]"
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
