import Link from "next/link";
import { BadgeCheck, Home, Shield } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-16 font-sans text-[#2C2C2C]">
      <MaddenTopNav />

      <main className="mx-auto max-w-3xl px-4 pt-10 sm:max-w-4xl sm:pt-14">
        <header className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6B9E6E]">Our story</p>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] sm:text-4xl">
            About BahayGo
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-[#2C2C2C]/70 sm:text-lg">
            The trusted real estate marketplace for the Philippines.
          </p>
        </header>

        <section className="mt-12 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Mission</h2>
          <p className="mt-4 text-sm leading-relaxed text-[#2C2C2C]/75 sm:text-base">
            Our mission is to make Philippine real estate transparent, accessible, and safe for
            everyone — local and foreign buyers alike.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Story</h2>
          <p className="mt-4 text-sm leading-relaxed text-[#2C2C2C]/75 sm:text-base">
            BahayGo was founded to solve a real problem — finding verified, trustworthy real estate
            agents in the Philippines is hard. We built a platform where every agent is PRC
            verified, every listing is real, and every transaction is protected.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-center font-serif text-2xl font-bold text-[#2C2C2C] sm:text-3xl">
            What makes us different
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#6B9E6E]/15">
                <BadgeCheck className="h-6 w-6 text-[#6B9E6E]" aria-hidden />
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[#2C2C2C]">Verified Agents only</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#2C2C2C]/65">
                Every professional on our marketplace is PRC checked before they can serve you.
              </p>
            </div>
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#6B9E6E]/15">
                <Shield className="h-6 w-6 text-[#6B9E6E]" aria-hidden />
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[#2C2C2C]">Anti-scam protection</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#2C2C2C]/65">
                Listings are tied to verified agents, with reporting and review built in.
              </p>
            </div>
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#6B9E6E]/15">
                <Home className="h-6 w-6 text-[#6B9E6E]" aria-hidden />
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[#2C2C2C]">Transparent listings</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#2C2C2C]/65">
                Real homes, clear details, and licensed professionals at every step.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/8 p-8 text-center shadow-sm">
          <h2 className="font-serif text-2xl font-bold text-[#2C2C2C]">Contact</h2>
          <p className="mt-3 text-sm font-medium text-[#2C2C2C]/70">
            <a href="mailto:support@bahaygo.com" className="font-semibold text-[#6B9E6E] hover:underline">
              support@bahaygo.com
            </a>
          </p>
          <p className="mt-2 text-sm font-medium text-[#2C2C2C]/70">
            <a href="https://bahaygo.com" className="font-semibold text-[#6B9E6E] hover:underline">
              bahaygo.com
            </a>
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#2C2C2C]/70 hover:text-[#2C2C2C]">
            ← Back to home
          </Link>
        </section>
      </main>
    </div>
  );
}
